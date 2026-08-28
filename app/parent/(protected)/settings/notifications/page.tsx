import Link from "next/link";

import { requireParent } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

import NotificationPreferencesForm from "./notification-preferences-form";

export default async function NotificationSettingsPage() {
  const session = await requireParent();

  const parent =
    await prisma.parentProfile.findUnique({
      where: {
        userId: session.user.id,
      },
      include: {
        notificationPreference: true,
      },
    });

  const p = parent?.notificationPreference;

  return (
    <main className="content">
      <div className="page-heading">
        <div>
          <h1 className="brand">
            Notification Preferences
          </h1>

          <p className="subtle">
            Choose how and when CanteenCo contacts you.
          </p>
        </div>

        <Link
          className="secondary"
          href="/parent/dashboard"
        >
          Dashboard
        </Link>
      </div>

      <NotificationPreferencesForm
        initialValues={{
          emailEnabled:
            p?.emailEnabled ?? true,
          smsEnabled:
            p?.smsEnabled ?? false,
          pushEnabled:
            p?.pushEnabled ?? false,
          notifyTopUp:
            p?.notifyTopUp ?? true,
          notifyPurchase:
            p?.notifyPurchase ?? true,
          notifyPreOrder:
            p?.notifyPreOrder ?? true,
          notifyPickup:
            p?.notifyPickup ?? true,
          notifyRefund:
            p?.notifyRefund ?? true,
          notifyLowBalance:
            p?.notifyLowBalance ?? true,
          lowBalanceThreshold:
            p?.lowBalanceThreshold?.toString() ??
            "10.00",
        }}
      />
    </main>
  );
}
