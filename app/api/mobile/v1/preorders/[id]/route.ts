import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  verifyAccessToken,
} from "@/lib/mobile-auth/tokens";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized." },
    { status: 401 },
  );
}

function getBearerToken(request: Request) {
  const authorization =
    request.headers.get("authorization");

  if (
    !authorization ||
    !authorization.startsWith("Bearer ")
  ) {
    return null;
  }

  return authorization.slice(7).trim();
}

export async function GET(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const token = getBearerToken(request);

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
    user.sessionVersion !== payload.sessionVersion ||
    !user.parentProfile?.wallet
  ) {
    return unauthorized();
  }

  const { id } =
    await context.params;

  const order =
    await prisma.preOrder.findFirst({
      where: {
        id,
        walletId:
          user.parentProfile.wallet.id,
      },

      select: {
        id: true,
        orderNumber: true,
        status: true,
        pickupDate: true,
        total: true,
        createdAt: true,

        student: {
          select: {
            firstName: true,
            lastName: true,
            displayCode: true,
            classCode: true,
          },
        },

        pickupSlot: {
          select: {
            label: true,
            startTime: true,
            endTime: true,
          },
        },

        items: {
          select: {
            id: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,

            product: {
              select: {
                name: true,
                imageUrl: true,
              },
            },

            options: {
              select: {
                optionName: true,
                additionalPrice: true,
              },
            },
          },
        },
      },
    });

  if (!order) {
    return NextResponse.json(
      { error: "Pre-order not found." },
      { status: 404 },
    );
  }

  return NextResponse.json(
    {
      order: {
        id: order.id,
        orderNumber:
          order.orderNumber,
        status:
          String(order.status),
        pickupDate:
          order.pickupDate
            .toISOString()
            .slice(0, 10),
        total:
          Number(order.total),
        createdAt:
          order.createdAt.toISOString(),

        student: {
          name:
            `${order.student.firstName} ${order.student.lastName}`.trim(),
          displayCode:
            order.student.displayCode,
          classCode:
            order.student.classCode,
        },

        pickupSlot: {
          label:
            order.pickupSlot.label,
          startTime:
            order.pickupSlot.startTime,
          endTime:
            order.pickupSlot.endTime,
        },

        items:
          order.items.map(
            (item) => ({
              id: item.id,
              name:
                item.product.name,
              imageUrl:
                item.product.imageUrl,
              quantity:
                item.quantity,
              unitPrice:
                Number(item.unitPrice),
              lineTotal:
                Number(item.lineTotal),

              options:
                item.options.map(
                  (option) => ({
                    name:
                      option.optionName,
                    additionalPrice:
                      Number(
                        option.additionalPrice,
                      ),
                  }),
                ),
            }),
          ),
      },
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}