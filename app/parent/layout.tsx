import { requireParent } from "@/lib/authz";

export default async function ParentLayout({ children }: { children: React.ReactNode }) {
  await requireParent();
  return children;
}
