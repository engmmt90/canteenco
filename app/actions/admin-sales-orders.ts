"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { queueParentNotification } from "@/lib/notifications";
import { NotificationEvent, Prisma, SaleStatus, WalletTransactionType } from "@prisma/client";

function str(f:FormData,k:string){return String(f.get(k)??"").trim()}

export async function refundSale(formData:FormData){
 const session=await requireAdmin(); const saleId=str(formData,"saleId"),reason=str(formData,"reason")||"Admin refund";
 if(!saleId) throw new Error("Sale is required");
 await prisma.$transaction(async tx=>{
   const sale=await tx.sale.findUnique({where:{id:saleId},include:{wallet:true,student:{include:{parent:{include:{user:true}}}}}});
   if(!sale) throw new Error("Sale not found");
   if(session.user.role==="SCHOOL_ADMIN"&&session.user.schoolId!==sale.schoolId) throw new Error("Unauthorized");
   if(sale.status===SaleStatus.REFUNDED) return;
   if(sale.status!==SaleStatus.COMPLETED) throw new Error(`Sale cannot be refunded from status ${sale.status}`);

   const claimed=await tx.sale.updateMany({where:{id:sale.id,status:SaleStatus.COMPLETED},data:{status:SaleStatus.REFUNDED}});
   if(claimed.count!==1) throw new Error("Sale status changed. Refresh and try again.");
   const wallet=await tx.wallet.update({where:{id:sale.walletId},data:{balance:{increment:sale.total}},select:{balance:true}});
   await tx.walletTransaction.create({data:{walletId:sale.walletId,studentId:sale.studentId,type:WalletTransactionType.REFUND,amount:sale.total,balanceAfter:wallet.balance,description:`Refund ${sale.saleNumber}: ${reason}`,refundOfSaleId:sale.id}});
   await queueParentNotification({tx,userId:sale.student.parent.user.id,parentId:sale.student.parent.id,event:NotificationEvent.REFUND_COMPLETED,preferenceKey:"notifyRefund",subject:"Canteen purchase refunded",message:`Sale ${sale.saleNumber} for ${sale.student.firstName} ${sale.student.lastName} was refunded. $${sale.total.toFixed(2)} was returned to your family wallet. New balance: $${wallet.balance.toFixed(2)}.`,metadata:{saleId:sale.id,amount:Number(sale.total),balanceAfter:Number(wallet.balance)},schoolId:sale.schoolId});
   await tx.auditLog.create({data:{actorUserId:session.user.id,action:"REFUND_SALE",entityType:"Sale",entityId:sale.id,metadata:{saleNumber:sale.saleNumber,amount:Number(sale.total),reason,balanceAfter:Number(wallet.balance)}}});
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});
 revalidatePath("/admin/sales");revalidatePath(`/admin/sales/${saleId}`);revalidatePath("/admin/reports");revalidatePath("/admin/wallets");
}

export async function markPreOrderNotCollected(formData:FormData){
 const session=await requireAdmin();const id=str(formData,"orderId");
 const order=await prisma.preOrder.findUnique({where:{id}});if(!order)throw new Error("Order not found");
 if(session.user.role==="SCHOOL_ADMIN"&&session.user.schoolId!==order.schoolId)throw new Error("Unauthorized");
 if(!["CONFIRMED","PREPARING","READY"].includes(order.status))throw new Error("Order can no longer be marked not collected");
 await prisma.$transaction([prisma.preOrder.update({where:{id},data:{status:"NOT_COLLECTED"}}),prisma.auditLog.create({data:{actorUserId:session.user.id,action:"MARK_PREORDER_NOT_COLLECTED",entityType:"PreOrder",entityId:id}})]);
 revalidatePath("/admin/orders");revalidatePath(`/admin/orders/${id}`);
}
