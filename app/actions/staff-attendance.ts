"use server";

import { prisma } from "@/lib/prisma";

const STAFF_ROLES = ["CASHIER", "SCHOOL_ADMIN", "STAFF"] as const;

function isStaffRole(role: string) {
  return STAFF_ROLES.includes(
    role as (typeof STAFF_ROLES)[number],
  );
}

export async function lookupStaffByNfc(
  nfcCardNumber: string,
) {
  const card = nfcCardNumber.trim();

  if (!card) {
    return {
      ok: false as const,
      error: "Please scan an NFC card.",
    };
  }

  const staff = await prisma.user.findUnique({
    where: { nfcCardNumber: card },
    include: {
      school: {
        select: { id: true, name: true },
      },
      staffSchoolAccess: {
        include: {
          school: {
            select: {
              id: true,
              name: true,
              isActive: true,
              deletedAt: true,
            },
          },
        },
      },
    },
  });

  if (
    !staff ||
    !isStaffRole(staff.role) ||
    staff.status !== "ACTIVE" ||
    staff.deletedAt
  ) {
    return {
      ok: false as const,
      error:
        "No active staff member is linked to this NFC card.",
    };
  }

  const openAttendance =
    await prisma.staffAttendance.findFirst({
      where: {
        staffUserId: staff.id,
        clockOutAt: null,
      },
      include: {
        school: {
          select: { name: true },
        },
      },
      orderBy: { clockInAt: "desc" },
    });

  let schools: { id: string; name: string }[] = [];

  if (staff.canWorkAllSchools) {
    schools = await prisma.school.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    });
  } else {
    schools = staff.staffSchoolAccess
      .filter(
        (access) =>
          access.school.isActive &&
          !access.school.deletedAt,
      )
      .map((access) => ({
        id: access.school.id,
        name: access.school.name,
      }))
      .sort((a, b) =>
        a.name.localeCompare(b.name),
      );
  }

  if (
    staff.school &&
    !schools.some(
      (school) =>
        school.id === staff.school?.id,
    )
  ) {
    schools.unshift({
      id: staff.school.id,
      name: staff.school.name,
    });
  }

  if (schools.length === 0) {
    return {
      ok: false as const,
      error:
        "This staff member has no active attendance school access.",
    };
  }

  return {
    ok: true as const,
    staff: {
      id: staff.id,
      fullName: staff.fullName,
      role: staff.role,
      baseSchoolName:
        staff.school?.name ?? null,
    },
    openAttendance: openAttendance
      ? {
          id: openAttendance.id,
          schoolId: openAttendance.schoolId,
          schoolName:
            openAttendance.school.name,
          clockInAt:
            openAttendance.clockInAt.toISOString(),
        }
      : null,
    schools,
  };
}

export async function clockInStaff(input: {
  staffUserId: string;
  schoolId: string;
}) {
  const staff = await prisma.user.findUnique({
    where: { id: input.staffUserId },
    include: {
      school: { select: { id: true } },
      staffSchoolAccess: {
        select: { schoolId: true },
      },
    },
  });

  if (
    !staff ||
    !isStaffRole(staff.role) ||
    staff.status !== "ACTIVE" ||
    staff.deletedAt
  ) {
    return {
      ok: false as const,
      error: "Staff member is not active.",
    };
  }

  const school = await prisma.school.findFirst({
    where: {
      id: input.schoolId,
      isActive: true,
      deletedAt: null,
    },
    select: { id: true, name: true },
  });

  if (!school) {
    return {
      ok: false as const,
      error:
        "Selected school is not available.",
    };
  }

  const hasAccess =
    staff.canWorkAllSchools ||
    staff.school?.id === school.id ||
    staff.staffSchoolAccess.some(
      (access) =>
        access.schoolId === school.id,
    );

  if (!hasAccess) {
    return {
      ok: false as const,
      error:
        "This staff member is not allowed to clock in at this school.",
    };
  }

  const existing =
    await prisma.staffAttendance.findFirst({
      where: {
        staffUserId: staff.id,
        clockOutAt: null,
      },
      include: {
        school: {
          select: { name: true },
        },
      },
      orderBy: { clockInAt: "desc" },
    });

  if (existing) {
    return {
      ok: false as const,
      error: `Already clocked in at ${existing.school.name}.`,
    };
  }

  const attendance =
    await prisma.staffAttendance.create({
      data: {
        staffUserId: staff.id,
        schoolId: school.id,
      },
    });

  return {
    ok: true as const,
    type: "CLOCK_IN" as const,
    fullName: staff.fullName,
    schoolName: school.name,
    timestamp:
      attendance.clockInAt.toISOString(),
  };
}

export async function clockOutStaff(
  staffUserId: string,
) {
  const openAttendance =
    await prisma.staffAttendance.findFirst({
      where: {
        staffUserId,
        clockOutAt: null,
      },
      include: {
        staff: {
          select: { fullName: true },
        },
        school: {
          select: { name: true },
        },
      },
      orderBy: { clockInAt: "desc" },
    });

  if (!openAttendance) {
    return {
      ok: false as const,
      error:
        "No open attendance record was found.",
    };
  }

  const clockOutAt = new Date();

  const updated =
    await prisma.staffAttendance.updateMany({
      where: {
        id: openAttendance.id,
        clockOutAt: null,
      },
      data: { clockOutAt },
    });

  if (updated.count !== 1) {
    return {
      ok: false as const,
      error:
        "Attendance status changed. Please scan the card again.",
    };
  }

  return {
    ok: true as const,
    type: "CLOCK_OUT" as const,
    fullName:
      openAttendance.staff.fullName,
    schoolName:
      openAttendance.school.name,
    timestamp:
      clockOutAt.toISOString(),
  };
}
