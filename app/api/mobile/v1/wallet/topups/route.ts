import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  verifyAccessToken,
} from "@/lib/mobile-auth/tokens";
import { queueParentNotification } from "@/lib/notifications";
import {
  NotificationEvent,
} from "@/generated/prisma/client";

export const runtime = "nodejs";

const CreateTopUpSchema = z.object({
  amount: z
    .number()
    .finite()
    .min(1)
    .max(1000)
    .refine(
      (value) =>
        Math.abs(
          value * 100 -
            Math.round(value * 100),
        ) < 0.000001,
      {
        message:
          "Amount can have a maximum of two decimal places.",
      },
    ),
});

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

async function getParentWallet(
  request: Request,
) {
  const token =
    getBearerToken(request);

  if (!token) {
    return null;
  }

  const payload =
    verifyAccessToken(token);

  if (!payload) {
    return null;
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
            id: true,

            wallet: {
              select: {
                id: true,
                status: true,
                balance: true,
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
    return null;
  }

  return {
    userId: user.id,
    parentId:
      user.parentProfile.id,
    wallet:
      user.parentProfile.wallet,
  };
}

export async function GET(
  request: Request,
) {
  const parent =
    await getParentWallet(request);

  if (!parent) {
    return unauthorized();
  }

  if (!parent.wallet) {
    return NextResponse.json(
      {
        walletActive: false,
        balance: 0,
        requests: [],
      },
      {
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }

  const requests =
    await prisma.topUpRequest.findMany({
      where: {
        walletId:
          parent.wallet.id,
        requestedById:
          parent.userId,
      },

      orderBy: {
        createdAt: "desc",
      },

      take: 20,

      select: {
        id: true,
        amount: true,
        status: true,
        confirmedAt: true,
        cancelledAt: true,
        createdAt: true,
      },
    });

  return NextResponse.json(
    {
      walletActive:
        parent.wallet.status ===
        "ACTIVE",

      balance:
        Number(
          parent.wallet.balance,
        ),

      requests:
        requests.map(
          (item) => ({
            id: item.id,
            amount:
              Number(item.amount),
            status:
              item.status,
            confirmedAt:
              item.confirmedAt?.toISOString() ??
              null,
            cancelledAt:
              item.cancelledAt?.toISOString() ??
              null,
            createdAt:
              item.createdAt.toISOString(),
          }),
        ),
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}

export async function POST(
  request: Request,
) {
  const parent =
    await getParentWallet(request);

  if (!parent) {
    return unauthorized();
  }

  if (!parent.wallet) {
    return NextResponse.json(
      {
        error:
          "Your family wallet is not available yet.",
      },
      {
        status: 400,
      },
    );
  }

  if (
    parent.wallet.status !==
    "ACTIVE"
  ) {
    return NextResponse.json(
      {
        error:
          "Your family wallet is not active.",
      },
      {
        status: 400,
      },
    );
  }

  let json: unknown;

  try {
    json =
      await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid request body.",
      },
      {
        status: 400,
      },
    );
  }

  const parsed =
    CreateTopUpSchema.safeParse(
      json,
    );

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]
            ?.message ??
          "Enter a valid top-up amount.",
      },
      {
        status: 400,
      },
    );
  }

  const amount =
    parsed.data.amount;

  const created =
    await prisma.$transaction(
      async (tx) => {
        const request =
          await tx.topUpRequest.create({
            data: {
              walletId:
                parent.wallet!.id,

              requestedById:
                parent.userId,

              amount,

              status:
                "PENDING",
            },
          });

        await queueParentNotification({
          tx,

          userId:
            parent.userId,

          parentId:
            parent.parentId,

          event:
            NotificationEvent.TOPUP_REQUESTED,

          preferenceKey:
            "notifyTopUp",

          subject:
            "Top-up request received",

          message:
            `We received your request to add $${amount.toFixed(
              2,
            )} to your CanteenCo family wallet. The balance will update after cash payment is confirmed by the administrator.`,

          metadata: {
            topUpRequestId:
              request.id,
            amount,
          },
        });

        return request;
      },
    );

  return NextResponse.json(
    {
      success: true,

      request: {
        id:
          created.id,

        amount:
          Number(
            created.amount,
          ),

        status:
          created.status,

        createdAt:
          created.createdAt.toISOString(),
      },
    },
    {
      status: 201,
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}