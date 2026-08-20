"use client";
export default function PrintLabel({order}:{order:{orderNumber:string;studentName:string;displayCode:string;classCode:string;pickupLabel:string}}){
  function print(){window.print()}
  return <><button className="secondary" type="button" onClick={print}>Print / Reprint Label</button><div className="print-label"><strong className="label-order">{order.orderNumber}</strong><strong>{order.studentName}</strong><span>{order.displayCode} · Class {order.classCode}</span><span>Pickup: {order.pickupLabel}</span></div></>
}
