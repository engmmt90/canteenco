"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { buildStudentDisplayCode, normalizeClassCode } from "@/lib/student-code";

export type RegistrationFormState = {
  error?: string;
};

const parentSchema = z.object({
  fullName: z.string().trim().min(2).max(120),
  email: z.string().trim().email().transform((value) => value.toLowerCase()),
  phone: z.string().trim().max(40).optional(),
  password: z.string().min(8).max(128),
});

const studentSchema = z.object({
  firstName: z.string().trim().min(1).max(80),
  lastName: z.string().trim().min(1).max(80),
  schoolId: z.string().min(1),
  grade: z.string().trim().min(1).max(20),
  classSection: z.string().trim().min(1).max(20),
  officialSchoolId: z.string().trim().max(80).optional(),
});

function formString(formData: FormData, key: string) {
  const raw = formData.get(key);
  return typeof raw === "string" ? raw.trim() : "";
}

export async function submitParentRegistration(
  _previousState: RegistrationFormState,
  formData: FormData,
): Promise<RegistrationFormState> {
  const parent = parentSchema.safeParse({
    fullName: formString(formData, "fullName"),
    email: formString(formData, "email"),
    phone: formString(formData, "phone") || undefined,
    password: formString(formData, "password"),
  });

  if (!parent.success) {
    return { error: "Please check the parent details and password (minimum 8 characters)." };
  }

  const rawCount = Number(formString(formData, "studentCount"));
  const studentCount = Number.isInteger(rawCount) ? rawCount : 0;
  if (studentCount < 1 || studentCount > 8) {
    return { error: "Please add between 1 and 8 students." };
  }

  const students = [];
  for (let index = 0; index < studentCount; index += 1) {
    const parsed = studentSchema.safeParse({
      firstName: formString(formData, `students.${index}.firstName`),
      lastName: formString(formData, `students.${index}.lastName`),
      schoolId: formString(formData, `students.${index}.schoolId`),
      grade: formString(formData, `students.${index}.grade`),
      classSection: formString(formData, `students.${index}.classSection`),
      officialSchoolId: formString(formData, `students.${index}.officialSchoolId`) || undefined,
    });

    if (!parsed.success) {
      return { error: `Please complete all required details for student ${index + 1}.` };
    }
    students.push(parsed.data);
  }

  const existingUser = await prisma.user.findUnique({
    where: { email: parent.data.email },
    select: { id: true },
  });
  if (existingUser) {
    return { error: "An account with this email already exists." };
  }

  const existingPending = await prisma.parentRegistrationRequest.findFirst({
    where: { email: parent.data.email, status: "PENDING" },
    select: { id: true },
  });
  if (existingPending) {
    return { error: "A registration request for this email is already pending approval." };
  }

  const schoolIds = [...new Set(students.map((student) => student.schoolId))];
  const activeSchools = await prisma.school.findMany({
    where: { id: { in: schoolIds }, isActive: true, deletedAt: null },
    select: { id: true },
  });
  if (activeSchools.length !== schoolIds.length) {
    return { error: "One of the selected schools is not currently available." };
  }

  const passwordHash = await bcrypt.hash(parent.data.password, 12);

  await prisma.parentRegistrationRequest.create({
    data: {
      fullName: parent.data.fullName,
      email: parent.data.email,
      phone: parent.data.phone || null,
      passwordHash,
      students: {
        create: students.map((student) => ({
          schoolId: student.schoolId,
          firstName: student.firstName,
          lastName: student.lastName,
          grade: student.grade,
          classSection: student.classSection,
          officialSchoolId: student.officialSchoolId || null,
        })),
      },
    },
  });

  redirect("/parent/register?submitted=1");
}

export async function approveParentRegistration(formData: FormData) {
  const session = await requireAdmin();
  const requestId = formString(formData, "requestId");
  if (!requestId) return;

  const request = await prisma.parentRegistrationRequest.findUnique({
    where: { id: requestId },
    include: { students: true },
  });

  if (!request || request.status !== "PENDING") return;

  await prisma.$transaction(async (tx) => {
    const existingUser = await tx.user.findUnique({
      where: { email: request.email },
      select: { id: true },
    });
    if (existingUser) {
      throw new Error("A user already exists for this registration email.");
    }

    const user = await tx.user.create({
      data: {
        fullName: request.fullName,
        email: request.email,
        phone: request.phone,
        passwordHash: request.passwordHash,
        role: "PARENT",
        status: "ACTIVE",
      },
    });

    const parent = await tx.parentProfile.create({
      data: {
        userId: user.id,
        wallet: { create: { balance: 0, status: "ACTIVE" } },
        notificationPreference: {
          create: {
            emailEnabled: true,
            smsEnabled: false,
            pushEnabled: false,
            notifyTopUp: true,
            notifyPurchase: true,
            notifyPreOrder: true,
            notifyPickup: true,
            notifyRefund: true,
            notifyLowBalance: true,
          },
        },
      },
    });

    for (const draft of request.students) {
      const classCode = normalizeClassCode(draft.grade, draft.classSection);
      const classSequence = await tx.classStudentSequence.upsert({
        where: {
          schoolId_classCode: {
            schoolId: draft.schoolId,
            classCode,
          },
        },
        create: {
          schoolId: draft.schoolId,
          classCode,
          nextSequence: 2,
        },
        update: {
          nextSequence: { increment: 1 },
        },
        select: { nextSequence: true },
      });
      const sequenceNumber = classSequence.nextSequence - 1;

      await tx.student.create({
        data: {
          parentId: parent.id,
          schoolId: draft.schoolId,
          sequenceNumber,
          classCode,
          displayCode: buildStudentDisplayCode(classCode, sequenceNumber),
          firstName: draft.firstName,
          lastName: draft.lastName,
          grade: draft.grade,
          classSection: draft.classSection,
          officialSchoolId: draft.officialSchoolId,
          photoUrl: draft.photoUrl,
          qrToken: crypto.randomUUID(),
          status: "ACTIVE",
          approvedAt: new Date(),
          approvedByUserId: session.user.id,
        },
      });
    }

    await tx.parentRegistrationRequest.update({
      where: { id: request.id },
      data: {
        status: "APPROVED",
        approvedAt: new Date(),
        approvedByUserId: session.user.id,
      },
    });

    await tx.notification.create({
      data: {
        userId: user.id,
        channel: "IN_APP",
        event: "ACCOUNT_APPROVED",
        subject: "CanteenCo account approved",
        message: "Your CanteenCo parent account and family wallet are now active.",
      },
    });

    await tx.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "APPROVE_PARENT_REGISTRATION",
        entityType: "ParentRegistrationRequest",
        entityId: request.id,
        metadata: { parentUserId: user.id, studentCount: request.students.length },
      },
    });
  });

  revalidatePath("/admin");
  revalidatePath("/admin/registrations");
}

export async function rejectParentRegistration(formData: FormData) {
  const session = await requireAdmin();
  const requestId = formString(formData, "requestId");
  if (!requestId) return;

  const request = await prisma.parentRegistrationRequest.findUnique({
    where: { id: requestId },
    select: { id: true, status: true },
  });
  if (!request || request.status !== "PENDING") return;

  await prisma.$transaction([
    prisma.parentRegistrationRequest.update({
      where: { id: request.id },
      data: { status: "REJECTED", rejectedAt: new Date() },
    }),
    prisma.auditLog.create({
      data: {
        actorUserId: session.user.id,
        action: "REJECT_PARENT_REGISTRATION",
        entityType: "ParentRegistrationRequest",
        entityId: request.id,
      },
    }),
  ]);

  revalidatePath("/admin");
  revalidatePath("/admin/registrations");
}
