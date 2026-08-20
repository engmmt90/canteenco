export default function StaffLoginPage() {
  return (
    <main className="shell">
      <section className="card">
        <h1 className="brand">CanteenCo Staff</h1>
        <p className="subtle">Admin and cashier access only.</p>
        <form className="form">
          <label className="label">Email<input className="input" type="email" name="email" /></label>
          <label className="label">Password<input className="input" type="password" name="password" /></label>
          <button className="primary" type="submit">Staff Login</button>
        </form>
      </section>
    </main>
  );
}
