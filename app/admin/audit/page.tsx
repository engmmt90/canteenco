import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

export default async function AuditPage({searchParams}:{searchParams:Promise<{q?:string;entity?:string}>}){
  const session=await requireAdmin();
  const p=await searchParams;
  const q=(p.q||"").trim();
  const entity=(p.entity||"").trim();

  const rows=await prisma.auditLog.findMany({
    where:{
      ...(entity?{entityType:entity}:{}),
      ...(q?{OR:[
        {action:{contains:q,mode:"insensitive"}},
        {entityType:{contains:q,mode:"insensitive"}},
        {entityId:{contains:q,mode:"insensitive"}},
        {actor:{fullName:{contains:q,mode:"insensitive"}}},
        {actor:{email:{contains:q,mode:"insensitive"}}},
      ]}:{}),
      ...(session.user.role==="SCHOOL_ADMIN"&&session.user.schoolId?{
        actor:{schoolId:session.user.schoolId}
      }:{})
    },
    include:{actor:true},
    orderBy:{createdAt:"desc"},
    take:300,
  });

  return <main className="content">
    <div className="page-heading">
      <div><h1 className="brand">Audit Log</h1><p className="subtle">Immutable administrative activity trail.</p></div>
      <Link className="secondary" href="/admin">Dashboard</Link>
    </div>
    <form className="panel actions-row">
      <input className="input" name="q" defaultValue={q} placeholder="Action, user or entity ID"/>
      <input className="input" name="entity" defaultValue={entity} placeholder="Entity type e.g. Sale"/>
      <button className="primary">Filter</button>
    </form>
    <section className="panel" style={{marginTop:18}}>
      <div className="request-list">
        {rows.length===0?<p className="subtle compact">No audit events found.</p>:rows.map(r=>
          <article className="list-row" key={r.id}>
            <div>
              <strong>{r.action}</strong>
              <div className="subtle compact">{r.actor.fullName} · {r.actor.email}</div>
              <div className="subtle compact">{r.entityType}{r.entityId?` · ${r.entityId}`:""}</div>
            </div>
            <span className="subtle compact">{r.createdAt.toLocaleString("en-AU")}</span>
          </article>
        )}
      </div>
    </section>
  </main>;
}
