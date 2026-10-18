import { prisma } from "@/lib/prisma";

export const PREORDER_WEEKDAYS = [
  { value: 1, label: "Monday" },
  { value: 2, label: "Tuesday" },
  { value: 3, label: "Wednesday" },
  { value: 4, label: "Thursday" },
  { value: 5, label: "Friday" },
  { value: 6, label: "Saturday" },
  { value: 0, label: "Sunday" },
] as const;

export async function ensureSchoolPreOrderDayTable() {
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS "SchoolPreOrderDaySetting" (
      "schoolId" TEXT NOT NULL,
      "weekday" INTEGER NOT NULL,
      "enabled" BOOLEAN NOT NULL DEFAULT TRUE,
      "updatedAt" TIMESTAMPTZ NOT NULL DEFAULT NOW(),
      PRIMARY KEY ("schoolId", "weekday")
    )
  `);
}

export async function getSchoolPreOrderDaySettings(
  schoolId: string,
) {
  await ensureSchoolPreOrderDayTable();

  const rows = await prisma.$queryRaw<
    Array<{
      weekday: number;
      enabled: boolean;
    }>
  >`
    SELECT "weekday", "enabled"
    FROM "SchoolPreOrderDaySetting"
    WHERE "schoolId" = ${schoolId}
  `;

  const map = new Map<number, boolean>();

  for (const day of PREORDER_WEEKDAYS) {
    map.set(day.value, true);
  }

  for (const row of rows) {
    map.set(row.weekday, row.enabled);
  }

  return map;
}

export async function setSchoolPreOrderDays(
  schoolId: string,
  enabledWeekdays: number[],
) {
  await ensureSchoolPreOrderDayTable();

  const enabled = new Set(enabledWeekdays);

  for (const day of PREORDER_WEEKDAYS) {
    await prisma.$executeRaw`
      INSERT INTO "SchoolPreOrderDaySetting"
        ("schoolId", "weekday", "enabled", "updatedAt")
      VALUES
        (${schoolId}, ${day.value}, ${enabled.has(day.value)}, NOW())
      ON CONFLICT ("schoolId", "weekday")
      DO UPDATE SET
        "enabled" = ${enabled.has(day.value)},
        "updatedAt" = NOW()
    `;
  }
}

export function weekdayFromDateString(
  dateString: string,
) {
  const [year, month, day] =
    dateString.split("-").map(Number);

  return new Date(
    Date.UTC(year, month - 1, day),
  ).getUTCDay();
}

export async function isSchoolPreOrderDayEnabled(
  schoolId: string,
  dateString: string,
) {
  const settings =
    await getSchoolPreOrderDaySettings(
      schoolId,
    );

  return (
    settings.get(
      weekdayFromDateString(
        dateString,
      ),
    ) ?? true
  );
}
