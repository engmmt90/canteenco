import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  ACCESS_TOKEN_TTL_SECONDS,
  createAccessToken,
  createRefreshToken,
  hashRefreshToken,
  refreshExpiry,
} from "@/lib/mobile-auth/tokens";

export const runtime = "nodejs";

const RefreshSchema = z.object({
  refreshToken: z.string().min(20),
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
    RefreshSchema.safeParse(body);

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

  const oldTokenHash =
    hashRefreshToken(
      parsed.data.refreshToken,
    );

  const session =
    await prisma.mobileRefreshSession.findUnique({
      where: {
        tokenHash: oldTokenHash,
      },

      include: {
        user: {
          select: {
            id: true,
            fullName: true,
            email: true,
            role: true,
            status: true,
            sessionVersion: true,
          },
        },
      },
    });

  if (!session) {
    return NextResponse.json(
      {
        error:
          "Invalid refresh token.",
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  if (
    session.expiresAt.getTime() <=
    Date.now()
  ) {
    await prisma.mobileRefreshSession.delete({
      where: {
        id: session.id,
      },
    });

    return NextResponse.json(
      {
        error:
          "Refresh token expired.",
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const user = session.user;

  if (
    user.status !== "ACTIVE" ||
    user.role !== "PARENT"
  ) {
    await prisma.mobileRefreshSession.delete({
      where: {
        id: session.id,
      },
    });

    return NextResponse.json(
      {
        error:
          "Account is not available.",
      },
      {
        status: 401,
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const newRefreshToken =
    createRefreshToken();

  await prisma.mobileRefreshSession.update({
    where: {
      id: session.id,
    },

    data: {
      tokenHash:
        hashRefreshToken(
          newRefreshToken,
        ),

      expiresAt:
        refreshExpiry(),

      lastUsedAt:
        new Date(),
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

      refreshToken:
        newRefreshToken,

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
