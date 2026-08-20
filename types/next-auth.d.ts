import "next-auth";
import "next-auth/jwt";

declare module "next-auth" {
  interface User {
    role: string;
    status: string;
    schoolId?: string | null;
  }

  interface Session {
    user: {
      id: string;
      role: string;
      status: string;
      schoolId: string | null;
      name?: string | null;
      email?: string | null;
      image?: string | null;
    };
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    role?: string;
    status?: string;
    schoolId?: string | null;
  }
}
