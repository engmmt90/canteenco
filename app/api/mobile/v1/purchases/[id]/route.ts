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
  context: {
    params: Promise<{
      id: string;
    }>;
  },
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
    !user.parentProfile?.wallet
  ) {
    return unauthorized();
  }

  const { id } =
    await context.params;

  const sale =
    await prisma.sale.findFirst({
      where: {
        id,
        walletId:
          user.parentProfile.wallet.id,

        status: {
          not: "VOIDED",
        },
      },

      select: {
        id: true,
        saleNumber: true,
        total: true,
        createdAt: true,
        paymentMethod: true,

        student: {
          select: {
            firstName: true,
            lastName: true,
            displayCode: true,
            classCode: true,
          },
        },

        items: {
          select: {
            id: true,
            productNameSnapshot: true,
            quantity: true,
            unitPrice: true,
            lineTotal: true,

            options: {
              select: {
                optionName: true,
              },
            },
          },
        },
      },
    });

  if (
    !sale ||
    !sale.student
  ) {
    return NextResponse.json(
      {
        error:
          "Purchase not found.",
      },
      {
        status: 404,
      },
    );
  }

  return NextResponse.json(
    {
      purchase: {
        id:
          sale.id,

        saleNumber:
          sale.saleNumber,

        total:
          Number(sale.total),

        createdAt:
          sale.createdAt.toISOString(),

        paymentMethod:
          String(
            sale.paymentMethod,
          ),

        student: {
          name:
            `${sale.student.firstName} ${sale.student.lastName}`
              .trim(),

          displayCode:
            sale.student.displayCode,

          classCode:
            sale.student.classCode,
        },

        items:
          sale.items.map(
            (item) => ({
              id:
                item.id,

              name:
                item.productNameSnapshot,

              quantity:
                item.quantity,

              unitPrice:
                Number(
                  item.unitPrice,
                ),

              lineTotal:
                Number(
                  item.lineTotal,
                ),

              options:
                item.options.map(
                  (option) =>
                    option.optionName,
                ),
            }),
          ),
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