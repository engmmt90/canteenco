import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { createParentPreOrder } from "@/app/actions/preorders";
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
const MobilePreOrderCreateSchema = z.object({
  studentId: z.string().min(1),

  pickupSlotId: z.string().min(1),

  pickupDate: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/),

  idempotencyKey: z
    .string()
    .min(10)
    .max(200),

  items: z
    .array(
      z.object({
        productId:
          z.string().min(1),

        quantity:
          z.number()
            .int()
            .positive()
            .max(99),

        optionIds:
          z.array(
            z.string().min(1),
          )
            .max(30)
            .optional(),
      }),
    )
    .min(1)
    .max(50),
});

export async function POST(
  request: Request,
) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid request body.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }

  const parsed =
    MobilePreOrderCreateSchema.safeParse(
      body,
    );

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Invalid pre-order request.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }

  const result =
    await createParentPreOrder({
      studentId:
        parsed.data.studentId,

      pickupSlotId:
        parsed.data.pickupSlotId,

      pickupDate:
        parsed.data.pickupDate,

      idempotencyKey:
        parsed.data.idempotencyKey,

      items:
        parsed.data.items.map(
          (item) => ({
            productId:
              item.productId,

            quantity:
              item.quantity,

            optionIds:
              item.optionIds ?? [],
          }),
        ),
    });

  if (!result.ok) {
    return NextResponse.json(
      {
        error: result.error,
      },
      {
        status:
          result.error ===
          "Unauthorized"
            ? 401
            : 400,

        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }

  return NextResponse.json(
    {
      success: true,

      orderId:
        result.orderId,

      orderNumber:
        result.orderNumber,

      total:
        Number(result.total),

      balanceAfter:
        Number(
          result.balanceAfter,
        ),

      duplicate:
        result.duplicate ??
        false,
    },
    {
      status:
        result.duplicate
          ? 200
          : 201,

      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}