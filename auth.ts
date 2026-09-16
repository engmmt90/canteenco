import { createHash } from "crypto";

import bcrypt from "bcryptjs";
import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import { z } from "zod";

import {
  authConfig,
} from "@/auth.config";

import {
  prisma,
} from "@/lib/prisma";

const THIRTY_DAYS =
  60 * 60 * 24 * 30;

/*
 * Login protection:
 *
 * 5 failed attempts inside 15 minutes
 * = block this login identifier
 * for 30 minutes.
 */
const MAX_FAILED_ATTEMPTS = 5;

const credentialsSchema =
  z.object({
    email: z
      .string()
      .email()
      .transform(
        (value) =>
          value
            .trim()
            .toLowerCase(),
      ),

    password:
      z.string().min(1),

    portal:
      z.enum([
        "parent",
        "staff",
      ]),

    rememberMe:
      z
        .string()
        .optional(),
  });

const STAFF_LOGIN_ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "CASHIER",
] as const;

/*
 * ------------------------------------------------------------
 * LOGIN THROTTLE
 * ------------------------------------------------------------
 */

/*
 * We do not save the email address
 * itself inside LoginThrottle.
 *
 * Only its SHA-256 hash is stored.
 */
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

/*
 * Check whether this identifier
 * is currently inside its
 * 30-minute lock period.
 */
async function isLoginBlocked(
  email: string,
) {
  const identifierHash =
    loginIdentifierHash(
      email,
    );

  const rows =
    await prisma.$queryRaw<
      Array<{
        blockedUntil:
          Date | null;
      }>
    >`
      SELECT "blockedUntil"
      FROM "LoginThrottle"
      WHERE "identifierHash" = ${identifierHash}
      LIMIT 1
    `;

  const blockedUntil =
    rows[0]?.blockedUntil;

  if (!blockedUntil) {
    return false;
  }

  return (
    blockedUntil.getTime() >
    Date.now()
  );
}

/*
 * Atomically register a failed login.
 *
 * Rules:
 *
 * - First failure starts a 15-minute window.
 * - Failures inside that window increment.
 * - Failure number 5 blocks for 30 minutes.
 * - If the 15-minute window expired,
 *   the counter starts again at 1.
 * - Attempts while already blocked
 *   do NOT extend the 30-minute block.
 *
 * This is done as one PostgreSQL UPSERT
 * to avoid losing counts when two login
 * attempts arrive at nearly the same time.
 */
async function recordLoginFailure(
  email: string,
) {
  const identifierHash =
    loginIdentifierHash(
      email,
    );

  await prisma.$executeRaw`
    INSERT INTO "LoginThrottle" (
      "identifierHash",
      "failedCount",
      "windowStartedAt",
      "blockedUntil",
      "createdAt",
      "updatedAt"
    )
    VALUES (
      ${identifierHash},
      1,
      NOW(),
      NULL,
      NOW(),
      NOW()
    )

    ON CONFLICT ("identifierHash")
    DO UPDATE SET

      "failedCount" =
        CASE

          WHEN
            "LoginThrottle"."blockedUntil"
              IS NOT NULL
            AND
            "LoginThrottle"."blockedUntil"
              > NOW()
          THEN
            "LoginThrottle"."failedCount"

          WHEN
            "LoginThrottle"."windowStartedAt"
              IS NULL
            OR
            "LoginThrottle"."windowStartedAt"
              <= NOW() - INTERVAL '15 minutes'
          THEN
            1

          ELSE
            "LoginThrottle"."failedCount" + 1

        END,

      "windowStartedAt" =
        CASE

          WHEN
            "LoginThrottle"."blockedUntil"
              IS NOT NULL
            AND
            "LoginThrottle"."blockedUntil"
              > NOW()
          THEN
            "LoginThrottle"."windowStartedAt"

          WHEN
            "LoginThrottle"."windowStartedAt"
              IS NULL
            OR
            "LoginThrottle"."windowStartedAt"
              <= NOW() - INTERVAL '15 minutes'
          THEN
            NOW()

          ELSE
            "LoginThrottle"."windowStartedAt"

        END,

      "blockedUntil" =
        CASE

          WHEN
            "LoginThrottle"."blockedUntil"
              IS NOT NULL
            AND
            "LoginThrottle"."blockedUntil"
              > NOW()
          THEN
            "LoginThrottle"."blockedUntil"

          WHEN
            "LoginThrottle"."windowStartedAt"
              IS NULL
            OR
            "LoginThrottle"."windowStartedAt"
              <= NOW() - INTERVAL '15 minutes'
          THEN
            NULL

          WHEN
            "LoginThrottle"."failedCount" + 1
              >= ${MAX_FAILED_ATTEMPTS}
          THEN
            NOW() + INTERVAL '30 minutes'

          ELSE
            NULL

        END,

      "updatedAt" =
        NOW()
  `;
}

/*
 * Successful login removes the
 * previous failures completely.
 */
async function clearLoginFailures(
  email: string,
) {
  const identifierHash =
    loginIdentifierHash(
      email,
    );

  await prisma.$executeRaw`
    DELETE FROM "LoginThrottle"
    WHERE "identifierHash" =
      ${identifierHash}
  `;
}

/*
 * ------------------------------------------------------------
 * AUTH
 * ------------------------------------------------------------
 */

export const {
  auth,
  handlers,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,

  /*
   * Cookie can survive up to
   * 30 days.
   *
   * auth.config.ts controls
   * whether a normal staff
   * login expires earlier
   * after 12 hours.
   */
  session: {
    strategy: "jwt",
    maxAge: THIRTY_DAYS,
  },

  jwt: {
    maxAge: THIRTY_DAYS,
  },

  providers: [
    Credentials({
      credentials: {
        email: {
          label: "Email",
          type: "email",
        },

        password: {
          label: "Password",
          type: "password",
        },

        portal: {
          label: "Portal",
          type: "text",
        },

        rememberMe: {
          label:
            "Keep me logged in",
          type: "text",
        },
      },

      async authorize(
        rawCredentials,
      ) {
        const parsed =
          credentialsSchema.safeParse(
            rawCredentials,
          );

        /*
         * Invalid form structure.
         *
         * There is no reliable valid
         * account identifier to throttle
         * here, so reject normally.
         */
        if (!parsed.success) {
          return null;
        }

        const email =
          parsed.data.email;

        /*
         * Check the block BEFORE
         * performing password hashing.
         *
         * Even the correct password
         * cannot be used while the
         * 30-minute block is active.
         */
        if (
          await isLoginBlocked(
            email,
          )
        ) {
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
              schoolId: true,
            },
          });

        /*
         * Unknown or inactive account
         * counts as a failed attempt
         * against this identifier.
         */
        if (
          !user ||
          user.status !==
            "ACTIVE"
        ) {
          await recordLoginFailure(
            email,
          );

          return null;
        }

        const passwordMatches =
          await bcrypt.compare(
            parsed.data.password,
            user.passwordHash,
          );

        /*
         * Wrong password.
         */
        if (!passwordMatches) {
          await recordLoginFailure(
            email,
          );

          return null;
        }

        const isParent =
          user.role ===
          "PARENT";

        /*
         * Correct password but wrong
         * portal is still an invalid
         * login attempt.
         */
        if (
          parsed.data.portal ===
            "parent" &&
          !isParent
        ) {
          await recordLoginFailure(
            email,
          );

          return null;
        }

        if (
          parsed.data.portal ===
            "staff"
        ) {
          if (
            !STAFF_LOGIN_ROLES.includes(
              user.role as
                (typeof STAFF_LOGIN_ROLES)[number],
            )
          ) {
            await recordLoginFailure(
              email,
            );

            return null;
          }
        }

        /*
         * Successful authentication.
         *
         * Reset all failures so the user
         * starts with a clean counter.
         */
        await clearLoginFailures(
          email,
        );

        await prisma.user.update({
          where: {
            id: user.id,
          },

          data: {
            lastLoginAt:
              new Date(),
          },
        });

        return {
          id:
            user.id,

          name:
            user.fullName,

          email:
            user.email,

          role:
            user.role,

          status:
            user.status,

          schoolId:
            user.schoolId,

          /*
           * Passed to the JWT callback
           * in auth.config.ts.
           */
          portal:
            parsed.data.portal,

          rememberMe:
            parsed.data.portal ===
              "staff" &&
            parsed.data
              .rememberMe ===
              "1",
        };
      },
    }),
  ],
});