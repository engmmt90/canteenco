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
            wallet: {
              select: {
                id: true,
              },
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

  const rawLimit =
    Number.parseInt(
      url.searchParams.get(
        "limit",
      ) ?? "50",
      10,
    );

  const limit =
    Number.isFinite(rawLimit) &&
    rawLimit > 0
      ? Math.min(rawLimit, 100)
      : 50;

  const walletId =
    user.parentProfile.wallet?.id;

  if (!walletId) {
    return NextResponse.json(
      {
        preOrders: [],
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }

  const orders =
    await prisma.preOrder.findMany({
      where: {
        walletId,
      },

      orderBy: {
        createdAt: "desc",
      },

      take: limit,

      select: {
        id: true,
        status: true,
        total: true,
        createdAt: true,

        student: {
          select: {
            firstName: true,
            lastName: true,
          },
        },

        pickupSlot: {
          select: {
            label: true,
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
    });

  const preOrders =
    orders.map((order) => {
      const studentName =
        `${order.student.firstName} ${order.student.lastName}`
          .trim();

      const itemsSummary =
        order.items.length > 0
          ? order.items
              .map((item) => {
                const options =
                  item.options.length > 0
                    ? ` (${item.options
                        .map(
                          (option) =>
                            option.optionName,
                        )
                        .join(", ")})`
                    : "";

                return `${item.quantity} x ${item.product.name}${options}`;
              })
              .join(", ")
          : "Pre-order";

      return {
        id: order.id,
        studentName,
        pickupSlot:
          order.pickupSlot.label,
        status:
          String(order.status),
        total:
          Number(order.total),
        createdAt:
          order.createdAt.toISOString(),
        itemsSummary,
      };
    });

  return NextResponse.json(
    {
      preOrders,
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}