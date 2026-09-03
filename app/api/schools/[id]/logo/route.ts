import { NextResponse } from "next/server";

import { prisma } from "@/lib/prisma";

export const dynamic =
  "force-dynamic";

export async function GET(
  _request: Request,
  {
    params,
  }: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const { id } =
    await params;

  const settings =
    await prisma.schoolSettings.findUnique({
      where: {
        schoolId: id,
      },

      select: {
        logoData: true,
        logoMimeType: true,
        updatedAt: true,
      },
    });

  if (
    !settings?.logoData ||
    !settings.logoMimeType
  ) {
    return new NextResponse(
      null,
      {
        status: 404,
      },
    );
  }

  return new NextResponse(
    new Uint8Array(
      settings.logoData,
    ),
    {
      status: 200,

      headers: {
        "Content-Type":
          settings.logoMimeType,

        "Content-Length":
          String(
            settings.logoData
              .length,
          ),

        "Cache-Control":
          "public, max-age=300, stale-while-revalidate=86400",

        "Last-Modified":
          settings.updatedAt.toUTCString(),
      },
    },
  );
}