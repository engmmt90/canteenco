import { NextResponse } from "next/server";

import {
  cancelOwnPreOrder,
} from "@/app/actions/preorders";

export const runtime = "nodejs";

export async function POST(
  _request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const { id } =
    await context.params;

  if (!id) {
    return NextResponse.json(
      {
        error:
          "Order ID is required.",
      },
      {
        status: 400,
      },
    );
  }

  const result =
    await cancelOwnPreOrder(id);

  if (!result.ok) {
    return NextResponse.json(
      {
        error:
          result.error,
      },
      {
        status:
          result.error ===
          "Unauthorized"
            ? 401
            : 400,

        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  }

  return NextResponse.json(
    {
      success: true,
      balanceAfter:
        result.balanceAfter
          ? Number(
              result.balanceAfter,
            )
          : null,
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}