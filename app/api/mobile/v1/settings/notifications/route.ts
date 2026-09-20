import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  verifyAccessToken,
} from "@/lib/mobile-auth/tokens";

export const runtime = "nodejs";

const PreferencesSchema = z.object({
  emailEnabled: z.boolean(),
  smsEnabled: z.boolean(),
  pushEnabled: z.boolean(),
  notifyTopUp: z.boolean(),
  notifyPurchase: z.boolean(),
  notifyPreOrder: z.boolean(),
  notifyPickup: z.boolean(),
  notifyRefund: z.boolean(),
  notifyLowBalance: z.boolean(),
  lowBalanceThreshold: z
    .number()
    .min(0)
    .max(1000)
    .nullable(),
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

async function getParent(
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
        role: true,
        status: true,
        sessionVersion: true,

        parentProfile: {
          select: {
            id: true,

            notificationPreference: {
              select: {
                emailEnabled: true,
                smsEnabled: true,
                pushEnabled: true,
                notifyTopUp: true,
                notifyPurchase: true,
                notifyPreOrder: true,
                notifyPickup: true,
                notifyRefund: true,
                notifyLowBalance: true,
                lowBalanceThreshold: true,
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

  return user.parentProfile;
}

function serializePreferences(
  preference:
    | {
        emailEnabled: boolean;
        smsEnabled: boolean;
        pushEnabled: boolean;
        notifyTopUp: boolean;
        notifyPurchase: boolean;
        notifyPreOrder: boolean;
        notifyPickup: boolean;
        notifyRefund: boolean;
        notifyLowBalance: boolean;
        lowBalanceThreshold: unknown;
      }
    | null,
) {
  return {
    emailEnabled:
      preference?.emailEnabled ??
      true,

    smsEnabled:
      preference?.smsEnabled ??
      false,

    pushEnabled:
      preference?.pushEnabled ??
      false,

    notifyTopUp:
      preference?.notifyTopUp ??
      true,

    notifyPurchase:
      preference?.notifyPurchase ??
      true,

    notifyPreOrder:
      preference?.notifyPreOrder ??
      true,

    notifyPickup:
      preference?.notifyPickup ??
      true,

    notifyRefund:
      preference?.notifyRefund ??
      true,

    notifyLowBalance:
      preference?.notifyLowBalance ??
      true,

    lowBalanceThreshold:
      preference
        ? preference.lowBalanceThreshold ===
          null
          ? null
          : Number(
              preference.lowBalanceThreshold,
            )
        : 10,
  };
}

export async function GET(
  request: Request,
) {
  const parent =
    await getParent(request);

  if (!parent) {
    return unauthorized();
  }

  return NextResponse.json(
    serializePreferences(
      parent.notificationPreference,
    ),
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}

export async function PUT(
  request: Request,
) {
  const parent =
    await getParent(request);

  if (!parent) {
    return unauthorized();
  }

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
      },
    );
  }

  const parsed =
    PreferencesSchema.safeParse(
      body,
    );

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Invalid notification preferences.",
      },
      {
        status: 400,
      },
    );
  }

  const input =
    parsed.data;

  const preference =
    await prisma.notificationPreference.upsert({
      where: {
        parentId: parent.id,
      },

      create: {
        parentId:
          parent.id,

        emailEnabled:
          input.emailEnabled,

        smsEnabled:
          input.smsEnabled,

        pushEnabled:
          input.pushEnabled,

        notifyTopUp:
          input.notifyTopUp,

        notifyPurchase:
          input.notifyPurchase,

        notifyPreOrder:
          input.notifyPreOrder,

        notifyPickup:
          input.notifyPickup,

        notifyRefund:
          input.notifyRefund,

        notifyLowBalance:
          input.notifyLowBalance,

        lowBalanceThreshold:
          input.notifyLowBalance
            ? input.lowBalanceThreshold
            : null,
      },

      update: {
        emailEnabled:
          input.emailEnabled,

        smsEnabled:
          input.smsEnabled,

        pushEnabled:
          input.pushEnabled,

        notifyTopUp:
          input.notifyTopUp,

        notifyPurchase:
          input.notifyPurchase,

        notifyPreOrder:
          input.notifyPreOrder,

        notifyPickup:
          input.notifyPickup,

        notifyRefund:
          input.notifyRefund,

        notifyLowBalance:
          input.notifyLowBalance,

        lowBalanceThreshold:
          input.notifyLowBalance
            ? input.lowBalanceThreshold
            : null,
      },

      select: {
        emailEnabled: true,
        smsEnabled: true,
        pushEnabled: true,
        notifyTopUp: true,
        notifyPurchase: true,
        notifyPreOrder: true,
        notifyPickup: true,
        notifyRefund: true,
        notifyLowBalance: true,
        lowBalanceThreshold: true,
      },
    });

  return NextResponse.json(
    serializePreferences(
      preference,
    ),
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}