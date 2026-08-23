"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireParent } from "@/lib/authz";
import {
  buildStudentDisplayCode,
  normalizeClassCode,
} from "@/lib/student-code";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

async function nextClassSequence(
  tx: any,
  schoolId: string,
  classCode: string,
) {
  const sequence = await tx.classStudentSequence.upsert({
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
  const session = await requireParent();

  const firstName = str(formData, "firstName");
  const lastName = str(formData, "lastName");
  const grade = str(formData, "grade");
  const classSection = str(formData, "classSection");
  const schoolId = str(formData, "schoolId");

  const officialSchoolId =
    str(formData, "officialSchoolId") || null;

  if (
    !firstName ||
    !lastName ||
    !grade ||
    !classSection ||
    !schoolId
  ) {
    throw new Error(
      "Student name, grade, class and school are required.",
    );
  }

  const parent =
    await prisma.parentProfile.findUnique({
      where: {
        userId: session.user.id,
      },
    });

  if (!parent) {
    throw new Error(
      "Parent profile not found.",
    );
  }

  await prisma.$transaction(async (tx) => {
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

    const classCode =
      normalizeClassCode(
        grade,
        classSection,
      );

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
          parentId: parent.id,
          schoolId: school.id,

          firstName,
          lastName,
          grade,
          classSection,
          officialSchoolId,

          classCode,
          sequenceNumber,
          displayCode,

          qrToken: crypto.randomUUID(),

          status: "PENDING_APPROVAL",

          approvedAt: null,
          approvedByUserId: null,
          deletedAt: null,

          dailySpendLimit: null,
        },
      });

    await tx.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "ADD_STUDENT",
        entityType: "Student",
        entityId: student.id,

        metadata: {
          displayCode,
          classCode,
          schoolId: school.id,
          studentName:
            `${firstName} ${lastName}`,
        },
      },
    });
  });

  revalidatePath("/parent");
  revalidatePath("/parent/dashboard");
}