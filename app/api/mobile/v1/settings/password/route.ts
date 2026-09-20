import { createHash } from "node:crypto";

import bcrypt from "bcryptjs";
import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  verifyAccessToken,
} from "@/lib/mobile-auth/tokens";

export const runtime = "nodejs";

const PasswordSchema = z.object({
  currentPassword: z.string(),
  newPassword: z.string(),
  confirmPassword: z.string(),
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

export async function PUT(
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
    PasswordSchema.safeParse(body);

  if (!parsed.success) {
    return errorResponse(
      "Invalid request body.",
    );
  }

  const {
    currentPassword,
    newPassword,
    confirmPassword,
  } = parsed.data;

  if (
    !currentPassword ||
    !newPassword ||
    !confirmPassword
  ) {
    return errorResponse(
      "All password fields are required.",
    );
  }

  if (newPassword.length < 8) {
    return errorResponse(
      "New password must be at least 8 characters.",
    );
  }

  if (
    newPassword !==
    confirmPassword
  ) {
    return errorResponse(
      "New passwords do not match.",
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
        role: true,
        status: true,
        deletedAt: true,
        passwordHash: true,
        sessionVersion: true,
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

  const currentMatches =
    await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

  if (!currentMatches) {
    return errorResponse(
      "Current password is incorrect.",
    );
  }

  const sameAsCurrent =
    await bcrypt.compare(
      newPassword,
      user.passwordHash,
    );

  if (sameAsCurrent) {
    return errorResponse(
      "New password must be different from your current password.",
    );
  }

  const newPasswordHash =
    await bcrypt.hash(
      newPassword,
      12,
    );

  const now =
    new Date();

  const loginHash =
    identifierHash(
      user.email,
    );

  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: user.id,
      },

      data: {
        passwordHash:
          newPasswordHash,

        sessionVersion: {
          increment: 1,
        },
      },
    }),

    prisma.mobileRefreshSession.deleteMany({
      where: {
        userId: user.id,
      },
    }),

    prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },

      data: {
        usedAt: now,
      },
    }),

    prisma.loginThrottle.deleteMany({
      where: {
        identifierHash:
          loginHash,
      },
    }),
  ]);

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