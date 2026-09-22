import { NextResponse } from "next/server";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import {
  verifyAccessToken,
} from "@/lib/mobile-auth/tokens";
import {
  buildStudentDisplayCode,
} from "@/lib/student-code";

export const runtime = "nodejs";

const UpdateStudentSchema = z.object({
  firstName: z.string().trim().min(1),
  lastName: z.string().trim().min(1),
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
    { status: 401 },
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

async function getParent(
  request: Request,
) {
  const token =
    getBearerToken(request);

  if (!token) {
    return null;
  }

  const payload =
    verifyAccessToken(token);

  if (!payload) {
    return null;
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
    return null;
  }

  return {
    userId: user.id,
    parentId:
      user.parentProfile.id,
  };
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

export async function GET(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const parent =
    await getParent(request);

  if (!parent) {
    return unauthorized();
  }

  const { id } =
    await context.params;

  const student =
    await prisma.student.findFirst({
      where: {
        id,
        parentId:
          parent.parentId,
        deletedAt: null,
      },

      select: {
        id: true,
        firstName: true,
        lastName: true,
        schoolId: true,
        classCode: true,
        displayCode: true,
        officialSchoolId: true,
        status: true,

        school: {
          select: {
            id: true,
            name: true,
          },
        },
      },
    });

  if (!student) {
    return NextResponse.json(
      {
        error:
          "Student not found.",
      },
      {
        status: 404,
      },
    );
  }

  const schoolClass =
    await prisma.schoolClass.findFirst({
      where: {
        schoolId:
          student.schoolId,
        classCode:
          student.classCode,
      },

      select: {
        id: true,
        name: true,
        classCode: true,
      },
    });

  return NextResponse.json({
    student: {
      id:
        student.id,
      firstName:
        student.firstName,
      lastName:
        student.lastName,
      schoolId:
        student.schoolId,
      schoolName:
        student.school.name,
      classId:
        schoolClass?.id ??
        null,
      className:
        schoolClass?.name ??
        student.classCode,
      classCode:
        student.classCode,
      displayCode:
        student.displayCode,
      officialSchoolId:
        student.officialSchoolId ??
        "",
      status:
        student.status,
    },
  });
}

export async function PUT(
  request: Request,
  context: {
    params: Promise<{
      id: string;
    }>;
  },
) {
  const parent =
    await getParent(request);

  if (!parent) {
    return unauthorized();
  }

  const { id } =
    await context.params;

  let body: unknown;

  try {
    body =
      await request.json();
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
    UpdateStudentSchema.safeParse(
      body,
    );

  if (!parsed.success) {
    return NextResponse.json(
      {
        error:
          "Student name and class are required.",
      },
      {
        status: 400,
      },
    );
  }

  const {
    firstName,
    lastName,
    classId,
    officialSchoolId,
  } = parsed.data;

  try {
    const updated =
      await prisma.$transaction(
        async (tx) => {
          const student =
            await tx.student.findFirst({
              where: {
                id,
                parentId:
                  parent.parentId,
                deletedAt: null,
              },
            });

          if (!student) {
            throw new Error(
              "Student not found.",
            );
          }

          const schoolClass =
            await tx.schoolClass.findFirst({
              where: {
                id: classId,
                schoolId:
                  student.schoolId,
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

          let sequenceNumber =
            student.sequenceNumber;

          let displayCode =
            student.displayCode;

          if (
            classCode !==
            student.classCode
          ) {
            sequenceNumber =
              await nextClassSequence(
                tx,
                student.schoolId,
                classCode,
              );

            displayCode =
              buildStudentDisplayCode(
                classCode,
                sequenceNumber,
              );
          }

          const saved =
            await tx.student.update({
              where: {
                id:
                  student.id,
              },

              data: {
                firstName,
                lastName,
                grade,
                classSection,
                classCode,
                sequenceNumber,
                displayCode,
                officialSchoolId:
                  officialSchoolId ||
                  null,
              },

              select: {
                id: true,
                firstName: true,
                lastName: true,
                classCode: true,
                displayCode: true,
                officialSchoolId: true,
                status: true,
              },
            });

          await tx.auditLog.create({
            data: {
              actorUserId:
                parent.userId,

              action:
                "UPDATE_STUDENT",

              entityType:
                "Student",

              entityId:
                student.id,

              metadata: {
                studentName:
                  `${firstName} ${lastName}`,
                classId:
                  schoolClass.id,
                className:
                  schoolClass.name,
                classCode,
                displayCode,
              },
            },
          });

          return saved;
        },
      );

    return NextResponse.json({
      success: true,

      student: {
        id:
          updated.id,
        firstName:
          updated.firstName,
        lastName:
          updated.lastName,
        classCode:
          updated.classCode,
        displayCode:
          updated.displayCode,
        officialSchoolId:
          updated.officialSchoolId ??
          "",
        status:
          updated.status,
      },
    });
  } catch (error) {
    return NextResponse.json(
      {
        error:
          error instanceof Error
            ? error.message
            : "Could not update student.",
      },
      {
        status: 400,
      },
    );
  }
}