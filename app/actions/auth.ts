"use server";

import { createHash } from "crypto";

import { AuthError } from "next-auth";
import { redirect } from "next/navigation";

import {
  signIn,
  signOut,
} from "@/auth";

import {
  prisma,
} from "@/lib/prisma";

const MAX_FAILED_ATTEMPTS = 5;

const ATTEMPT_WINDOW_MS =
  15 * 60 * 1000;

function value(
  formData: FormData,
  key: string,
) {
  const raw =
    formData.get(key);

  return typeof raw === "string"
    ? raw.trim()
    : "";
}

function loginIdentifierHash(
  email: string,
) {
  return createHash(
    "sha256",
  )
    .update(
      email
        .trim()
        .toLowerCase(),
    )
    .digest("hex");
}

async function getStaffLoginErrorUrl(
  email: string,
) {
  const normalizedEmail =
    email
      .trim()
      .toLowerCase();

  if (!normalizedEmail) {
    return "/staff/login?error=invalid_credentials";
  }

  const identifierHash =
    loginIdentifierHash(
      normalizedEmail,
    );

  const throttle =
    await prisma.loginThrottle.findUnique({
      where: {
        identifierHash,
      },

      select: {
        failedCount: true,
        windowStartedAt: true,
        blockedUntil: true,
      },
    });

  if (!throttle) {
    return "/staff/login?error=invalid_credentials";
  }

  const now =
    Date.now();

  /*
   * Already blocked.
   */
  if (
    throttle.blockedUntil &&
    throttle.blockedUntil.getTime() >
      now
  ) {
    const minutesRemaining =
      Math.max(
        1,
        Math.ceil(
          (
            throttle.blockedUntil.getTime() -
            now
          ) /
            60_000,
        ),
      );

    return (
      "/staff/login" +
      "?error=blocked" +
      `&minutes=${minutesRemaining}`
    );
  }

  /*
   * Only show the current count
   * while the 15-minute attempt
   * window is still active.
   */
  if (
    !throttle.windowStartedAt ||
    now -
      throttle.windowStartedAt.getTime() >=
      ATTEMPT_WINDOW_MS
  ) {
    return "/staff/login?error=invalid_credentials";
  }

  const remaining =
    Math.max(
      0,
      MAX_FAILED_ATTEMPTS -
        throttle.failedCount,
    );

  if (
    remaining >= 1 &&
    remaining <= 4
  ) {
    return (
      "/staff/login" +
      "?error=invalid_credentials" +
      `&remaining=${remaining}`
    );
  }

  return "/staff/login?error=invalid_credentials";
}

export async function parentLogin(
  formData: FormData,
) {
  try {
    await signIn(
      "credentials",
      {
        email: value(
          formData,
          "email",
        ),

        password: value(
          formData,
          "password",
        ),

        portal: "parent",

        redirectTo:
          "/parent",
      },
    );
  } catch (error) {
    if (
      error instanceof AuthError
    ) {
      redirect(
        "/?error=invalid_credentials",
      );
    }

    throw error;
  }
}

export async function staffLogin(
  formData: FormData,
) {
  const email =
    value(
      formData,
      "email",
    );

  const rememberMe =
    formData.get(
      "rememberMe",
    ) === "1";

  try {
    await signIn(
      "credentials",
      {
        email,

        password: value(
          formData,
          "password",
        ),

        portal: "staff",

        rememberMe:
          rememberMe
            ? "1"
            : "0",

        redirectTo:
          "/staff/redirect",
      },
    );
  } catch (error) {
    if (
      error instanceof AuthError
    ) {
      const errorUrl =
        await getStaffLoginErrorUrl(
          email,
        );

      redirect(
        errorUrl,
      );
    }

    throw error;
  }
}

export async function logout() {
  await signOut({
    redirectTo: "/",
  });
}