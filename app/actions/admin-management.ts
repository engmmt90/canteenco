"use server";
import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

function str(f:FormData,k:string){return String(f.get(k)??"").trim()}
function bool(f:FormData,k:string){return f.get(k)==="on"}

export async function saveSchool(f:FormData){
 const s=await requireAdmin(); if(s.user.role!=="SUPER_ADMIN") throw new Error("Super Admin only");
 const id=str(f,"id"),name=str(f,"name"),code=str(f,"code").toUpperCase(),timezone=str(f,"timezone")||"Australia/Brisbane";
 if(!name||!code)throw new Error("School name and code are required");
 const data={name,code,address:str(f,"address")||null,phone:str(f,"phone")||null,email:str(f,"email")||null,isActive:bool(f,"isActive")};
 if(id) await prisma.school.update({where:{id},data:{...data,settings:{upsert:{create:{timezone},update:{timezone}}}}});
 else await prisma.school.create({data:{...data,settings:{create:{timezone}}}});
 revalidatePath("/admin/schools");revalidatePath("/admin");
}
export async function saveProduct(f:FormData){
 await requireAdmin();const id=str(f,"id"),name=str(f,"name"),sku=str(f,"sku").toUpperCase(),price=Number(str(f,"price")),sortOrder=Number(str(f,"sortOrder")||0);
 if(!name||!sku||!Number.isFinite(price)||price<0)throw new Error("Valid SKU, name and price are required");
 const data={sku,name,description:str(f,"description")||null,category:str(f,"category")||null,price,sortOrder:Number.isFinite(sortOrder)?sortOrder:0,isActive:bool(f,"isActive")};
 if(id)await prisma.product.update({where:{id},data});else await prisma.product.create({data});
 revalidatePath("/admin/products");
}
export async function saveStaff(f:FormData){
 const session=await requireAdmin();const id=str(f,"id"),role=str(f,"role") as "CASHIER"|"SCHOOL_ADMIN",schoolId=str(f,"schoolId");
 if(!["CASHIER","SCHOOL_ADMIN"].includes(role))throw new Error("Invalid role");
 if(session.user.role==="SCHOOL_ADMIN"&&session.user.schoolId!==schoolId)throw new Error("You can manage only your school");
 if(!schoolId)throw new Error("School is required");
 const fullName=str(f,"fullName"),email=str(f,"email").toLowerCase(),phone=str(f,"phone")||null,password=str(f,"password");
 if(!fullName||!email)throw new Error("Name and email are required");
 if(id){const existing=await prisma.user.findUnique({where:{id}});if(!existing||!["CASHIER","SCHOOL_ADMIN"].includes(existing.role))throw new Error("Staff member not found");if(session.user.role==="SCHOOL_ADMIN"&&existing.schoolId!==session.user.schoolId)throw new Error("Unauthorized");await prisma.user.update({where:{id},data:{fullName,email,phone,role,schoolId,status:bool(f,"isActive")?"ACTIVE":"DISABLED",...(password?{passwordHash:await bcrypt.hash(password,12)}:{})}})}
 else {if(password.length<8)throw new Error("Password must be at least 8 characters");await prisma.user.create({data:{fullName,email,phone,role,schoolId,status:bool(f,"isActive")?"ACTIVE":"DISABLED",passwordHash:await bcrypt.hash(password,12)}})}
 revalidatePath("/admin/staff");
}
