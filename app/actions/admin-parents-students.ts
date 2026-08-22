"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import {
  buildStudentDisplayCode,
  normalizeClassCode,
} from "@/lib/student-code";

function str(
  f: FormData,
  k: string,
) {
  return String(f.get(k) ?? "").trim();
}

async function nextClassSequence(
  tx: any,
  schoolId: string,
  classCode: string,
) {
  const seq =
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

  return seq.nextSequence - 1;
}

export async function updateStudent(
  f: FormData,
) {
  const session = await requireAdmin();

  const id = str(f, "id");
  const firstName = str(f, "firstName");
  const lastName = str(f, "lastName");
  const grade = str(f, "grade");
  const classSection = str(
    f,
    "classSection",
  );
  const officialSchoolId =
    str(f, "officialSchoolId") || null;

  const rawNfcCardNumber = str(
    f,
    "nfcCardNumber",
  );

  const nfcCardNumber =
    rawNfcCardNumber || null;

  if (
    !id ||
    !firstName ||
    !lastName ||
    !grade ||
    !classSection
  ) {
    throw new Error(
      "Student name, grade and class section are required",
    );
  }

  await prisma.$transaction(
    async (tx) => {
      const student =
        await tx.student.findUnique({
          where: {
            id,
          },
        });

      if (!student) {
        throw new Error(
          "Student not found",
        );
      }

      if (
        session.user.role ===
          "SCHOOL_ADMIN" &&
        session.user.schoolId !==
          student.schoolId
      ) {
        throw new Error(
          "Unauthorized",
        );
      }

      if (nfcCardNumber) {
        const existingCard =
          await tx.student.findFirst({
            where: {
              nfcCardNumber,
              id: {
                not: id,
              },
            },
            select: {
              id: true,
              firstName: true,
              lastName: true,
              displayCode: true,
            },
          });

        if (existingCard) {
          throw new Error(
            `NFC card is already assigned to ${existingCard.firstName} ${existingCard.lastName} (${existingCard.displayCode}).`,
          );
        }
      }

      const classCode =
        normalizeClassCode(
          grade,
          classSection,
        );

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

      await tx.student.update({
        where: {
          id,
        },
        data: {
          firstName,
          lastName,
          grade,
          classSection,
          classCode,
          sequenceNumber,
          displayCode,
          officialSchoolId,
          nfcCardNumber,
        },
      });

      await tx.auditLog.create({
        data: {
          actorUserId:
            session.user.id,
          action: "UPDATE_STUDENT",
          entityType: "Student",
          entityId: id,
          metadata: {
            displayCode,
            classCode,
            nfcCardNumber,
          },
        },
      });
    },
  );

  revalidatePath(
    "/admin/students",
  );

  revalidatePath(
    `/admin/students/${id}`,
  );
}

export async function setStudentStatus(
  f: FormData,
) {
  const session =
    await requireAdmin();

  const id = str(f, "id");

  const status = str(
    f,
    "status",
  ) as
    | "ACTIVE"
    | "SUSPENDED"
    | "ARCHIVED";

  if (
    ![
      "ACTIVE",
      "SUSPENDED",
      "ARCHIVED",
    ].includes(status)
  ) {
    throw new Error(
      "Invalid status",
    );
  }

  const student =
    await prisma.student.findUnique({
      where: {
        id,
      },
    });

  if (!student) {
    throw new Error(
      "Student not found",
    );
  }

  if (
    session.user.role ===
      "SCHOOL_ADMIN" &&
    session.user.schoolId !==
      student.schoolId
  ) {
    throw new Error(
      "Unauthorized",
    );
  }

  await prisma.$transaction([
    prisma.student.update({
      where: {
        id,
      },
      data: {
        status,
        deletedAt:
          status === "ARCHIVED"
            ? new Date()
            : null,
      },
    }),

    prisma.auditLog.create({
      data: {
        actorUserId:
          session.user.id,
        action:
          "SET_STUDENT_STATUS",
        entityType: "Student",
        entityId: id,
        metadata: {
          status,
        },
      },
    }),
  ]);

  revalidatePath(
    "/admin/students",
  );

  revalidatePath(
    `/admin/students/${id}`,
  );
}

export async function updateParent(
  f: FormData,
) {
  const session =
    await requireAdmin();

  const userId = str(
    f,
    "userId",
  );

  const fullName = str(
    f,
    "fullName",
  );

  const phone =
    str(f, "phone") || null;

  const user =
    await prisma.user.findUnique({
      where: {
        id: userId,
      },
      include: {
        parentProfile: {
          include: {
            students: true,
          },
        },
      },
    });

  if (
    !user?.parentProfile ||
    user.role !== "PARENT"
  ) {
    throw new Error(
      "Parent not found",
    );
  }

  if (
    session.user.role ===
      "SCHOOL_ADMIN" &&
    !user.parentProfile.students.some(
      (student) =>
        student.schoolId ===
        session.user.schoolId,
    )
  ) {
    throw new Error(
      "Unauthorized",
    );
  }

  await prisma.user.update({
    where: {
      id: userId,
    },
    data: {
      fullName,
      phone,
    },
  });

  revalidatePath(
    "/admin/parents",
  );

  revalidatePath(
    `/admin/parents/${user.parentProfile.id}`,
  );
}