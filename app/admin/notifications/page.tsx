import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

export default async function AdminNotificationsPage({searchParams}:{searchParams:Promise<{channel?:string;state?:string;q?:string}>}){
  await requireAdmin();
  const p=await searchParams;
  const channel=p.channel||"";
  const state=p.state||"";
  const q=(p.q||"").trim();
  const where:any={
    ...(channel?{channel}:{}),
    ...(state==="sent"?{sentAt:{not:null}}:{}),
    ...(state==="failed"?{failedAt:{not:null}}:{}),
    ...(state==="pending"?{sentAt:null,failedAt:null,channel:{in:["EMAIL","SMS"]}}:{}),
    ...(q?{OR:[
      {subject:{contains:q,mode:"insensitive"}},
      {message:{contains:q,mode:"insensitive"}},
      {user:{email:{contains:q,mode:"insensitive"}}},
      {user:{fullName:{contains:q,mode:"insensitive"}}},
    ]}:{})
  };
  const [rows,pending,failed,sentToday]=await Promise.all([
    prisma.notification.findMany({where,include:{user:true},orderBy:{createdAt:"desc"},take:300}),
    prisma.notification.count({where:{channel:{in:["EMAIL","SMS"]},sentAt:null,failedAt:null}}),
    prisma.notification.count({where:{failedAt:{not:null}}}),
    prisma.notification.count({where:{sentAt:{gte:new Date(new Date().setHours(0,0,0,0))}}}),
  ]);

  return <main className="content">
    <div className="page-heading">
      <div><h1 className="brand">Admin Notifications</h1><p className="subtle">Monitor queued, sent and failed notifications.</p></div>
      <Link className="secondary" href="/admin">Dashboard</Link>
    </div>
    <div className="grid">
      <div className="stat">Pending delivery<strong>{pending}</strong></div>
      <div className="stat">Failed<strong>{failed}</strong></div>
      <div className="stat">Sent today<strong>{sentToday}</strong></div>
    </div>
    <form className="panel actions-row" style={{marginTop:18}}>
      <input className="input" name="q" defaultValue={q} placeholder="Recipient, subject or message"/>
      <select className="input" name="channel" defaultValue={channel}><option value="">All channels</option><option>IN_APP</option><option>EMAIL</option><option>SMS</option><option>PUSH</option></select>
      <select className="input" name="state" defaultValue={state}><option value="">All states</option><option value="pending">Pending</option><option value="sent">Sent</option><option value="failed">Failed</option></select>
      <button className="primary">Filter</button>
    </form>
    <section className="panel" style={{marginTop:18}}>
      <div className="request-list">
        {rows.map(n=><article className="request-card" key={n.id}>
          <div className="request-head">
            <div><strong>{n.subject||n.event}</strong><div className="subtle compact">{n.user.fullName} · {n.user.email}</div></div>
            <span className="badge">{n.channel}</span>
          </div>
          <p className="compact">{n.message}</p>
          <div className="subtle compact">
            Attempts {n.attemptCount} · {n.sentAt?`Sent ${n.sentAt.toLocaleString("en-AU")}`:n.failedAt?`Failed ${n.failedAt.toLocaleString("en-AU")}`:"Pending"}
            {n.failureReason?` · ${n.failureReason}`:""}
          </div>
        </article>)}
      </div>
    </section>
  </main>;
}
