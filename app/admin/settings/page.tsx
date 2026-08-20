import Link from "next/link";
import { requireAdmin } from "@/lib/authz";

function yes(v?:string){return Boolean(v&&v.trim())}

export default async function SystemSettingsPage(){
  await requireAdmin();
  const emailReady=yes(process.env.RESEND_API_KEY)&&yes(process.env.NOTIFICATION_EMAIL_FROM);
  const smsReady=yes(process.env.TWILIO_ACCOUNT_SID)&&yes(process.env.TWILIO_AUTH_TOKEN)&&yes(process.env.TWILIO_FROM_NUMBER);
  const workerReady=yes(process.env.NOTIFICATION_WORKER_SECRET);
  const dbReady=yes(process.env.DATABASE_URL);
  const authReady=yes(process.env.AUTH_SECRET);

  return <main className="content">
    <div className="page-heading">
      <div><h1 className="brand">System Settings</h1><p className="subtle">Environment readiness and platform-level configuration status.</p></div>
      <Link className="secondary" href="/admin">Dashboard</Link>
    </div>
    <div className="grid">
      <div className="stat">Database<strong>{dbReady?"READY":"MISSING"}</strong></div>
      <div className="stat">Authentication<strong>{authReady?"READY":"MISSING"}</strong></div>
      <div className="stat">Email provider<strong>{emailReady?"READY":"NOT CONFIGURED"}</strong></div>
      <div className="stat">SMS provider<strong>{smsReady?"READY":"NOT CONFIGURED"}</strong></div>
      <div className="stat">Notification worker<strong>{workerReady?"READY":"MISSING"}</strong></div>
    </div>
    <section className="panel" style={{marginTop:18}}>
      <h2>Security note</h2>
      <p className="subtle">This page shows configuration status only. API keys, passwords and secrets are never displayed in the admin interface.</p>
    </section>
  </main>;
}
