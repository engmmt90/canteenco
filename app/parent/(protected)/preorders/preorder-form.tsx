"use client";
import { useMemo, useState } from "react";
import { createParentPreOrder } from "@/app/actions/preorders";

type Props={data:{walletBalance:number;students:Array<{id:string;firstName:string;lastName:string;displayCode:string;schoolId:string;schoolName:string;preOrderEnabled:boolean;cutoffTime:string;pickupSlots:Array<{id:string;label:string}>}>;products:Array<{id:string;name:string;price:number;category:string|null}>}};

export default function PreOrderForm({data}:Props){
 const [studentId,setStudentId]=useState(data.students[0]?.id||"");
 const student=data.students.find(s=>s.id===studentId);
 const [slotId,setSlotId]=useState(student?.pickupSlots[0]?.id||"");
 const [pickupDate,setPickupDate]=useState("");
 const [cart,setCart]=useState<Record<string,number>>({});
 const [busy,setBusy]=useState(false); const [message,setMessage]=useState("");
 const [key,setKey]=useState(()=>crypto.randomUUID());
 const total=useMemo(()=>data.products.reduce((n,p)=>n+p.price*(cart[p.id]||0),0),[data.products,cart]);
 function changeStudent(id:string){setStudentId(id);const s=data.students.find(x=>x.id===id);setSlotId(s?.pickupSlots[0]?.id||"");}
 async function submit(){if(!studentId||!slotId||!pickupDate||total<=0)return;setBusy(true);setMessage("");const items=Object.entries(cart).filter(([,q])=>q>0).map(([productId,quantity])=>({productId,quantity}));const r=await createParentPreOrder({studentId,pickupSlotId:slotId,pickupDate,items,idempotencyKey:key});setBusy(false);if(!r.ok){setMessage(r.error||"Order failed");return;}setMessage(`Order ${r.orderNumber} confirmed. New family balance: $${r.balanceAfter}`);setCart({});setKey(crypto.randomUUID());}
 return <div className="wallet-layout">
   <section className="panel">
     <label className="label">Student<select className="input" value={studentId} onChange={e=>changeStudent(e.target.value)}>{data.students.map(s=><option key={s.id} value={s.id}>{s.firstName} {s.lastName} · {s.displayCode} · {s.schoolName}</option>)}</select></label>
     {student&&<><p className="subtle compact">Orders close at {student.cutoffTime} for same-day pickup.</p><label className="label">Pickup date<input className="input" type="date" value={pickupDate} onChange={e=>setPickupDate(e.target.value)}/></label><label className="label">Pickup time<select className="input" value={slotId} onChange={e=>setSlotId(e.target.value)}>{student.pickupSlots.map(s=><option key={s.id} value={s.id}>{s.label}</option>)}</select></label></>}
     <div className="divider"/><h2>Products</h2><div className="products">{data.products.map(p=><button className="product" key={p.id} type="button" onClick={()=>setCart(c=>({...c,[p.id]:(c[p.id]||0)+1}))}><strong>{p.name}</strong><br/>${p.price.toFixed(2)}{cart[p.id]?` × ${cart[p.id]}`:""}</button>)}</div>
   </section>
   <aside className="panel"><h2>Order Summary</h2><p>Family balance: <strong>${data.walletBalance.toFixed(2)}</strong></p>{data.products.filter(p=>cart[p.id]).map(p=><div className="list-row" key={p.id}><span>{p.name} × {cart[p.id]}</span><button type="button" onClick={()=>setCart(c=>({...c,[p.id]:Math.max(0,(c[p.id]||0)-1)}))}>−</button></div>)}<div className="divider"/><strong>Total: ${total.toFixed(2)}</strong><p>Projected balance: ${(data.walletBalance-total).toFixed(2)}</p><button className="primary" disabled={busy||total<=0||!pickupDate||!slotId} onClick={submit}>{busy?"Processing…":"Place Order"}</button>{message&&<p>{message}</p>}</aside>
 </div>
}
