import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { z } from "zod";

import { authConfig } from "@/auth.config";
import { prisma } from "@/lib/prisma";

const credentialsSchema = z.object({
  email: z
    .string()
    .email()
    .transform((value) =>
      value.toLowerCase(),
    ),
  password: z.string().min(8),
  portal: z.enum([
    "parent",
    "staff",
  ]),
});

const STAFF_LOGIN_ROLES = [
  "SUPER_ADMIN",
  "SCHOOL_ADMIN",
  "CASHIER",
] as const;

export const {
  auth,
  handlers,
  signIn,
  signOut,
} = NextAuth({
  ...authConfig,

  session: {
    strategy: "jwt",
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
      },

      async authorize(
        rawCredentials,
      ) {
        const parsed =
          credentialsSchema.safeParse(
            rawCredentials,
          );

        if (!parsed.success) {
          return null;
        }

        const user =
          await prisma.user.findUnique({
            where: {
              email:
                parsed.data.email,
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

        if (
          !user ||
          user.status !== "ACTIVE"
        ) {
          return null;
        }

        const passwordMatches =
          await bcrypt.compare(
            parsed.data.password,
            user.passwordHash,
          );

        if (!passwordMatches) {
          return null;
        }

        const isParent =
          user.role === "PARENT";

        if (
          parsed.data.portal ===
            "parent" &&
          !isParent
        ) {
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
            return null;
          }
        }

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
          id: user.id,
          name: user.fullName,
          email: user.email,
          role: user.role,
          status: user.status,
          schoolId:
            user.schoolId,
        };
      },
    }),
  ],
});