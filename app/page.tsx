import Link from "next/link";
import { parentLogin } from "@/app/actions/auth";

type PageProps = {
  searchParams: Promise<{ error?: string }>;
};

export default async function ParentLoginPage({ searchParams }: PageProps) {
  const { error } = await searchParams;

  return (
    <main className="shell">
      <section className="card">
        <h1 className="brand">CanteenCo</h1>
        <p className="subtle">Parent Portal — manage your family wallet, children and pre-orders.</p>
        {error === "invalid_credentials" ? (
          <p className="alert" role="alert">Invalid email or password, or your account is not active yet.</p>
        ) : null}
        <form className="form" action={parentLogin}>
          <label className="label">Email<input className="input" type="email" name="email" autoComplete="email" required /></label>
          <label className="label">Password<input className="input" type="password" name="password" autoComplete="current-password" minLength={8} required /></label>
          <button className="primary" type="submit">Parent Login</button>
        </form>
        <div className="divider" />
        <div className="stack"><Link className="secondary" href="/parent/register">Create Parent Account</Link></div>
      </section>
    </main>
  );
}
