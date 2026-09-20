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
        role: true,
        status: true,
        sessionVersion: true,

        parentProfile: {
          select: {
            wallet: {
              select: {
                balance: true,

                transactions: {
                  orderBy: {
                    createdAt: "desc",
                  },

                  take: 50,

                  select: {
                    id: true,
                    type: true,
                    amount: true,
                    balanceAfter: true,
                    description: true,
                    createdAt: true,
                  },
                },
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

  const wallet =
    user.parentProfile.wallet;

  if (!wallet) {
    return NextResponse.json(
      {
        balance: 0,
        transactions: [],
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }

  const transactions =
    wallet.transactions.map(
      (transaction) => ({
        id: transaction.id,

        amount:
          Number(
            transaction.amount,
          ),

        balanceAfter:
          Number(
            transaction.balanceAfter,
          ),

        description:
          transaction.description ??
          String(transaction.type)
            .replaceAll("_", " ")
            .toLowerCase(),

        createdAt:
          transaction.createdAt
            .toISOString(),
      }),
    );

  return NextResponse.json(
    {
      balance:
        Number(wallet.balance),

      transactions,
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}