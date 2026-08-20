import { requireAdmin } from "@/lib/authz";

export async function adminSchoolScope() {
  const session = await requireAdmin();
  return {
    session,
    schoolId: session.user.role === "SCHOOL_ADMIN" ? session.user.schoolId ?? "__NO_SCHOOL__" : undefined,
  };
}
