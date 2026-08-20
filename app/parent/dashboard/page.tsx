export default function ParentDashboardPage() {
  return (
    <main className="content">
      <h1 className="brand">Family Wallet</h1>
      <div className="grid"><div className="stat">Available balance<strong>$0.00</strong></div><div className="stat">Children<strong>0</strong></div><div className="stat">Pre-orders<strong>0</strong></div></div>
      <div style={{height:18}}/><section className="panel"><h2>Children</h2><p className="subtle">Approved children will appear here with their school, class, student code and purchase history.</p></section>
    </main>
  );
}
