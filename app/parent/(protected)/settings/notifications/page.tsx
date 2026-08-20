import Link from "next/link";
import { saveNotificationPreferences } from "@/app/actions/notification-preferences";
import { requireParent } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function NotificationSettingsPage() {
  const session = await requireParent();
  const parent = await prisma.parentProfile.findUnique({
    where: { userId: session.user.id },
    include: { notificationPreference: true },
  });
  const p = parent?.notificationPreference;

  return <main className="content">
    <div className="page-heading">
      <div><h1 className="brand">Notification Preferences</h1><p className="subtle">Choose how and when CanteenCo contacts you.</p></div>
      <Link className="secondary" href="/parent/dashboard">Dashboard</Link>
    </div>

    <form action={saveNotificationPreferences} className="panel form">
      <h2>Delivery channels</h2>
      <label><input type="checkbox" name="emailEnabled" defaultChecked={p?.emailEnabled ?? true}/> Email</label>
      <label><input type="checkbox" name="smsEnabled" defaultChecked={p?.smsEnabled ?? false}/> SMS</label>
      <label><input type="checkbox" name="pushEnabled" defaultChecked={p?.pushEnabled ?? false}/> App push notifications (future mobile app)</label>

      <div className="divider"/>
      <h2>Events</h2>
      <label><input type="checkbox" name="notifyTopUp" defaultChecked={p?.notifyTopUp ?? true}/> Top-up requests and confirmations</label>
      <label><input type="checkbox" name="notifyPurchase" defaultChecked={p?.notifyPurchase ?? true}/> Canteen purchases</label>
      <label><input type="checkbox" name="notifyPreOrder" defaultChecked={p?.notifyPreOrder ?? true}/> Pre-order confirmations and ready notices</label>
      <label><input type="checkbox" name="notifyPickup" defaultChecked={p?.notifyPickup ?? true}/> Pre-order picked up</label>
      <label><input type="checkbox" name="notifyRefund" defaultChecked={p?.notifyRefund ?? true}/> Refunds and cancellations</label>
      <label><input type="checkbox" name="notifyLowBalance" defaultChecked={p?.notifyLowBalance ?? true}/> Low family-wallet balance</label>

      <label className="label">Low balance alert amount (AUD)
        <input className="input" name="lowBalanceThreshold" type="number" min="0" max="1000" step="0.01" defaultValue={p?.lowBalanceThreshold?.toString() ?? "10.00"}/>
      </label>

      <button className="primary" type="submit">Save Preferences</button>
    </form>
  </main>;
}
