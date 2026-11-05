import { prisma } from "@/lib/prisma";
import { buildWalletReportPdf, formatBrisbaneDateTime, getWalletReportData } from "@/lib/wallet-report";
import { sendEmail } from "@/lib/notification-providers";

const SETTINGS_TYPE = "WALLET_REPORT_SCHEDULE";
const SENT_TYPE = "WALLET_REPORT_SENT";

export type WalletReportSettings = {
  enabled: boolean;
  sendTime: string;
  additionalEmail: string | null;
};

export function validEmail(value: string) {
  return value.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
}

function parseSettings(value: unknown): WalletReportSettings {
  const data = value && typeof value === "object" && !Array.isArray(value)
    ? value as Record<string, unknown> : {};
  return {
    enabled: data.enabled === true,
    sendTime: typeof data.sendTime === "string" && /^([01]\d|2[0-3]):[0-5]\d$/.test(data.sendTime)
      ? data.sendTime : "23:59",
    additionalEmail: typeof data.additionalEmail === "string" && validEmail(data.additionalEmail)
      ? data.additionalEmail : null,
  };
}

export async function getWalletReportSettings(userId: string) {
  const record = await prisma.auditLog.findFirst({
    where: { entityType: SETTINGS_TYPE, entityId: userId },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { metadata: true },
  });
  return parseSettings(record?.metadata);
}

export async function saveWalletReportSettings(
  userId: string,
  settings: WalletReportSettings,
) {
  await prisma.auditLog.create({
    data: {
      actorUserId: userId,
      action: "UPDATE_WALLET_REPORT_SCHEDULE",
      entityType: SETTINGS_TYPE,
      entityId: userId,
      metadata: settings,
    },
  });
}

function brisbaneNow(date: Date) {
  const parts = new Intl.DateTimeFormat("en-GB", {
    timeZone: "Australia/Brisbane",
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hourCycle: "h23",
  }).formatToParts(date);
  const get = (type: string) => parts.find(part => part.type === type)?.value ?? "";
  return {
    date: `${get("year")}-${get("month")}-${get("day")}`,
    time: `${get("hour")}:${get("minute")}`,
  };
}

export async function processDailyWalletReports(now = new Date()) {
  const local = brisbaneNow(now);
  const records = await prisma.auditLog.findMany({
    where: { entityType: SETTINGS_TYPE },
    orderBy: [{ createdAt: "desc" }, { id: "desc" }],
    select: { actorUserId: true, entityId: true, metadata: true },
    take: 1000,
  });
  const seen = new Set<string>();
  let sent = 0;
  for (const record of records) {
    const userId = record.entityId;
    if (!userId || seen.has(userId)) continue;
    seen.add(userId);
    const settings = parseSettings(record.metadata);
    if (!settings.enabled || local.time < settings.sendTime) continue;
    const user = await prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true, fullName: true, email: true, role: true,
        schoolId: true, status: true, deletedAt: true,
      },
    });
    if (!user || user.deletedAt || user.status !== "ACTIVE" ||
      (user.role !== "SUPER_ADMIN" && user.role !== "SCHOOL_ADMIN")) continue;
    const deliveryId = `${userId}:${local.date}`;
    const alreadySent = await prisma.auditLog.findFirst({
      where: { entityType: SENT_TYPE, entityId: deliveryId },
      select: { id: true },
    });
    if (alreadySent) continue;
    const report = await getWalletReportData({
      schoolId: user.role === "SCHOOL_ADMIN" ? user.schoolId ?? "__NO_SCHOOL__" : null,
    });
    const pdf = await buildWalletReportPdf(report);
    const recipients = [user.email];
    if (settings.additionalEmail &&
        settings.additionalEmail.toLowerCase() !== user.email.toLowerCase()) {
      recipients.push(settings.additionalEmail);
    }
    await sendEmail({
      to: recipients,
      subject: "CanteenGo Wallet Balance Report",
      text: `Hi ${user.fullName},\n\nAttached is the daily wallet balance report.\n\nWallets: ${report.rows.length}\nTotal balance: $${report.totalBalance.toFixed(2)}\nGenerated: ${formatBrisbaneDateTime(report.generatedAt)}`,
      attachments: [{
        filename: `canteengo-wallet-report-${local.date}.pdf`,
        content: pdf.toString("base64"),
      }],
    });
    await prisma.auditLog.create({
      data: {
        actorUserId: userId,
        action: "SEND_DAILY_WALLET_REPORT",
        entityType: SENT_TYPE,
        entityId: deliveryId,
        metadata: { recipients, generatedAt: report.generatedAt.toISOString() },
      },
    });
    sent++;
  }
  return sent;
}
