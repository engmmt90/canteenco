import bcrypt from "bcryptjs";
import { createHash } from "node:crypto";

import { prisma } from "@/lib/prisma";

const MAX_FAILED_ATTEMPTS = 5;

const LOGIN_WINDOW_MS =
  15 * 60 * 1000;

const BLOCK_MS =
  30 * 60 * 1000;

function normalizeEmail(
  email: string,
) {
  return email
    .trim()
    .toLowerCase();
}

function identifierHash(
  email: string,
) {
  return createHash("sha256")
    .update(normalizeEmail(email))
    .digest("hex");
}

async function isBlocked(
  email: string,
) {
  const hash =
    identifierHash(email);

  const throttle =
    await prisma.loginThrottle.findUnique({
      where: {
        identifierHash: hash,
      },
    });

  if (!throttle?.blockedUntil) {
    return false;
  }

  if (
    throttle.blockedUntil.getTime() >
    Date.now()
  ) {
    return true;
  }

  await prisma.loginThrottle.update({
    where: {
      identifierHash: hash,
    },
    data: {
      failedCount: 0,
      windowStartedAt: null,
      blockedUntil: null,
    },
  });

  return false;
}

async function recordFailure(
  email: string,
) {
  const hash =
    identifierHash(email);

  const now = new Date();

  const throttle =
    await prisma.loginThrottle.findUnique({
      where: {
        identifierHash: hash,
      },
    });

  if (!throttle) {
    await prisma.loginThrottle.create({
      data: {
        identifierHash: hash,
        failedCount: 1,
        windowStartedAt: now,
      },
    });

    return;
  }

  const insideWindow =
    throttle.windowStartedAt !== null &&
    now.getTime() -
      throttle.windowStartedAt.getTime() <
      LOGIN_WINDOW_MS;

  const failedCount =
    insideWindow
      ? throttle.failedCount + 1
      : 1;

  await prisma.loginThrottle.update({
    where: {
      identifierHash: hash,
    },
    data: {
      failedCount,

      windowStartedAt:
        insideWindow
          ? throttle.windowStartedAt
          : now,

      blockedUntil:
        failedCount >= MAX_FAILED_ATTEMPTS
          ? new Date(
              now.getTime() + BLOCK_MS,
            )
          : null,
    },
  });
}

async function clearFailures(
  email: string,
) {
  await prisma.loginThrottle.deleteMany({
    where: {
      identifierHash:
        identifierHash(email),
    },
  });
}

export async function authenticateParent(
  rawEmail: string,
  password: string,
) {
  const email =
    normalizeEmail(rawEmail);

  if (await isBlocked(email)) {
    return null;
  }

  const user =
    await prisma.user.findUnique({
      where: {
        email,
      },
      select: {
        id: true,
        fullName: true,
        email: true,
        passwordHash: true,
        role: true,
        status: true,
        sessionVersion: true,
      },
    });

  if (
    !user ||
    user.status !== "ACTIVE"
  ) {
    await recordFailure(email);
    return null;
  }

  const passwordMatches =
    await bcrypt.compare(
      password,
      user.passwordHash,
    );

  if (!passwordMatches) {
    await recordFailure(email);
    return null;
  }

  if (user.role !== "PARENT") {
    await recordFailure(email);
    return null;
  }

  await clearFailures(email);

  await prisma.user.update({
    where: {
      id: user.id,
    },
    data: {
      lastLoginAt: new Date(),
    },
  });

  return user;
}
