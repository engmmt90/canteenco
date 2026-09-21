import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  verifyAccessToken,
} from "@/lib/mobile-auth/tokens";
import { buildStudentDisplayCode } from "@/lib/student-code";

export const runtime = "nodejs";

const AddStudentSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
  schoolId: z.string().trim().min(1),
  classId: z.string().trim().min(1),
  officialSchoolId: z
    .string()
    .trim()
    .optional()
    .default(""),
});

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

async function nextClassSequence(
  tx: any,
  schoolId: string,
  classCode: string,
) {
  const sequence =
    await tx.classStudentSequence.upsert({
      where: {
        schoolId_classCode: {
          schoolId,
          classCode,
        },
      },

      create: {
        schoolId,
        classCode,
        nextSequence: 2,
      },

      update: {
        nextSequence: {
          increment: 1,
        },
      },

      select: {
        nextSequence: true,
      },
    });

  return sequence.nextSequence - 1;
}

export async function POST(
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

  let body: unknown;

  try {
    body = await request.json();
  } catch {
    return NextResponse.json(
      {
        error:
          "Invalid request body.",
      },
      {
        status: 400,
      },
    );
  }

  const parsed =
    AddStudentSchema.safeParse(
      body,
    );

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Student name, school and class are required.",
      },
      {
        status: 400,
      },
    );
  }

  const {
    firstName,
    lastName,
    schoolId,
    classId,
    officialSchoolId,
  } = parsed.data;

  try {
    const student =
      await prisma.$transaction(
        async (tx) => {
          const school =
            await tx.school.findFirst({
              where: {
                id: schoolId,
                isActive: true,
                deletedAt: null,
              },
            });

          if (!school) {
            throw new Error(
              "Selected school is not available.",
            );
          }

          const schoolClass =
            await tx.schoolClass.findFirst({
              where: {
                id: classId,
                schoolId: school.id,
                isActive: true,
              },
            });

          if (!schoolClass) {
            throw new Error(
              "Selected class is not available for this school.",
            );
          }

          const grade =
            schoolClass.grade;

          const classSection =
            schoolClass.section ?? "";

          const classCode =
            schoolClass.classCode;

          if (
            !grade ||
            !classSection ||
            !classCode
          ) {
            throw new Error(
              "Selected class is not configured correctly.",
            );
          }

          const sequenceNumber =
            await nextClassSequence(
              tx,
              school.id,
              classCode,
            );

          const displayCode =
            buildStudentDisplayCode(
              classCode,
              sequenceNumber,
            );

          const created =
            await tx.student.create({
              data: {
                parentId:
                  user.parentProfile!.id,

                schoolId:
                  school.id,

                firstName,
                lastName,

                grade,

                classSection,

                officialSchoolId:
                  officialSchoolId ||
                  null,

                classCode,

                sequenceNumber,

                displayCode,

                qrToken:
                  crypto.randomUUID(),

                status:
                  "PENDING_APPROVAL",

                approvedAt:
                  null,

                approvedByUserId:
                  null,

                deletedAt:
                  null,

                dailySpendLimit:
                  null,
              },
            });

          await tx.auditLog.create({
            data: {
              actorUserId:
                user.id,

              action:
                "ADD_STUDENT",

              entityType:
                "Student",

              entityId:
                created.id,

              metadata: {
                displayCode,

                classCode,

                classId:
                  schoolClass.id,

                className:
                  schoolClass.name,

                grade,

                section:
                  classSection,

                schoolId:
                  school.id,

                studentName:
                  `${firstName} ${lastName}`,
              },
            },
          });

          return created;
        },
      );

    return NextResponse.json(
      {
        success: true,

        student: {
          id:
            student.id,

          firstName:
            student.firstName,

          lastName:
            student.lastName,

          displayCode:
            student.displayCode,

          classCode:
            student.classCode,

          status:
            student.status,
        },
      },
      {
        status: 201,
        headers: {
          "Cache-Control":
            "no-store",
        },
      },
    );
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not add student.",
      },
      {
        status: 400,
      },
    );
  }
}