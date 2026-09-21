import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  verifyAccessToken,
} from "@/lib/mobile-auth/tokens";

export const runtime = "nodejs";

const UpdateLimitSchema = z.object({
  dailySpendLimit: z
    .number()
    .finite()
    .min(0)
    .max(1000)
    .nullable(),
});

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

export async function PUT(
  request: Request,
  context: {
    params: Promise<{ id: string }>;
  },
) {
  const token = getBearerToken(request);

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
        parentProfile: {
          select: {
            id: true,
          },
        },
      },
    });

  if (
    !user ||
    user.role !== "PARENT" ||
    user.status !== "ACTIVE" ||
    user.sessionVersion !== payload.sessionVersion ||
    !user.parentProfile
  ) {
    return unauthorized();
  }

  const { id: studentId } =
    await context.params;

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      { error: "Invalid request body." },
      { status: 400 },
    );
  }

  const parsed =
    UpdateLimitSchema.safeParse(body);

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          parsed.error.issues[0]?.message ??
          "Invalid daily limit.",
      },
      { status: 400 },
    );
  }

  const student =
    await prisma.student.findUnique({
      where: {
        id: studentId,
      },
      select: {
        id: true,
        parentId: true,
        firstName: true,
        lastName: true,
        deletedAt: true,
      },
    });

  if (!student) {
    return NextResponse.json(
      { error: "Student not found." },
      { status: 404 },
    );
  }

  if (student.deletedAt) {
    return NextResponse.json(
      {
        error:
          "This student is no longer active.",
      },
      { status: 400 },
    );
  }

  if (
    student.parentId !==
    user.parentProfile.id
  ) {
    return unauthorized();
  }

  const dailySpendLimit =
    parsed.data.dailySpendLimit === null
      ? null
      : Math.round(
          parsed.data.dailySpendLimit * 100,
        ) / 100;

  await prisma.$transaction(
    async (tx) => {
      await tx.student.update({
        where: {
          id: student.id,
        },
        data: {
          dailySpendLimit,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId: user.id,
          action:
            "UPDATE_STUDENT_DAILY_LIMIT",
          entityType: "Student",
          entityId: student.id,
          metadata: {
            studentName:
              `${student.firstName} ${student.lastName}`,
            dailySpendLimit,
          },
        },
      });
    },
  );

  return NextResponse.json({
    success: true,
    student: {
      id: student.id,
      dailySpendLimit,
    },
  });
}