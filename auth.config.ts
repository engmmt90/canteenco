import type { NextAuthConfig } from "next-auth";

export const authConfig = {
  pages: {
    signIn: "/",
  },
  callbacks: {
    authorized({ auth, request: { nextUrl } }) {
      const isLoggedIn = Boolean(auth?.user);
      const pathname = nextUrl.pathname;

      const isPublicRoute =
        pathname === "/" ||
        pathname === "/parent/register" ||
        pathname === "/staff/login";

      if (isPublicRoute) return true;

      const protectedRoute =
        pathname.startsWith("/admin") ||
        pathname.startsWith("/cashier") ||
        pathname === "/parent" ||
        pathname.startsWith("/parent/dashboard") ||
        pathname.startsWith("/staff/redirect");

      if (protectedRoute) return isLoggedIn;
      return true;
    },
    jwt({ token, user }) {
      if (user) {
        token.role = user.role;
        token.schoolId = user.schoolId ?? null;
        token.status = user.status;
      }
      return token;
    },
    session({ session, token }) {
      if (session.user) {
        session.user.id = token.sub ?? "";
        session.user.role = token.role as string;
        session.user.schoolId = (token.schoolId as string | null | undefined) ?? null;
        session.user.status = token.status as string;
      }
      return session;
    },
  },
  providers: [],
} satisfies NextAuthConfig;
