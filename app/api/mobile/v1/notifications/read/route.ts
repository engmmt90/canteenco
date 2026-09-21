import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";
import {
  verifyAccessToken,
} from "@/lib/mobile-auth/tokens";

export const runtime = "nodejs";

function unauthorized() {
  return NextResponse.json(
    { error: "Unauthorized." },
    { status: 401 },
  );
}

function getBearerToken(request: Request) {
  const authorization =
    request.headers.get("authorization");

  if (
    !authorization ||
    !authorization.startsWith("Bearer ")
  ) {
    return null;
  }

  return authorization.slice(7).trim();
}

async function getUser(request: Request) {
  const token = getBearerToken(request);

  if (!token) return null;

  const payload =
    verifyAccessToken(token);

  if (!payload) return null;

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
    return null;
  }

  return user;
}

export async function PUT(
  request: Request,
) {
  const user =
    await getUser(request);

  if (!user) {
    return unauthorized();
  }

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  if (
    !body ||
    typeof body !== "object"
  ) {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const notificationId =
    "notificationId" in body &&
    typeof body.notificationId === "string"
      ? body.notificationId.trim()
      : "";

  const markAll =
    "markAll" in body &&
    body.markAll === true;

  const now = new Date();

  if (markAll) {
    await prisma.notification.updateMany({
      where: {
        userId: user.id,
        channel: "IN_APP",
        parentReadAt: null,
      },
      data: {
        parentReadAt: now,
      },
    });

    return NextResponse.json({
      success: true,
      markAll: true,
      readAt: now.toISOString(),
    });
  }

  if (!notificationId) {
    return NextResponse.json(
      { error: "Notification ID is required." },
      { status: 400 },
    );
  }

  const updated =
    await prisma.notification.updateMany({
      where: {
        id: notificationId,
        userId: user.id,
        channel: "IN_APP",
      },
      data: {
        parentReadAt: now,
      },
    });

  if (updated.count !== 1) {
    return NextResponse.json(
      { error: "Notification not found." },
      { status: 404 },
    );
  }

  return NextResponse.json({
    success: true,
    notificationId,
    readAt: now.toISOString(),
  });
}