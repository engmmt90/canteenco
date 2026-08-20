export default function ParentLoginPage() {
  return (
    <main className="shell">
      <section className="card">
        <h1 className="brand">CanteenCo</h1>
        <p className="subtle">Parent Portal — manage your family wallet, children and pre-orders.</p>
        <form className="form">
          <label className="label">Email<input className="input" type="email" name="email" autoComplete="email" /></label>
          <label className="label">Password<input className="input" type="password" name="password" autoComplete="current-password" /></label>
          <button className="primary" type="submit">Parent Login</button>
        </form>
        <div className="divider" />
        <div className="stack"><a className="secondary" href="/parent/register">Create Parent Account</a></div>
      </section>
    </main>
  );
}
