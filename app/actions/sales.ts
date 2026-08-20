"use server";

import bcrypt from "bcryptjs";
import { randomUUID } from "crypto";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { Prisma, UserRole, UserStatus, StudentStatus, WalletStatus, WalletTransactionType } from "@prisma/client";

export async function findCashierStudents(query: string) {
  const session = await auth();
  if (!session?.user?.id || ![UserRole.CASHIER, UserRole.SCHOOL_ADMIN, UserRole.SUPER_ADMIN].includes(session.user.role as UserRole)) throw new Error("Unauthorized");
  const q=query.trim(); if(!q) return [];
  return prisma.student.findMany({where:{deletedAt:null,status:StudentStatus.ACTIVE,OR:[{displayCode:{equals:q,mode:"insensitive"}},{qrToken:q},{firstName:{contains:q,mode:"insensitive"}},{lastName:{contains:q,mode:"insensitive"}}]},include:{parent:{include:{wallet:true}}},take:10,orderBy:[{firstName:"asc"},{lastName:"asc"}]});
}

export async function getCashierProducts(){
  const session=await auth(); if(!session?.user?.id) throw new Error("Unauthorized");
  return prisma.product.findMany({where:{isActive:true,deletedAt:null},orderBy:[{sortOrder:"asc"},{name:"asc"}]});
}

type CartLine={productId:string;quantity:number};
export async function createCashierSale(input:{studentId:string;items:CartLine[];idempotencyKey:string;adminPassword?:string}){
 const session=await auth();
 if(!session?.user?.id || ![UserRole.CASHIER,UserRole.SCHOOL_ADMIN,UserRole.SUPER_ADMIN].includes(session.user.role as UserRole)) return {ok:false,error:"Unauthorized"};
 if(!input.idempotencyKey || !input.items.length) return {ok:false,error:"Empty sale"};
 const clean=input.items.filter(x=>Number.isInteger(x.quantity)&&x.quantity>0); if(!clean.length) return {ok:false,error:"Empty sale"};
 try{return await prisma.$transaction(async tx=>{
   const existing=await tx.sale.findUnique({where:{idempotencyKey:input.idempotencyKey}}); if(existing) return {ok:true,saleId:existing.id,duplicate:true};
   const student=await tx.student.findUnique({where:{id:input.studentId},include:{school:{include:{settings:true}},parent:{include:{wallet:true}}}});
   if(!student||student.status!==StudentStatus.ACTIVE||student.deletedAt) throw new Error("Student is not active");
   const wallet=student.parent.wallet; if(!wallet||wallet.status!==WalletStatus.ACTIVE) throw new Error("Family wallet is not active");
   const ids=[...new Set(clean.map(x=>x.productId))]; const products=await tx.product.findMany({where:{id:{in:ids},isActive:true,deletedAt:null}}); if(products.length!==ids.length) throw new Error("A product is unavailable");
   const map=new Map(products.map(p=>[p.id,p])); let total=new Prisma.Decimal(0);
   for(const line of clean) total=total.add(map.get(line.productId)!.price.mul(line.quantity));
   const settings=student.school.settings; const proposed=wallet.balance.sub(total); let approverId:string|undefined;
   if(proposed.lt(0)){
     if(!settings?.allowNegativeBalance) throw new Error("Insufficient balance");
     const minimum=settings.minimumAllowedBalance; if(proposed.lt(minimum)) throw new Error(`Sale would exceed the allowed balance limit (${minimum.toFixed(2)})`);
     if(!input.adminPassword) return {ok:false,needsAdminOverride:true,error:"Admin approval required"};
     const admins=await tx.user.findMany({where:{status:UserStatus.ACTIVE,deletedAt:null,role:{in:[UserRole.SUPER_ADMIN,UserRole.SCHOOL_ADMIN]},OR:[{role:UserRole.SUPER_ADMIN},{schoolId:student.schoolId}]}});
     let approved=null as typeof admins[number]|null; for(const a of admins){if(await bcrypt.compare(input.adminPassword,a.passwordHash)){approved=a;break;}}
     if(!approved) throw new Error("Invalid admin password"); approverId=approved.id;
   }
   // Conditional balance update prevents two simultaneous sales from both spending the same balance.
   const guarded=await tx.wallet.updateMany({where:{id:wallet.id,balance:wallet.balance},data:{balance:proposed}}); if(guarded.count!==1) throw new Error("Wallet balance changed. Please retry the sale.");
   const sale=await tx.sale.create({data:{saleNumber:`SALE-${Date.now()}-${randomUUID().slice(0,6).toUpperCase()}`,idempotencyKey:input.idempotencyKey,schoolId:student.schoolId,studentId:student.id,walletId:wallet.id,cashierUserId:session.user.id,subtotal:total,total,isOverdraftOverride:proposed.lt(0),overrideApprovedById:approverId,items:{create:clean.map(line=>{const p=map.get(line.productId)!;return {productId:p.id,productNameSnapshot:p.name,unitPrice:p.price,quantity:line.quantity,lineTotal:p.price.mul(line.quantity)}})}}});
   await tx.walletTransaction.create({data:{walletId:wallet.id,studentId:student.id,type:proposed.lt(0)?WalletTransactionType.OVERDRAFT_SALE:WalletTransactionType.SALE_DEBIT,amount:total.neg(),balanceAfter:proposed,description:`Canteen sale ${sale.saleNumber}`,saleId:sale.id}});
   return {ok:true,saleId:sale.id,saleNumber:sale.saleNumber,total:total.toFixed(2),balanceAfter:proposed.toFixed(2),overdraft:proposed.lt(0)};
 },{isolationLevel:Prisma.TransactionIsolationLevel.Serializable});}catch(e){return {ok:false,error:e instanceof Error?e.message:"Sale failed"};}
}
