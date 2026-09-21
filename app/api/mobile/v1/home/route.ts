import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  verifyAccessToken,
} from "@/lib/mobile-auth/tokens";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json(
    {
      error: "Unauthorized.",
    },
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
    request.headers.get(
      "authorization",
    );

  if (
    !authorization ||
    !authorization.startsWith(
      "Bearer ",
    )
  ) {
    return null;
  }

  return authorization
    .slice(7)
    .trim();
}

function splitName(
  fullName: string,
) {
  const parts =
    fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  return {
    firstName:
      parts[0] ?? null,

    lastName:
      parts.length > 1
        ? parts.slice(1).join(" ")
        : null,
  };
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
        fullName: true,
        email: true,
        role: true,
        status: true,
        sessionVersion: true,

        parentProfile: {
          select: {
            id: true,

            wallet: {
              select: {
                balance: true,
              },
            },

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

  const spendingRows =
    studentIds.length > 0
      ? await prisma.sale.groupBy({
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
              not: "VOIDED",
            },
          },

          _sum: {
            total: true,
          },
        })
      : [];

  const spentByStudent =
    new Map<string, number>();

  for (
    const row of spendingRows
  ) {
    if (row.studentId) {
      spentByStudent.set(
        row.studentId,
        Number(
          row._sum.total ?? 0,
        ),
      );
    }
  }

  const recentSales =
    studentIds.length > 0
      ? await prisma.sale.findMany({
          where: {
            studentId: {
              in: studentIds,
            },

            status: {
              not: "VOIDED",
            },
          },

          select: {
            id: true,
            saleNumber: true,
            studentId: true,
            total: true,
            createdAt: true,

            student: {
              select: {
                firstName: true,
                lastName: true,
              },
            },

            items: {
              select: {
                productNameSnapshot:
                  true,
                quantity: true,
              },
            },
          },

          orderBy: {
            createdAt: "desc",
          },

          take: 10,
        })
      : [];

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

  const recentPurchases =
    recentSales.flatMap(
      (sale) => {
        if (
          !sale.studentId ||
          !sale.student
        ) {
          return [];
        }

        const studentName =
          `${sale.student.firstName} ${sale.student.lastName}`
            .trim();

        const summary =
          sale.items.length > 0
            ? sale.items
                .map(
                  (item) =>
                    item.quantity > 1
                      ? `${item.quantity}Ãƒâ€” ${item.productNameSnapshot}`
                      : item.productNameSnapshot,
                )
                .join(", ")
            : "Purchase";

        return [
          {
            id: sale.id,
            saleNumber:
              sale.saleNumber,
            studentId:
              sale.studentId,
            studentName,
            total:
              Number(sale.total),
            createdAt:
              sale.createdAt.toISOString(),
            summary,
          },
        ];
      },
    );

  const name =
    splitName(user.fullName);

  const unreadNotifications =
    await prisma.notification.count({
      where: {
        userId: user.id,
        channel: "IN_APP",
        parentReadAt: null,
      },
    });

  return NextResponse.json(
    {
      user: {
        id: user.id,
        email: user.email,
        firstName:
          name.firstName,
        lastName:
          name.lastName,
      },

      walletBalance:
        Number(
          user.parentProfile
            .wallet?.balance ?? 0,
        ),

      children,
      recentPurchases,
      unreadNotifications,
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}
