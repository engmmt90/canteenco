"use server";

import { createHash } from "crypto";

import bcrypt from "bcryptjs";
import { redirect } from "next/navigation";

import { signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

function passwordField(
  formData: FormData,
  key: string,
) {
  const value =
    formData.get(key);

  return typeof value === "string"
    ? value
    : "";
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
export async function changeAdminPassword(
  formData: FormData,
) {
  const session =
    await requireAdmin();

  const currentPassword =
    passwordField(
      formData,
      "currentPassword",
    );

  const newPassword =
    passwordField(
      formData,
      "newPassword",
    );

  const confirmPassword =
    passwordField(
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

  const identifierHash =
    createHash("sha256")
      .update(
        user.email
          .trim()
          .toLowerCase(),
      )
      .digest("hex");

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

    /*
     * Invalidate any unused
     * password-reset links.
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
     * Clear failed-login counter so
     * the admin can sign in cleanly
     * with the new password.
     */
    prisma.loginThrottle.deleteMany({
      where: {
        identifierHash,
      },
    }),
  ]);

  /*
   * Sign out this browser.
   * Other devices are invalidated by
   * the sessionVersion comparison.
   */
  await signOut({
    redirectTo:
      "/staff/login",
  });
}