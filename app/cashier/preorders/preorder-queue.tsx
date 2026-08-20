"use client";
import {useState} from "react";
import {markPreOrderLabelPrinted,updatePreOrderStatus} from "@/app/actions/preorders";

type O={id:string;orderNumber:string;status:string;pickupDate:string;total:number;labelPrintedAt:string|null;student:{firstName:string;lastName:string;displayCode:string;classCode:string};schoolName:string;pickupSlot:{label:string};items:Array<{id:string;name:string;quantity:number}>};
export default function PreOrderQueue({initialOrders}:{initialOrders:O[]}){
 const [orders,setOrders]=useState(initialOrders); const [message,setMessage]=useState(""); const [printOrder,setPrintOrder]=useState<O|null>(null);
 async function move(o:O,status:"PREPARING"|"READY"|"PICKED_UP"){setMessage("");const r=await updatePreOrderStatus(o.id,status);if(!r.ok){setMessage(r.error||"Update failed");return;}setOrders(xs=>status==="PICKED_UP"?xs.filter(x=>x.id!==o.id):xs.map(x=>x.id===o.id?{...x,status}:x));}
 async function printLabel(o:O){setPrintOrder(o);await markPreOrderLabelPrinted(o.id);setOrders(xs=>xs.map(x=>x.id===o.id?{...x,labelPrintedAt:new Date().toISOString()}:x));setTimeout(()=>window.print(),50);}
 const groups=orders.reduce<Record<string,O[]>>((g,o)=>{const k=`${o.pickupDate.slice(0,10)} · ${o.pickupSlot.label}`;(g[k]??=[]).push(o);return g},{});
 return <main className="cashier"><div className="page-heading"><div><h1 className="brand">Today’s Pre-Orders</h1><p className="subtle">Prepare, label and hand over orders by pickup time.</p></div><a className="secondary" href="/cashier">Walk-in Sales</a></div>{message&&<p className="alert">{message}</p>}
 {Object.entries(groups).map(([group,list])=><section className="panel" key={group} style={{marginBottom:18}}><h2>{group}</h2><div className="request-list">{list.map(o=><article className="request-card" key={o.id}><div className="request-head"><div><strong>{o.orderNumber}</strong><div className="subtle compact">{o.student.firstName} {o.student.lastName} · {o.student.displayCode} · Class {o.student.classCode}</div></div><span className="badge">{o.status}</span></div><div>{o.items.map(i=><div key={i.id}>{i.quantity} × {i.name}</div>)}</div><div className="actions-row"><button className="secondary" onClick={()=>printLabel(o)}>Print Label{o.labelPrintedAt?" ✓":""}</button>{o.status==="CONFIRMED"&&<button className="secondary" onClick={()=>move(o,"PREPARING")}>Preparing</button>}{(o.status==="CONFIRMED"||o.status==="PREPARING")&&<button className="primary" onClick={()=>move(o,"READY")}>Ready</button>}{o.status==="READY"&&<button className="primary" onClick={()=>move(o,"PICKED_UP")}>Picked Up</button>}</div></article>)}</div></section>)}
 {orders.length===0&&<section className="panel"><p>No open pre-orders.</p></section>}
 {printOrder&&<div className="print-label"><strong className="label-order">{printOrder.orderNumber}</strong><strong>{printOrder.student.firstName} {printOrder.student.lastName}</strong><span>{printOrder.student.displayCode} · Class {printOrder.student.classCode}</span><span>Pickup: {printOrder.pickupSlot.label}</span></div>}
 </main>
}
