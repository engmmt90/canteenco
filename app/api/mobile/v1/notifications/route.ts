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

  const rows =
    await prisma.notification.findMany({
      where: {
        userId: user.id,
        channel: "IN_APP",
      },

      orderBy: {
        createdAt: "desc",
      },

      take: limit,

      select: {
        id: true,
        subject: true,
        message: true,
        createdAt: true,
      },
    });

  const notifications =
    rows.map((notification) => ({
      id: notification.id,

      title:
        notification.subject ??
        "CanteenCo notification",

      message:
        notification.message,

      createdAt:
        notification.createdAt
          .toISOString(),

      readAt: null,
    }));

  return NextResponse.json(
    {
      notifications,
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}