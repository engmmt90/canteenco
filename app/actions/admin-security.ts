"use server";

import { createHash } from "crypto";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";
import { z } from "zod";

import { signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

const emailSchema = z
  .string()
  .trim()
  .toLowerCase()
  .email();

function field(
  formData: FormData,
  key: string,
) {
  const value =
    formData.get(key);

  return typeof value === "string"
    ? value
    : "";
}

function identifierHash(
  email: string,
) {
  return createHash("sha256")
    .update(
      email
        .trim()
        .toLowerCase(),
    )
    .digest("hex");
}

function passwordError(
  code: string,
): never {
  redirect(
    `/admin/settings?changePassword=1&passwordError=${encodeURIComponent(
      code,
    )}`,
  );
}

function emailError(
  code: string,
): never {
  redirect(
    `/admin/settings?changeEmail=1&emailError=${encodeURIComponent(
      code,
    )}`,
  );
}

export async function changeAdminPassword(
  formData: FormData,
) {
  const session =
    await requireAdmin();

  const currentPassword =
    field(
      formData,
      "currentPassword",
    );

  const newPassword =
    field(
      formData,
      "newPassword",
    );

  const confirmPassword =
    field(
      formData,
      "confirmPassword",
    );

  if (
    !currentPassword ||
    !newPassword ||
    !confirmPassword
  ) {
    passwordError("required");
  }

  if (
    newPassword.length < 8
  ) {
    passwordError("length");
  }

  if (
    newPassword !==
    confirmPassword
  ) {
    passwordError("mismatch");
  }

  const user =
    await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },

      select: {
        id: true,
        email: true,
        passwordHash: true,
        status: true,
        deletedAt: true,
      },
    });

  if (
    !user ||
    user.status !== "ACTIVE" ||
    user.deletedAt
  ) {
    passwordError("account");
  }

  const currentMatches =
    await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

  if (!currentMatches) {
    passwordError("current");
  }

  const sameAsCurrent =
    await bcrypt.compare(
      newPassword,
      user.passwordHash,
    );

  if (sameAsCurrent) {
    passwordError("same");
  }

  const newPasswordHash =
    await bcrypt.hash(
      newPassword,
      12,
    );

  const loginHash =
    identifierHash(
      user.email,
    );

  const now =
    new Date();

  await prisma.$transaction([
    prisma.user.update({
      where: {
        id: user.id,
      },

      data: {
        passwordHash:
          newPasswordHash,

        sessionVersion: {
          increment: 1,
        },
      },
    }),

    prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },

      data: {
        usedAt: now,
      },
    }),

    prisma.loginThrottle.deleteMany({
      where: {
        identifierHash:
          loginHash,
      },
    }),
  ]);

  await signOut({
    redirectTo:
      "/staff/login",
  });
}

export async function changeAdminLoginEmail(
  formData: FormData,
) {
  const session =
    await requireAdmin();

  const rawNewEmail =
    field(
      formData,
      "newEmail",
    );

  const currentPassword =
    field(
      formData,
      "currentPassword",
    );

  if (
    !rawNewEmail ||
    !currentPassword
  ) {
    emailError("required");
  }

  const parsedEmail =
    emailSchema.safeParse(
      rawNewEmail,
    );

  if (!parsedEmail.success) {
    emailError("invalid");
  }

  const newEmail =
    parsedEmail.data;

  const user =
    await prisma.user.findUnique({
      where: {
        id: session.user.id,
      },

      select: {
        id: true,
        email: true,
        passwordHash: true,
        status: true,
        deletedAt: true,
      },
    });

  if (
    !user ||
    user.status !== "ACTIVE" ||
    user.deletedAt
  ) {
    emailError("account");
  }

  const passwordMatches =
    await bcrypt.compare(
      currentPassword,
      user.passwordHash,
    );

  if (!passwordMatches) {
    emailError("password");
  }

  if (
    newEmail ===
    user.email
      .trim()
      .toLowerCase()
  ) {
    emailError("same");
  }

  const existingUser =
    await prisma.user.findUnique({
      where: {
        email: newEmail,
      },

      select: {
        id: true,
      },
    });

  if (
    existingUser &&
    existingUser.id !==
      user.id
  ) {
    emailError("in_use");
  }

  const oldIdentifierHash =
    identifierHash(
      user.email,
    );

  const newIdentifierHash =
    identifierHash(
      newEmail,
    );

  const now =
    new Date();

  try {
    await prisma.$transaction([
      prisma.user.update({
        where: {
          id: user.id,
        },

        data: {
          email: newEmail,

          /*
           * Invalidates every
           * existing JWT session.
           */
          sessionVersion: {
            increment: 1,
          },
        },
      }),

      /*
       * Any password-reset links
       * issued to the old email
       * become invalid.
       */
      prisma.passwordResetToken.updateMany({
        where: {
          userId: user.id,
          usedAt: null,
        },

        data: {
          usedAt: now,
        },
      }),

      /*
       * Clear lockout history for
       * both the old and new login
       * identifiers.
       */
      prisma.loginThrottle.deleteMany({
        where: {
          identifierHash: {
            in: [
              oldIdentifierHash,
              newIdentifierHash,
            ],
          },
        },
      }),
    ]);
  } catch (error) {
    if (
      error &&
      typeof error ===
        "object" &&
      "code" in error &&
      error.code === "P2002"
    ) {
      emailError("in_use");
    }

    throw error;
  }

  /*
   * Current browser signs out.
   * Other devices are rejected
   * because their sessionVersion
   * is now old.
   */
  await signOut({
    redirectTo:
      "/staff/login",
  });
}