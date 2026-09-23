import {
  NextRequest,
  NextResponse,
} from "next/server";

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
    },
  );
}

function getBearerToken(
  request: NextRequest,
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

export async function POST(
  request: NextRequest,
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
      },
    });

  if (
    !user ||
    user.role !== "PARENT" ||
    user.status !== "ACTIVE" ||
    user.sessionVersion !==
      payload.sessionVersion
  ) {
    return unauthorized();
  }

  const body =
    (await request.json()) as {
      token?: unknown;
      platform?: unknown;
      deviceId?: unknown;
    };

  if (
    typeof body.token !== "string" ||
    !body.token.trim()
  ) {
    return NextResponse.json(
      {
        error:
          "Push token is required.",
      },
      {
        status: 400,
      },
    );
  }

  const pushToken =
    body.token.trim();

  const platform =
    typeof body.platform === "string"
      ? body.platform.trim() || null
      : null;

  const deviceId =
    typeof body.deviceId === "string"
      ? body.deviceId.trim() || null
      : null;

  const device =
    await prisma.pushDevice.upsert({
      where: {
        token: pushToken,
      },
      update: {
        userId: user.id,
        platform,
        deviceId,
        active: true,
      },
      create: {
        userId: user.id,
        token: pushToken,
        platform,
        deviceId,
        active: true,
      },
      select: {
        id: true,
        active: true,
      },
    });

  return NextResponse.json({
    success: true,
    device,
  });
}