"use server";

import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireParent } from "@/lib/authz";

function str(formData: FormData, key: string) {
  return String(formData.get(key) ?? "").trim();
}

export async function updateStudentDailyLimit(formData: FormData) {
  const session = await requireParent();

  const studentId = str(formData, "studentId");
  const rawLimit = str(formData, "dailySpendLimit");

  if (!studentId) {
    throw new Error("Student ID is required");
  }

  let dailySpendLimit: number | null = null;

  // Empty value means "No limit"
  if (rawLimit !== "") {
    const parsed = Number(rawLimit);

    if (!Number.isFinite(parsed)) {
      throw new Error("Daily limit must be a valid number");
    }

    if (parsed < 0) {
      throw new Error("Daily limit cannot be negative");
    }

    dailySpendLimit = Math.round(parsed * 100) / 100;
  }

  const parent = await prisma.parentProfile.findUnique({
    where: {
      userId: session.user.id,
    },
    select: {
      id: true,
    },
  });

  if (!parent) {
    throw new Error("Parent profile not found");
  }

  const student = await prisma.student.findUnique({
    where: {
      id: studentId,
    },
    select: {
      id: true,
      parentId: true,
      firstName: true,
      lastName: true,
      deletedAt: true,
    },
  });

  if (!student) {
    throw new Error("Student not found");
  }

  if (student.deletedAt) {
    throw new Error("This student is no longer active");
  }

  if (student.parentId !== parent.id) {
    throw new Error("Unauthorized");
  }

  await prisma.$transaction(async (tx) => {
    await tx.student.update({
      where: {
        id: student.id,
      },
      data: {
        dailySpendLimit,
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "UPDATE_STUDENT_DAILY_LIMIT",
        entityType: "Student",
        entityId: student.id,
        metadata: {
          studentName: `${student.firstName} ${student.lastName}`,
          dailySpendLimit,
        },
      },
    });
  });

  revalidatePath("/parent");
  revalidatePath("/parent/dashboard");
}