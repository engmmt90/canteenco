import { requireCashier } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import PreOrderQueue from "./preorder-queue";

export default async function CashierPreOrdersPage(){
  const session=await requireCashier();
  const where:any={status:{in:["CONFIRMED","PREPARING","READY"]}};
  if(session.user.role!=="SUPER_ADMIN"&&session.user.schoolId) where.schoolId=session.user.schoolId;
  const orders=await prisma.preOrder.findMany({where,include:{student:true,school:true,pickupSlot:true,items:{include:{product:true}}},orderBy:[{pickupDate:"asc"},{pickupSlot:{sortOrder:"asc"}},{createdAt:"asc"}]});
  const plain=orders.map(o=>({id:o.id,orderNumber:o.orderNumber,status:o.status,pickupDate:o.pickupDate.toISOString(),total:Number(o.total),labelPrintedAt:o.labelPrintedAt?.toISOString()||null,student:{firstName:o.student.firstName,lastName:o.student.lastName,displayCode:o.student.displayCode,classCode:o.student.classCode},schoolName:o.school.name,pickupSlot:{label:o.pickupSlot.label},items:o.items.map(i=>({id:i.id,name:i.product.name,quantity:i.quantity}))}));
  return <PreOrderQueue initialOrders={plain}/>;
}
