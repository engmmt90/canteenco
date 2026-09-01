"use server";

import bcrypt from "bcryptjs";
import { createHash, randomBytes } from "crypto";
import { headers } from "next/headers";
import { z } from "zod";

import { prisma } from "@/lib/prisma";
import { sendEmail } from "@/lib/notification-providers";

const RESET_EXPIRY_MINUTES = 30;
const STAFF_LOGIN_ROLES = ["SUPER_ADMIN", "SCHOOL_ADMIN", "CASHIER"] as const;

const forgotSchema = z.object({
  email: z
    .string()
    .trim()
    .email()
    .transform((value) => value.toLowerCase()),
});

const resetSchema = z
  .object({
    token: z.string().min(20),
    password: z.string().min(8),
    confirmPassword: z.string().min(8),
  })
  .refine((value) => value.password === value.confirmPassword, {
    message: "Passwords do not match.",
    path: ["confirmPassword"],
  });

export type ForgotPasswordState = {
  ok: boolean;
  message: string;
};

export type ResetPasswordState = {
  ok: boolean;
  message: string;
};

function hashToken(token: string) {
  return createHash("sha256").update(token).digest("hex");
}

async function getBaseUrl() {
  const h = await headers();
  const host = h.get("x-forwarded-host") ?? h.get("host");
  const proto =
    h.get("x-forwarded-proto") ??
    (process.env.NODE_ENV === "production" ? "https" : "http");

  if (host) return `${proto}://${host}`;

  return (
    process.env.NEXTAUTH_URL ??
    process.env.AUTH_URL ??
    "http://localhost:3000"
  );
}

async function requestReset(
  formData: FormData,
  allowedRoles: readonly string[],
  resetPath: string,
  genericMessage: string,
  accountLabel: string,
): Promise<ForgotPasswordState> {
  const parsed = forgotSchema.safeParse({
    email: formData.get("email"),
  });

  if (!parsed.success) {
    return { ok: true, message: genericMessage };
  }

  const user = await prisma.user.findUnique({
    where: { email: parsed.data.email },
    select: {
      id: true,
      email: true,
      fullName: true,
      role: true,
      status: true,
      deletedAt: true,
    },
  });

  if (
    !user ||
    !allowedRoles.includes(user.role) ||
    user.status !== "ACTIVE" ||
    user.deletedAt
  ) {
    return { ok: true, message: genericMessage };
  }

  const token = randomBytes(32).toString("hex");
  const tokenHash = hashToken(token);
  const expiresAt = new Date(
    Date.now() + RESET_EXPIRY_MINUTES * 60_000,
  );

  await prisma.$transaction([
    prisma.passwordResetToken.updateMany({
      where: {
        userId: user.id,
        usedAt: null,
      },
      data: {
        usedAt: new Date(),
      },
    }),
    prisma.passwordResetToken.create({
      data: {
        userId: user.id,
        tokenHash,
        expiresAt,
      },
    }),
  ]);

  const resetUrl =
    `${await getBaseUrl()}${resetPath}?token=` +
    encodeURIComponent(token);

  try {
    await sendEmail({
      to: user.email,
      subject: "Reset your CanteenCo password",
      text:
        `Hi ${user.fullName},\n\n` +
        `We received a request to reset your CanteenCo ${accountLabel} password.\n\n` +
        `Reset your password using this link:\n${resetUrl}\n\n` +
        `This link expires in ${RESET_EXPIRY_MINUTES} minutes and can only be used once.\n\n` +
        `If you did not request a password reset, you can ignore this email.`,
    });
  } catch (error) {
    console.error("Password reset email failed", error);
  }

  return { ok: true, message: genericMessage };
}

async function resetForRoles(
  formData: FormData,
  allowedRoles: readonly string[],
): Promise<ResetPasswordState> {
  const parsed = resetSchema.safeParse({
    token: formData.get("token"),
    password: formData.get("password"),
    confirmPassword: formData.get("confirmPassword"),
  });

  if (!parsed.success) {
    return {
      ok: false,
      message:
        parsed.error.issues[0]?.message ??
        "Please check the form.",
    };
  }

  const resetToken =
    await prisma.passwordResetToken.findUnique({
      where: {
        tokenHash: hashToken(parsed.data.token),
      },
      include: {
        user: true,
      },
    });

  if (
    !resetToken ||
    resetToken.usedAt ||
    resetToken.expiresAt <= new Date() ||
    !allowedRoles.includes(resetToken.user.role) ||
    resetToken.user.status !== "ACTIVE" ||
    resetToken.user.deletedAt
  ) {
    return {
      ok: false,
      message:
        "This password reset link is invalid or has expired. Please request a new one.",
    };
  }

  const passwordHash = await bcrypt.hash(
    parsed.data.password,
    12,
  );

  try {
    await prisma.$transaction(async (tx) => {
      const claimed =
        await tx.passwordResetToken.updateMany({
          where: {
            id: resetToken.id,
            usedAt: null,
            expiresAt: {
              gt: new Date(),
            },
          },
          data: {
            usedAt: new Date(),
          },
        });

      if (claimed.count !== 1) {
        throw new Error("RESET_TOKEN_ALREADY_USED");
      }

      await tx.user.update({
        where: {
          id: resetToken.userId,
        },
        data: {
          passwordHash,
        },
      });

      await tx.passwordResetToken.updateMany({
        where: {
          userId: resetToken.userId,
          usedAt: null,
        },
        data: {
          usedAt: new Date(),
        },
      });
    });
  } catch (error) {
    if (
      error instanceof Error &&
      error.message === "RESET_TOKEN_ALREADY_USED"
    ) {
      return {
        ok: false,
        message:
          "This password reset link is invalid or has already been used.",
      };
    }

    throw error;
  }

  return {
    ok: true,
    message:
      "Password updated successfully. You can now sign in with your new password.",
  };
}

export async function requestParentPasswordReset(
  _previousState: ForgotPasswordState | undefined,
  formData: FormData,
): Promise<ForgotPasswordState> {
  return requestReset(
    formData,
    ["PARENT"],
    "/parent/reset-password",
    "If a parent account exists for this email, a password reset link has been sent.",
    "parent",
  );
}

export async function resetParentPassword(
  _previousState: ResetPasswordState | undefined,
  formData: FormData,
): Promise<ResetPasswordState> {
  return resetForRoles(formData, ["PARENT"]);
}

export async function requestStaffPasswordReset(
  _previousState: ForgotPasswordState | undefined,
  formData: FormData,
): Promise<ForgotPasswordState> {
  return requestReset(
    formData,
    STAFF_LOGIN_ROLES,
    "/staff/reset-password",
    "If an eligible staff account exists for this email, a password reset link has been sent.",
    "staff",
  );
}

export async function resetStaffPassword(
  _previousState: ResetPasswordState | undefined,
  formData: FormData,
): Promise<ResetPasswordState> {
  return resetForRoles(formData, STAFF_LOGIN_ROLES);
}
