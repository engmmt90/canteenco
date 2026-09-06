import type { NextAuthConfig } from "next-auth";

const STAFF_NORMAL_SESSION_SECONDS =
  60 * 60 * 12; // 12 hours

const STAFF_REMEMBER_SESSION_SECONDS =
  60 * 60 * 24 * 30; // 30 days

export const authConfig = {
  pages: {
    signIn: "/",
  },

  callbacks: {
    authorized({
      auth,
      request: { nextUrl },
    }) {
      const isLoggedIn =
        Boolean(auth?.user);

      const pathname =
        nextUrl.pathname;

      const isPublicRoute =
        pathname === "/" ||
        pathname ===
          "/parent/register" ||
        pathname ===
          "/staff/login";

      if (isPublicRoute) {
        return true;
      }

      const protectedRoute =
        pathname.startsWith(
          "/admin",
        ) ||
        pathname.startsWith(
          "/cashier",
        ) ||
        pathname === "/parent" ||
        pathname.startsWith(
          "/parent/dashboard",
        ) ||
        pathname.startsWith(
          "/staff/redirect",
        );

      if (protectedRoute) {
        return isLoggedIn;
      }

      return true;
    },

    jwt({
      token,
      user,
    }) {
      /*
       * New successful login.
       */
      if (user) {
        token.role =
          user.role;

        token.schoolId =
          user.schoolId ??
          null;

        token.status =
          user.status;

        const loginUser =
          user as typeof user & {
            portal?: string;
            rememberMe?: boolean;
          };

        /*
         * Apply custom expiry only
         * to Staff/Admin/Cashier login.
         */
        if (
          loginUser.portal ===
          "staff"
        ) {
          const sessionSeconds =
            loginUser.rememberMe
              ? STAFF_REMEMBER_SESSION_SECONDS
              : STAFF_NORMAL_SESSION_SECONDS;

          token.staffSessionExpiresAt =
            Date.now() +
            sessionSeconds *
              1000;
        }
      }

      /*
       * Force normal Staff sessions
       * to expire after 12 hours.
       */
      if (
        typeof token
          .staffSessionExpiresAt ===
          "number" &&
        Date.now() >=
          token.staffSessionExpiresAt
      ) {
        return null;
      }

      return token;
    },

    session({
      session,
      token,
    }) {
      if (session.user) {
        session.user.id =
          token.sub ?? "";

        session.user.role =
          token.role as string;

        session.user.schoolId =
          (token.schoolId as
            | string
            | null
            | undefined) ??
          null;

        session.user.status =
          token.status as string;
      }

      return session;
    },
  },

  providers: [],
} satisfies NextAuthConfig;