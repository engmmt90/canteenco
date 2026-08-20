const products = ["Sandwich", "Water", "Juice", "Snack"];
export default function CashierPage() {
  return (
    <main className="cashier">
      <h1 className="brand">CanteenCo Cashier</h1>
      <div className="panel"><label className="label">Scan QR, enter student code, or search name<input className="input" placeholder="3C-001" /></label></div>
      <section className="cashier-grid">
        <div className="panel"><h2>Products</h2><div className="products">{products.map((p)=><button className="product" key={p}><strong>{p}</strong><br/><span className="subtle">Price from database</span></button>)}</div></div>
        <aside className="panel"><h2>Current Sale</h2><p className="subtle">Select a student first. Balance and eligibility will appear before products can be sold.</p><div className="divider"/><strong>Total: $0.00</strong><div style={{height:12}}/><button className="primary" style={{width:"100%"}}>Confirm Sale</button></aside>
      </section>
    </main>
  );
}
