"use server";

import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { UserRole } from "@/generated/prisma/client";
import { DEFAULT_SCHOOL_TIMEZONE, getSchoolDayBounds } from "@/lib/school-day";

const STAFF_ROLES: UserRole[] = [
  UserRole.SUPER_ADMIN,
  UserRole.SCHOOL_ADMIN,
  UserRole.CASHIER,
];

export async function getStudentDailySpending(
  studentId: string,
) {
  const session = await auth();

  if (
    !session?.user?.id ||
    !STAFF_ROLES.includes(
      session.user.role as UserRole,
    )
  ) {
    throw new Error("Unauthorized");
  }

  if (!studentId) {
    throw new Error("Student ID is required");
  }

  const student =
    await prisma.student.findUnique({
      where: {
        id: studentId,
      },
      select: {
        id: true,
        dailySpendLimit: true,
        school: {
          select: {
            settings: {
              select: {
                timezone: true,
              },
            },
          },
        },
      },
    });

  if (!student) {
    throw new Error("Student not found");
  }

  const { start: startOfToday, end: startOfTomorrow } =
    getSchoolDayBounds(
      new Date(),
      student.school.settings?.timezone ??
        DEFAULT_SCHOOL_TIMEZONE,
    );

  const [
    salesToday,
    preOrdersToday,
  ] = await Promise.all([
    prisma.sale.aggregate({
      where: {
        studentId: student.id,
        createdAt: {
          gte: startOfToday,
          lt: startOfTomorrow,
        },
        status: "COMPLETED",
      },
      _sum: {
        total: true,
      },
    }),

    prisma.preOrder.aggregate({
      where: {
        studentId: student.id,
        createdAt: {
          gte: startOfToday,
          lt: startOfTomorrow,
        },
        status: {
          in: [
            "CONFIRMED",
            "PREPARING",
            "READY",
            "PICKED_UP",
          ],
        },
      },
      _sum: {
        total: true,
      },
    }),
  ]);

  const salesSpent = Number(
    salesToday._sum.total ?? 0,
  );

  const preOrdersSpent = Number(
    preOrdersToday._sum.total ?? 0,
  );

  const spentToday =
    salesSpent + preOrdersSpent;

  const dailyLimit =
    student.dailySpendLimit === null
      ? null
      : Number(student.dailySpendLimit);

  const remainingToday =
    dailyLimit === null
      ? null
      : Math.max(
          0,
          dailyLimit - spentToday,
        );

  return {
    dailyLimit,
    spentToday,
    remainingToday,
  };
}