import { redirect } from "next/navigation";

import { auth } from "@/auth";

export default async function StaffRedirectPage() {
  const session = await auth();

  if (!session?.user) {
    redirect("/staff/login");
  }

  if (
    session.user.role === "CASHIER"
  ) {
    redirect("/cashier");
  }

  if (
    session.user.role ===
      "SUPER_ADMIN" ||
    session.user.role ===
      "SCHOOL_ADMIN"
  ) {
    redirect("/admin");
  }

  /*
   * STAFF accounts are attendance-only.
   * They should never reach the admin or
   * cashier areas.
   */
  if (
    session.user.role === "STAFF"
  ) {
    redirect("/staff/attendance");
  }

  if (
    session.user.role === "PARENT"
  ) {
    redirect("/parent");
  }

  redirect("/");
}
