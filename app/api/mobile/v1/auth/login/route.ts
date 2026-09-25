import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  authenticateParent,
  getParentLoginThrottleStatus,
} from "@/lib/mobile-auth/authenticate-parent";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  refreshExpiry,
} from "@/lib/mobile-auth/tokens";

export const runtime = "nodejs";

const LoginSchema = z.object({
  email: z
    .string()
    .email(),

  password: z
    .string()
    .min(1),

  portal: z.literal("parent"),
});

function mobileUser(user: {
  id: string;
  email: string;
  fullName: string;
}) {
  const parts =
    user.fullName
      .trim()
      .split(/\s+/)
      .filter(Boolean);

  return {
    id: user.id,
    email: user.email,

    firstName:
      parts.length > 0
        ? parts[0]
        : null,

    lastName:
      parts.length > 1
        ? parts.slice(1).join(" ")
        : null,
  };
}

export async function POST(
  request: Request,
) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error: "Invalid request.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const parsed =
    LoginSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error: "Invalid request.",
      },
      {
        status: 400,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const user =
    await authenticateParent(
      parsed.data.email,
      parsed.data.password,
    );

  if (!user) {
    const throttle =
      await getParentLoginThrottleStatus(
        parsed.data.email,
      );

    const error =
      throttle.blocked
        ? `Account temporarily locked. Try again in ${throttle.minutesRemaining} minute${throttle.minutesRemaining === 1 ? "" : "s"}.`
        : `Invalid email or password. ${throttle.remainingAttempts} attempt${throttle.remainingAttempts === 1 ? "" : "s"} remaining.`;

    return NextResponse.json(
      {
        error,
        blocked: throttle.blocked,
        remainingAttempts:
          throttle.remainingAttempts,
        minutesRemaining:
          throttle.minutesRemaining,
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const refreshToken =
    createRefreshToken();

  await prisma.mobileRefreshSession.create({
    data: {
      userId: user.id,

      tokenHash:
        hashRefreshToken(
          refreshToken,
        ),

      expiresAt:
        refreshExpiry(),
    },
  });

  const accessToken =
    createAccessToken({
      id: user.id,
      email: user.email,
      sessionVersion:
        user.sessionVersion,
    });

  return NextResponse.json(
    {
      accessToken,
      refreshToken,

      expiresIn:
        ACCESS_TOKEN_TTL_SECONDS,

      user:
        mobileUser(user),
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
