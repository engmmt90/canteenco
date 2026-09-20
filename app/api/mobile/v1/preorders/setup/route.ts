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
    request.headers.get("authorization");

  if (
    !authorization ||
    !authorization.startsWith("Bearer ")
  ) {
    return null;
  }

  return authorization.slice(7).trim();
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

            wallet: {
              select: {
                balance: true,
                status: true,
              },
            },

            students: {
              where: {
                status: "ACTIVE",
                deletedAt: null,
              },

              orderBy: [
                {
                  firstName: "asc",
                },
                {
                  lastName: "asc",
                },
              ],

              select: {
                id: true,
                firstName: true,
                lastName: true,
                displayCode: true,
                schoolId: true,

                school: {
                  select: {
                    name: true,

                    settings: {
                      select: {
                        timezone: true,
                        preOrderEnabled: true,
                        preOrderCutoffTime: true,
                      },
                    },

                    pickupSlots: {
                      where: {
                        isActive: true,
                      },

                      orderBy: {
                        sortOrder: "asc",
                      },

                      select: {
                        id: true,
                        label: true,
                        startTime: true,
                        endTime: true,
                      },
                    },
                  },
                },
              },
            },
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

  const products =
    await prisma.product.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },

      orderBy: [
        {
          sortOrder: "asc",
        },
        {
          name: "asc",
        },
      ],

      select: {
        id: true,
        name: true,
        category: true,
        price: true,
        imageUrl: true,

        optionGroups: {
          where: {
            isActive: true,
          },

          orderBy: [
            {
              sortOrder: "asc",
            },
            {
              name: "asc",
            },
          ],

          select: {
            id: true,
            name: true,
            minSelections: true,
            maxSelections: true,
            isRequired: true,

            options: {
              where: {
                isActive: true,
              },

              orderBy: [
                {
                  sortOrder: "asc",
                },
                {
                  name: "asc",
                },
              ],

              select: {
                id: true,
                name: true,
                additionalPrice: true,
              },
            },
          },
        },
      },
    });

  const wallet =
    user.parentProfile.wallet;

  const students =
    user.parentProfile.students.map(
      (student) => ({
        id: student.id,
        firstName:
          student.firstName,
        lastName:
          student.lastName,
        displayCode:
          student.displayCode,
        schoolId:
          student.schoolId,
        schoolName:
          student.school.name,

        preOrderEnabled:
          student.school.settings
            ?.preOrderEnabled ??
          false,

        cutoffTime:
          student.school.settings
            ?.preOrderCutoffTime ??
          "07:00",

        timezone:
          student.school.settings
            ?.timezone ??
          "Australia/Brisbane",

        pickupSlots:
          student.school.pickupSlots,
      }),
    );

  return NextResponse.json(
    {
      walletBalance:
        Number(
          wallet?.balance ?? 0,
        ),

      walletActive:
        wallet?.status === "ACTIVE",

      students,

      products:
        products.map(
          (product) => ({
            id: product.id,
            name: product.name,
            category:
              product.category,
            price:
              Number(product.price),
            imageUrl:
              product.imageUrl,

            optionGroups:
              product.optionGroups.map(
                (group) => ({
                  id: group.id,
                  name: group.name,

                  minSelections:
                    group.minSelections,

                  maxSelections:
                    group.maxSelections,

                  isRequired:
                    group.isRequired,

                  options:
                    group.options.map(
                      (option) => ({
                        id: option.id,
                        name: option.name,

                        additionalPrice:
                          Number(
                            option.additionalPrice,
                          ),
                      }),
                    ),
                }),
              ),
          }),
        ),
    },
    {
      headers: {
        "Cache-Control":
          "no-store",
      },
    },
  );
}