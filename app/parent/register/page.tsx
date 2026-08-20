import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ParentRegistrationForm } from "./registration-form";

type PageProps = {
  searchParams: Promise<{ submitted?: string }>;
};

export default async function ParentRegisterPage({ searchParams }: PageProps) {
  const { submitted } = await searchParams;

  if (submitted === "1") {
    return (
      <main className="shell">
        <section className="card">
          <h1 className="brand">Request received</h1>
          <p className="success">Your registration has been submitted for CanteenCo admin approval.</p>
          <p className="subtle">You will be able to sign in after the account is approved.</p>
          <Link className="secondary" href="/">Back to Parent Login</Link>
        </section>
      </main>
    );
  }

  const schools = await prisma.school.findMany({
    where: { isActive: true, deletedAt: null },
    orderBy: { name: "asc" },
    select: { id: true, name: true },
  });

  return (
    <main className="shell register-shell">
      <section className="card registration-card">
        <h1 className="brand">Create Parent Account</h1>
        <p className="subtle">Add your children below. Nothing becomes active until CanteenCo administration approves the request.</p>
        {schools.length ? (
          <ParentRegistrationForm schools={schools} />
        ) : (
          <p className="alert">No active schools are available yet. Please contact CanteenCo administration.</p>
        )}
      </section>
    </main>
  );
}
