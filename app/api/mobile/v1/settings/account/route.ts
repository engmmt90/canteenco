import { createHash, randomBytes } from "node:crypto";

import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  verifyAccessToken,
} from "@/lib/mobile-auth/tokens";

export const runtime = "nodejs";

const DeleteAccountSchema = z.object({
  currentPassword: z.string().min(1),
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

function errorResponse(
  message: string,
  status = 400,
) {
  return NextResponse.json(
    {
      error: message,
    },
    {
      status,
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

function identifierHash(
  email: string,
) {
  return createHash("sha256")
    .update(
      email
        .trim()
        .toLowerCase(),
    )
    .digest("hex");
}

export async function DELETE(
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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return errorResponse(
      "Invalid request body.",
    );
  }

  const parsed =
    DeleteAccountSchema.safeParse(
      body,
    );

  if (!parsed.success) {
    return errorResponse(
      "Current password is required.",
    );
  }

  const user =
    await prisma.user.findUnique({
      where: {
        id: payload.sub,
      },

      select: {
        id: true,
        email: true,
        passwordHash: true,
        role: true,
        status: true,
        deletedAt: true,
        sessionVersion: true,

        parentProfile: {
          select: {
            id: true,

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
    user.deletedAt ||
    user.sessionVersion !==
      payload.sessionVersion
  ) {
    return unauthorized();
  }

  const passwordMatches =
    await bcrypt.compare(
      parsed.data.currentPassword,
      user.passwordHash,
    );

  if (!passwordMatches) {
    return errorResponse(
      "Current password is incorrect.",
    );
  }

  const now = new Date();

  const loginHash =
    identifierHash(
      user.email,
    );

  const anonymisedEmail =
    `deleted-${user.id}@deleted.canteengo.invalid`;

  const disabledPasswordHash =
    await bcrypt.hash(
      randomBytes(32).toString("hex"),
      12,
    );

  await prisma.$transaction(
    async (tx) => {
      if (user.parentProfile) {
        const parentId =
          user.parentProfile.id;

        await tx.notificationPreference.updateMany({
          where: {
            parentId,
          },
          data: {
            emailEnabled: false,
            smsEnabled: false,
            pushEnabled: false,
            notifyTopUp: false,
            notifyPurchase: false,
            notifyPreOrder: false,
            notifyPickup: false,
            notifyRefund: false,
            notifyLowBalance: false,
            lowBalanceThreshold: null,
          },
        });

        await tx.student.updateMany({
          where: {
            parentId,
          },
          data: {
            firstName: "Deleted",
            lastName: "Student",
            officialSchoolId: null,
            photoUrl: null,
            nfcCardNumber: null,
            status: "ARCHIVED",
            deletedAt: now,
          },
        });

        if (
          user.parentProfile.wallet
        ) {
          const walletId =
            user.parentProfile.wallet.id;

          await tx.topUpRequest.updateMany({
            where: {
              walletId,
              status: "PENDING",
            },
            data: {
              status: "CANCELLED",
              cancelledAt: now,
            },
          });

          await tx.wallet.update({
            where: {
              id: walletId,
            },
            data: {
              status: "CLOSED",
            },
          });
        }
      }

      await tx.pushDevice.updateMany({
        where: {
          userId: user.id,
        },
        data: {
          active: false,
        },
      });

      await tx.mobileRefreshSession.deleteMany({
        where: {
          userId: user.id,
        },
      });

      await tx.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },
        data: {
          usedAt: now,
        },
      });

      await tx.loginThrottle.deleteMany({
        where: {
          identifierHash:
            loginHash,
        },
      });

      await tx.notification.deleteMany({
        where: {
          userId: user.id,
        },
      });

      await tx.user.update({
        where: {
          id: user.id,
        },
        data: {
          fullName: "Deleted User",
          email: anonymisedEmail,
          phone: null,
          nfcCardNumber: null,
          passwordHash:
            disabledPasswordHash,
          status: "DISABLED",
          deletedAt: now,
          sessionVersion: {
            increment: 1,
          },
        },
      });
    },
  );

  return NextResponse.json(
    {
      success: true,
      requiresLogin: true,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
