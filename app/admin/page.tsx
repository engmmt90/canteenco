const links = ["Dashboard","Schools","Parents","Students","Cashiers","Products","Wallets","Top-up Requests","Pre-Orders","Sales","Reports","Notifications","Settings"];
export default function AdminDashboardPage() {
  return (
    <main className="dashboard">
      <aside className="sidebar"><h1>CanteenCo</h1><nav className="nav">{links.map((x)=><a href="#" key={x}>{x}</a>)}</nav></aside>
      <section className="content"><h2>Super Admin Dashboard</h2><p className="subtle">Foundation UI — live data will be connected after authentication and API services.</p><div className="grid">
        <div className="stat">Today&apos;s sales<strong>$0.00</strong></div>
        <div className="stat">Pending student approvals<strong>0</strong></div>
        <div className="stat">Pending top-ups<strong>0</strong></div>
        <div className="stat">Pre-orders today<strong>0</strong></div>
        <div className="stat">Negative wallets<strong>0</strong></div>
        <div className="stat">Schools<strong>0</strong></div>
      </div></section>
    </main>
  );
}
