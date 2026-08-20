import { redirect } from "next/navigation";
import { auth } from "@/auth";

export async function requireParent() {
  const session = await auth();
  if (!session?.user) redirect("/");
  if (session.user.role !== "PARENT") redirect("/staff/redirect");
  return session;
}

export async function requireCashier() {
  const session = await auth();
  if (!session?.user) redirect("/staff/login");
  if (session.user.role !== "CASHIER") redirect("/staff/redirect");
  return session;
}

export async function requireAdmin() {
  const session = await auth();
  if (!session?.user) redirect("/staff/login");
  if (session.user.role !== "SUPER_ADMIN" && session.user.role !== "SCHOOL_ADMIN") {
    redirect("/staff/redirect");
  }
  return session;
}
