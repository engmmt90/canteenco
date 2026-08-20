import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { adminSchoolScope } from "@/lib/admin-scope";

function startOfToday(){const d=new Date();d.setHours(0,0,0,0);return d}
function money(v:unknown){return `$${Number(v).toFixed(2)}`}

export default async function ReportsPage({searchParams}:{searchParams:Promise<{school?:string;q?:string}>}){
 const {session,schoolId:forcedSchool}=await adminSchoolScope(); const params=await searchParams;
 const schoolId=forcedSchool || params.school || undefined; const q=(params.q||"").trim();
 const today=startOfToday();
 const saleWhere:any={createdAt:{gte:today},status:"COMPLETED"}; if(schoolId)saleWhere.schoolId=schoolId;
 const preorderWhere:any={pickupDate:{gte:today,lt:new Date(today.getTime()+86400000)}};if(schoolId)preorderWhere.schoolId=schoolId;
 const studentWhere:any={status:"ACTIVE",deletedAt:null};if(schoolId)studentWhere.schoolId=schoolId;if(q)studentWhere.OR=[{displayCode:{contains:q,mode:"insensitive"}},{firstName:{contains:q,mode:"insensitive"}},{lastName:{contains:q,mode:"insensitive"}}];
 const [salesAgg,salesCount,preorders,students,schools,negativeWallets,walletAgg,recentSales]=await Promise.all([
  prisma.sale.aggregate({where:saleWhere,_sum:{total:true}}),
  prisma.sale.count({where:saleWhere}),
  prisma.preOrder.count({where:preorderWhere}),
  prisma.student.count({where:studentWhere}),
  prisma.school.findMany({where:{isActive:true,deletedAt:null},orderBy:{name:"asc"}}),
  prisma.wallet.count({where:{balance:{lt:0},...(schoolId?{parent:{students:{some:{schoolId,status:"ACTIVE"}}}}:{})}}),
  prisma.wallet.aggregate({where:schoolId?{parent:{students:{some:{schoolId,status:"ACTIVE"}}}}:{},_sum:{balance:true}}),
  prisma.sale.findMany({where:{...saleWhere,...(q?{student:{OR:[{displayCode:{contains:q,mode:"insensitive"}},{firstName:{contains:q,mode:"insensitive"}},{lastName:{contains:q,mode:"insensitive"}}]}}:{})},include:{student:true,school:true,cashier:true},orderBy:{createdAt:"desc"},take:50})
 ]);
 return <main className="content"><div className="page-heading"><div><h1 className="brand">Reports</h1><p className="subtle">Operational view across sales, wallets, students and pre-orders.</p></div><Link className="secondary" href="/admin">Dashboard</Link></div>
 <form className="panel actions-row" style={{marginBottom:18}}>{session.user.role==="SUPER_ADMIN"?<select className="input" name="school" defaultValue={schoolId||""}><option value="">All schools</option>{schools.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select>:null}<input className="input" name="q" defaultValue={q} placeholder="Student name or 3C-001"/><button className="primary">Apply</button><a className="secondary" href={`/api/admin/reports/sales.csv${schoolId?`?school=${schoolId}`:""}`}>Export Sales CSV</a></form>
 <div className="grid"><div className="stat">Today’s sales<strong>{money(salesAgg._sum.total||0)}</strong><span>{salesCount} transactions</span></div><div className="stat">Pre-orders today<strong>{preorders}</strong></div><div className="stat">Active students<strong>{students}</strong></div><div className="stat">Negative wallets<strong>{negativeWallets}</strong></div><div className="stat">Total wallet balance<strong>{money(walletAgg._sum.balance||0)}</strong></div></div>
 <section className="panel" style={{marginTop:18}}><h2>Recent sales</h2><div className="request-list">{recentSales.length===0?<p className="subtle">No matching sales.</p>:recentSales.map(s=><div className="list-row" key={s.id}><div><strong>{s.student.firstName} {s.student.lastName} · {s.student.displayCode}</strong><div className="subtle compact">{s.school.name} · {s.cashier.fullName} · {s.createdAt.toLocaleString("en-AU")}</div></div><strong>{money(s.total)}</strong></div>)}</div></section></main>
}
