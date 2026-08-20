import { requireCashier } from "@/lib/authz";

export default async function CashierLayout({ children }: { children: React.ReactNode }) {
  await requireCashier();
  return children;
}
