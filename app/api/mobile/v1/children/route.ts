import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import { PreOrderStatus } from "@/generated/prisma/client";
import {
  verifyAccessToken,
} from "@/lib/mobile-auth/tokens";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized." },
    {
      status: 401,
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}

function getBearerToken(
  request: Request,
) {
  const authorization =
    request.headers.get("authorization");

  if (
    !authorization ||
    !authorization.startsWith("Bearer ")
  ) {
    return null;
  }

  return authorization
    .slice(7)
    .trim();
}

export async function GET(
  request: Request,
) {
  const token =
    getBearerToken(request);

  if (!token) {
    return unauthorized();
  }

  const payload =
    verifyAccessToken(token);

  if (!payload) {
    return unauthorized();
  }

  const user =
    await prisma.user.findUnique({
      where: {
        id: payload.sub,
      },

      select: {
        id: true,
        role: true,
        status: true,
        sessionVersion: true,

        parentProfile: {
          select: {
            students: {
              where: {
                status: "ACTIVE",
                deletedAt: null,
              },

              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayCode: true,
                classCode: true,
                dailySpendLimit: true,
              },

              orderBy: [
                {
                  firstName: "asc",
                },
                {
                  lastName: "asc",
                },
              ],
            },
          },
        },
      },
    });

  if (
    !user ||
    user.status !== "ACTIVE" ||
    user.role !== "PARENT" ||
    user.sessionVersion !==
      payload.sessionVersion ||
    !user.parentProfile
  ) {
    return unauthorized();
  }

  const students =
    user.parentProfile.students;

  const studentIds =
    students.map(
      (student) => student.id,
    );

  const startOfToday =
    new Date();

  startOfToday.setHours(
    0,
    0,
    0,
    0,
  );

  const startOfTomorrow =
    new Date(startOfToday);

  startOfTomorrow.setDate(
    startOfTomorrow.getDate() + 1,
  );

  const [
    salesToday,
    preOrdersToday,
  ] =
    studentIds.length > 0
      ? await Promise.all([
          prisma.sale.groupBy({
            by: ["studentId"],

            where: {
              studentId: {
                in: studentIds,
              },

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

          prisma.preOrder.groupBy({
            by: ["studentId"],

            where: {
              studentId: {
                in: studentIds,
              },

              createdAt: {
                gte: startOfToday,
                lt: startOfTomorrow,
              },

              status: {
                in: [
                  PreOrderStatus.CONFIRMED,
                  PreOrderStatus.PREPARING,
                  PreOrderStatus.READY,
                  PreOrderStatus.PICKED_UP,
                ],
              },
            },

            _sum: {
              total: true,
            },
          }),
        ])
      : [[], []];

  const spentByStudent =
    new Map<string, number>();

  for (const row of salesToday) {
    if (row.studentId) {
      spentByStudent.set(
        row.studentId,
        Number(
          row._sum.total ?? 0,
        ),
      );
    }
  }

  for (const row of preOrdersToday) {
    if (row.studentId) {
      const current =
        spentByStudent.get(
          row.studentId,
        ) ?? 0;

      spentByStudent.set(
        row.studentId,
        current +
          Number(
            row._sum.total ?? 0,
          ),
      );
    }
  }

  const children =
    students.map(
      (student) => {
        const spentToday =
          spentByStudent.get(
            student.id,
          ) ?? 0;

        const dailySpendLimit =
          student.dailySpendLimit ===
          null
            ? null
            : Number(
                student.dailySpendLimit,
              );

        const remainingToday =
          dailySpendLimit === null
            ? null
            : Math.max(
                dailySpendLimit -
                  spentToday,
                0,
              );

        return {
          id: student.id,
          firstName:
            student.firstName,
          lastName:
            student.lastName,
          displayCode:
            student.displayCode,
          classCode:
            student.classCode,
          dailySpendLimit,
          spentToday,
          remainingToday,
        };
      },
    );

  return NextResponse.json(
    {
      children,
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}