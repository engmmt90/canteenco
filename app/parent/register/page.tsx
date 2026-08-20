export default function ParentRegisterPage() {
  return (
    <main className="shell">
      <section className="card">
        <h1 className="brand">Create Parent Account</h1>
        <p className="subtle">Your child registration will remain pending until CanteenCo administration approves it.</p>
        <form className="form">
          <label className="label">Full name<input className="input" name="fullName" /></label>
          <label className="label">Email<input className="input" type="email" name="email" /></label>
          <label className="label">Mobile<input className="input" type="tel" name="phone" /></label>
          <label className="label">Password<input className="input" type="password" name="password" /></label>
          <button className="primary" type="submit">Continue to Add Student</button>
        </form>
      </section>
    </main>
  );
}
