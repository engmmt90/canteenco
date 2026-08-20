import { requireParent } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import PreOrderForm from "./preorder-form";
import { cancelOwnPreOrderFromForm } from "@/app/actions/preorders";

export default async function ParentPreOrdersPage() {
  const session = await requireParent();
  const parent = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id },
    include: {
      wallet: { include: { preOrders: { orderBy: { createdAt: "desc" }, take: 20, include: { student: true, pickupSlot: true } } } },
      students: {
        where: { status: "ACTIVE", deletedAt: null },
        include: { school: { include: { settings: true, pickupSlots: { where: { isActive: true }, orderBy: { sortOrder: "asc" } } } } },
        orderBy: [{ firstName: "asc" }, { lastName: "asc" }],
      },
    },
  });
  const products = await prisma.product.findMany({ where: { isActive: true, deletedAt: null }, orderBy: [{ sortOrder: "asc" }, { name: "asc" }] });

  const data = {
    walletBalance: Number(parent?.wallet?.balance ?? 0),
    students: (parent?.students ?? []).map(s => ({
      id: s.id, firstName: s.firstName, lastName: s.lastName, displayCode: s.displayCode,
      schoolId: s.schoolId, schoolName: s.school.name,
      preOrderEnabled: s.school.settings?.preOrderEnabled ?? false,
      cutoffTime: s.school.settings?.preOrderCutoffTime ?? "07:00",
      pickupSlots: s.school.pickupSlots.map(slot => ({ id: slot.id, label: slot.label })),
    })),
    products: products.map(p => ({ id: p.id, name: p.name, price: Number(p.price), category: p.category })),
  };

  return <main className="content"><h1 className="brand">Pre-Orders</h1><p className="subtle">Order ahead for your child and choose a pickup time.</p><PreOrderForm data={data}/>
  <section className="panel" style={{marginTop:18}}><h2>Recent Orders</h2><div className="request-list">
    {(parent?.wallet?.preOrders ?? []).length===0?<p className="subtle compact">No pre-orders yet.</p>:null}
    {(parent?.wallet?.preOrders ?? []).map(order=><div className="list-row" key={order.id}><div><strong>{order.orderNumber}</strong><div className="subtle compact">{order.student.firstName} {order.student.lastName} · {order.pickupSlot.label} · {order.status}</div></div><div className="actions-row"><strong>${Number(order.total).toFixed(2)}</strong>{order.status==="CONFIRMED"?<form action={cancelOwnPreOrderFromForm}><input type="hidden" name="orderId" value={order.id}/><button className="danger small-button" type="submit">Cancel & Refund</button></form>:null}</div></div>)}
  </div></section></main>;
}
