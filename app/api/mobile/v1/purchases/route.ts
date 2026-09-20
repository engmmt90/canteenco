import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
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

function startOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(0, 0, 0, 0);
  return result;
}

function endOfDay(date: Date) {
  const result = new Date(date);
  result.setHours(23, 59, 59, 999);
  return result;
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
        role: true,
        status: true,
        sessionVersion: true,

        parentProfile: {
          select: {
            students: {
              where: {
                deletedAt: null,
              },

              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayCode: true,
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
    user.role !== "PARENT" ||
    user.status !== "ACTIVE" ||
    user.sessionVersion !==
      payload.sessionVersion ||
    !user.parentProfile
  ) {
    return unauthorized();
  }

  const url =
    new URL(request.url);

  const selectedStudentId =
    (
      url.searchParams.get(
        "studentId",
      ) ?? ""
    ).trim();

  const fromParam =
    (
      url.searchParams.get(
        "from",
      ) ?? ""
    ).trim();

  const toParam =
    (
      url.searchParams.get(
        "to",
      ) ?? ""
    ).trim();

  const rawLimit =
    url.searchParams.get(
      "limit",
    );

  let limit:
    | number
    | undefined;

  if (rawLimit) {
    const parsed =
      Number.parseInt(
        rawLimit,
        10,
      );

    if (
      Number.isFinite(parsed) &&
      parsed > 0
    ) {
      limit =
        Math.min(
          parsed,
          200,
        );
    }
  }

  const today =
    new Date();

  const defaultFrom =
    startOfDay(today);

  const defaultTo =
    endOfDay(today);

  let fromDate =
    defaultFrom;

  let toDate =
    defaultTo;

  if (fromParam) {
    const parsedFrom =
      new Date(
        `${fromParam}T00:00:00`,
      );

    if (
      !Number.isNaN(
        parsedFrom.getTime(),
      )
    ) {
      fromDate =
        parsedFrom;
    }
  }

  if (toParam) {
    const parsedTo =
      new Date(
        `${toParam}T23:59:59.999`,
      );

    if (
      !Number.isNaN(
        parsedTo.getTime(),
      )
    ) {
      toDate =
        parsedTo;
    }
  }

  const students =
    user.parentProfile.students;

  const studentIds =
    students.map(
      (student) =>
        student.id,
    );

  const validSelectedStudentId =
    selectedStudentId &&
    studentIds.includes(
      selectedStudentId,
    )
      ? selectedStudentId
      : "";

  const filteredStudentIds =
    validSelectedStudentId
      ? [
          validSelectedStudentId,
        ]
      : studentIds;

  if (
    filteredStudentIds.length ===
    0
  ) {
    return NextResponse.json(
      {
        students: [],
        purchases: [],

        summary: {
          count: 0,
          totalSpent: 0,
        },

        filters: {
          studentId: "",
          from:
            fromParam ||
            defaultFrom
              .toISOString()
              .slice(0, 10),
          to:
            toParam ||
            defaultTo
              .toISOString()
              .slice(0, 10),
        },
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }

  const [sales, preOrders] =
    await Promise.all([
      prisma.sale.findMany({
        where: {
          studentId: {
            in:
              filteredStudentIds,
          },

          createdAt: {
            gte: fromDate,
            lte: toDate,
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
              displayCode: true,
            },
          },

          items: {
            select: {
              productNameSnapshot:
                true,
              quantity: true,

              options: {
                select: {
                  optionName: true,
                },
              },
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },

        take: limit,
      }),

      prisma.preOrder.findMany({
        where: {
          studentId: {
            in:
              filteredStudentIds,
          },

          createdAt: {
            gte: fromDate,
            lte: toDate,
          },

          status: {
            not: "CANCELLED",
          },
        },

        select: {
          id: true,
          orderNumber: true,
          studentId: true,
          total: true,
          createdAt: true,

          student: {
            select: {
              firstName: true,
              lastName: true,
              displayCode: true,
            },
          },

          items: {
            select: {
              quantity: true,

              product: {
                select: {
                  name: true,
                },
              },

              options: {
                select: {
                  optionName: true,
                },
              },
            },
          },
        },

        orderBy: {
          createdAt: "desc",
        },

        take: limit,
      }),
    ]);

  const salePurchases =
    sales.flatMap(
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

        const items =
          sale.items.map(
            (item) => ({
              name:
                item.productNameSnapshot,

              quantity:
                item.quantity,

              options:
                item.options.map(
                  (option) =>
                    option.optionName,
                ),
            }),
          );

        const summary =
          items.length > 0
            ? items
                .map(
                  (item) =>
                    item.quantity >
                    1
                      ? `${item.quantity} x ${item.name}`
                      : item.name,
                )
                .join(", ")
            : "Purchase";

        return [
          {
            id: sale.id,

            saleNumber:
              sale.saleNumber,

            number:
              sale.saleNumber,

            type:
              "Purchase",

            studentId:
              sale.studentId,

            studentName,

            displayCode:
              sale.student.displayCode,

            total:
              Number(
                sale.total,
              ),

            createdAt:
              sale.createdAt
                .toISOString(),

            summary,

            items,

            sortDate:
              sale.createdAt,
          },
        ];
      },
    );

  const preOrderPurchases =
    preOrders.map(
      (order) => {
        const studentName =
          `${order.student.firstName} ${order.student.lastName}`
            .trim();

        const items =
          order.items.map(
            (item) => ({
              name:
                item.product.name,

              quantity:
                item.quantity,

              options:
                item.options.map(
                  (option) =>
                    option.optionName,
                ),
            }),
          );

        const summary =
          items.length > 0
            ? items
                .map(
                  (item) =>
                    item.quantity >
                    1
                      ? `${item.quantity} x ${item.name}`
                      : item.name,
                )
                .join(", ")
            : "Pre-Order";

        return {
          id: order.id,

          saleNumber:
            order.orderNumber,

          number:
            order.orderNumber,

          type:
            "Pre-Order",

          studentId:
            order.studentId,

          studentName,

          displayCode:
            order.student.displayCode,

          total:
            Number(
              order.total,
            ),

          createdAt:
            order.createdAt
              .toISOString(),

          summary,

          items,

          sortDate:
            order.createdAt,
        };
      },
    );

  const combined =
    [
      ...salePurchases,
      ...preOrderPurchases,
    ].sort(
      (a, b) =>
        b.sortDate.getTime() -
        a.sortDate.getTime(),
    );

  const totalSpent =
    combined.reduce(
      (sum, purchase) =>
        sum +
        purchase.total,
      0,
    );

  const purchases =
    combined.map(
      ({
        sortDate: _sortDate,
        ...purchase
      }) => purchase,
    );

  return NextResponse.json(
    {
      students:
        students.map(
          (student) => ({
            id:
              student.id,

            firstName:
              student.firstName,

            lastName:
              student.lastName,

            displayCode:
              student.displayCode,
          }),
        ),

      purchases,

      summary: {
        count:
          purchases.length,

        totalSpent,
      },

      filters: {
        studentId:
          validSelectedStudentId,

        from:
          fromParam ||
          defaultFrom
            .toISOString()
            .slice(0, 10),

        to:
          toParam ||
          defaultTo
            .toISOString()
            .slice(0, 10),
      },
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}