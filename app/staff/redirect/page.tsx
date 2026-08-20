import { redirect } from "next/navigation";
import { auth } from "@/auth";

export default async function StaffRedirectPage() {
  const session = await auth();
  if (!session?.user) redirect("/staff/login");

  if (session.user.role === "CASHIER") redirect("/cashier");
  if (session.user.role === "SUPER_ADMIN" || session.user.role === "SCHOOL_ADMIN") redirect("/admin");
  if (session.user.role === "PARENT") redirect("/parent");

  redirect("/");
}
