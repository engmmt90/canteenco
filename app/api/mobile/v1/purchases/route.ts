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
        purchases: [],
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }

  const sales =
    await prisma.sale.findMany({
      where: {
        walletId,

        studentId: {
          not: null,
        },

        status: {
          not: "VOIDED",
        },
      },

      orderBy: {
        createdAt: "desc",
      },

      take: limit,

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
    });

  const purchases =
    sales.flatMap((sale) => {
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
                    ? `${item.quantity} x ${item.productNameSnapshot}`
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
            sale.createdAt
              .toISOString(),
          summary,
        },
      ];
    });

  return NextResponse.json(
    {
      purchases,
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}