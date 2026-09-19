import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  hashRefreshToken,
} from "@/lib/mobile-auth/tokens";

export const runtime = "nodejs";

const LogoutSchema = z.object({
  refreshToken: z.string().min(20),
});

export async function POST(
  request: Request,
) {
  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        success: true,
      },
      {
        headers: {
          "Cache-Control": "no-store",
        },
      },
    );
  }

  const parsed =
    LogoutSchema.safeParse(body);

  if (parsed.success) {
    await prisma.mobileRefreshSession.deleteMany({
      where: {
        tokenHash:
          hashRefreshToken(
            parsed.data.refreshToken,
          ),
      },
    });
  }

  return NextResponse.json(
    {
      success: true,
    },
    {
      headers: {
        "Cache-Control": "no-store",
      },
    },
  );
}
