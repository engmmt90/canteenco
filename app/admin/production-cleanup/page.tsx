import Link from "next/link";

import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

import { deleteTrialData } from "./actions";

type Props = {
  searchParams?: Promise<{
    done?: string;
  }>;
};

export default async function ProductionCleanupPage({
  searchParams,
}: Props) {
  const session = await requireAdmin();

  if (session.user.role !== "SUPER_ADMIN") {
    return (
      <main style={{ maxWidth: 760, margin: "40px auto", padding: 20 }}>
        <h1>Production Cleanup</h1>
        <p>Super Admin only.</p>
        <Link href="/admin">Back to dashboard</Link>
      </main>
    );
  }

  const params = await searchParams;

  const [
    parents,
    students,
    wallets,
    sales,
    preOrders,
    topUps,
    walletTransactions,
    notifications,
    registrations,
    auditLogs,
    staffAttendances,
  ] = await Promise.all([
    prisma.user.count({ where: { role: "PARENT" } }),
    prisma.student.count(),
    prisma.wallet.count(),
    prisma.sale.count(),
    prisma.preOrder.count(),
    prisma.topUpRequest.count(),
    prisma.walletTransaction.count(),
    prisma.notification.count(),
    prisma.parentRegistrationRequest.count(),
    prisma.auditLog.count(),
    prisma.staffAttendance.count(),
  ]);

  const rows = [
    ["Parent accounts", parents],
    ["Students", students],
    ["Wallets", wallets],
    ["Sales", sales],
    ["Pre-orders", preOrders],
    ["Top-up requests", topUps],
    ["Wallet transactions", walletTransactions],
    ["Notifications", notifications],
    ["Registration requests", registrations],
    ["Audit logs", auditLogs],
    ["Staff attendance records", staffAttendances],
  ] as const;

  return (
    <main style={{ maxWidth: 760, margin: "40px auto", padding: 20 }}>
      <Link href="/admin">← Back to dashboard</Link>

      <h1 style={{ marginTop: 24 }}>Production Cleanup</h1>

      {params?.done === "1" ? (
        <div
          style={{
            padding: 16,
            border: "1px solid #16a34a",
            borderRadius: 10,
            marginBottom: 20,
          }}
        >
          Cleanup completed successfully.
        </div>
      ) : null}

      <p>
        Review the counts below. This cleanup removes trial operational data
        while keeping schools, products, prices, options, pickup slots and
        Admin / School Admin / Cashier / Staff accounts.
      </p>

      <div
        style={{
          border: "1px solid #ddd",
          borderRadius: 10,
          overflow: "hidden",
          margin: "24px 0",
        }}
      >
        {rows.map(([label, value], index) => (
          <div
            key={label}
            style={{
              display: "flex",
              justifyContent: "space-between",
              padding: "12px 16px",
              borderTop: index ? "1px solid #eee" : undefined,
            }}
          >
            <span>{label}</span>
            <strong>{value}</strong>
          </div>
        ))}
      </div>

      <div
        style={{
          border: "2px solid #dc2626",
          borderRadius: 10,
          padding: 18,
        }}
      >
        <h2 style={{ marginTop: 0 }}>Delete trial data</h2>
        <p>
          This action is permanent. Type <strong>DELETE TEST DATA</strong>{" "}
          exactly, then press the button.
        </p>

        <form action={deleteTrialData}>
          <input
            name="confirmation"
            required
            autoComplete="off"
            placeholder="DELETE TEST DATA"
            style={{
              width: "100%",
              padding: 12,
              marginBottom: 12,
              boxSizing: "border-box",
            }}
          />

          <button
            type="submit"
            style={{
              padding: "12px 18px",
              fontWeight: 700,
            }}
          >
            Delete trial data permanently
          </button>
        </form>
      </div>
    </main>
  );
}
