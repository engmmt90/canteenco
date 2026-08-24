"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireParent } from "@/lib/authz";
import { buildStudentDisplayCode } from "@/lib/student-code";

function str(
  formData: FormData,
  key: string,
) {
  return String(
    formData.get(key) ?? "",
  ).trim();
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

export async function addStudentForParent(
  formData: FormData,
) {
  const session =
    await requireParent();

  const firstName =
    str(
      formData,
      "firstName",
    );

  const lastName =
    str(
      formData,
      "lastName",
    );

  const schoolId =
    str(
      formData,
      "schoolId",
    );

  const classId =
    str(
      formData,
      "classId",
    );

  const officialSchoolId =
    str(
      formData,
      "officialSchoolId",
    ) || null;

  if (
    !firstName ||
    !lastName ||
    !schoolId ||
    !classId
  ) {
    throw new Error(
      "Student name, school and class are required.",
    );
  }

  const parent =
    await prisma.parentProfile.findUnique({
      where: {
        userId:
          session.user.id,
      },
    });

  if (!parent) {
    throw new Error(
      "Parent profile not found.",
    );
  }

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

      /*
       * The selected class MUST belong to the
       * selected school and MUST be active.
       */
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

      /*
       * Year, section and class code now come
       * directly from the Admin-configured class.
       */
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

      const student =
        await tx.student.create({
          data: {
            parentId:
              parent.id,

            schoolId:
              school.id,

            firstName,
            lastName,

            grade,

            classSection,

            officialSchoolId,

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
            session.user.id,

          action:
            "ADD_STUDENT",

          entityType:
            "Student",

          entityId:
            student.id,

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
    },
  );

  revalidatePath(
    "/parent",
  );

  revalidatePath(
    "/parent/dashboard",
  );
}