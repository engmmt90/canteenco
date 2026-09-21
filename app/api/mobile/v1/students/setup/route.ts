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
    user.sessionVersion !==
      payload.sessionVersion ||
    !user.parentProfile
  ) {
    return unauthorized();
  }

  const [schools, classes] =
    await Promise.all([
      prisma.school.findMany({
        where: {
          isActive: true,
          deletedAt: null,
        },

        select: {
          id: true,
          name: true,
          code: true,
        },

        orderBy: {
          name: "asc",
        },
      }),

      prisma.schoolClass.findMany({
        where: {
          isActive: true,

          school: {
            isActive: true,
            deletedAt: null,
          },
        },

        select: {
          id: true,
          schoolId: true,
          name: true,
          grade: true,
          section: true,
          classCode: true,
        },

        orderBy: [
          {
            grade: "asc",
          },
          {
            classCode: "asc",
          },
        ],
      }),
    ]);

  return NextResponse.json(
    {
      schools,
      classes,
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}