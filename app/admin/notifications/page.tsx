import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

import {
  clearAdminNotifications,
  markAllAdminNotificationsRead,
} from "@/app/actions/admin-notifications";

function formatBrisbaneDateTime(
  date: Date,
) {
  return date.toLocaleString(
    "en-AU",
    {
      timeZone:
        "Australia/Brisbane",
    },
  );
}

export default async function AdminNotificationsPage({
  searchParams,
}: {
  searchParams: Promise<{
    channel?: string;
    state?: string;
    q?: string;
  }>;
}) {
  await requireAdmin();

  const p = await searchParams;

  const channel =
    p.channel || "";

  const state =
    p.state || "";

  const q =
    (p.q || "").trim();

  const filtersActive =
    Boolean(
      q ||
        channel ||
        state,
    );

  const where: any = {
    adminClearedAt: null,

    ...(channel
      ? {
          channel,
        }
      : {}),

    ...(state === "sent"
      ? {
          sentAt: {
            not: null,
          },
        }
      : {}),

    ...(state === "failed"
      ? {
          failedAt: {
            not: null,
          },
        }
      : {}),

    ...(state === "pending"
      ? {
          sentAt: null,
          failedAt: null,

          channel: {
            in: [
              "EMAIL",
              "SMS",
            ],
          },
        }
      : {}),

    ...(q
      ? {
          OR: [
            {
              subject: {
                contains: q,
                mode:
                  "insensitive",
              },
            },

            {
              message: {
                contains: q,
                mode:
                  "insensitive",
              },
            },

            {
              user: {
                email: {
                  contains: q,
                  mode:
                    "insensitive",
                },
              },
            },

            {
              user: {
                fullName: {
                  contains: q,
                  mode:
                    "insensitive",
                },
              },
            },
          ],
        }
      : {}),
  };

  const [
    rows,
    unread,
    pending,
    failed,
    sentToday,
  ] = await Promise.all([
    prisma.notification.findMany({
      where,

      include: {
        user: true,
      },

      orderBy: {
        createdAt: "desc",
      },

      take: 300,
    }),

    prisma.notification.count({
      where: {
        adminClearedAt:
          null,

        adminReadAt:
          null,
      },
    }),

    prisma.notification.count({
      where: {
        adminClearedAt:
          null,

        channel: {
          in: [
            "EMAIL",
            "SMS",
          ],
        },

        sentAt: null,
        failedAt: null,
      },
    }),

    prisma.notification.count({
      where: {
        adminClearedAt:
          null,

        failedAt: {
          not: null,
        },
      },
    }),

    prisma.notification.count({
      where: {
        adminClearedAt:
          null,

        sentAt: {
          gte: new Date(
            new Date().setHours(
              0,
              0,
              0,
              0,
            ),
          ),
        },
      },
    }),
  ]);

  return (
    <main className="content">
      <div className="page-heading">
        <div>
          <h1 className="brand">
            Admin Notifications
          </h1>

          <p className="subtle">
            Monitor queued, sent and
            failed notifications.
          </p>
        </div>

        <Link
          className="secondary"
          href="/admin"
        >
          Dashboard
        </Link>
      </div>

      <div className="grid">
        <div className="stat">
          Unread
          <strong>
            {unread}
          </strong>
        </div>

        <div className="stat">
          Pending delivery
          <strong>
            {pending}
          </strong>
        </div>

        <div className="stat">
          Failed
          <strong>
            {failed}
          </strong>
        </div>

        <div className="stat">
          Sent today
          <strong>
            {sentToday}
          </strong>
        </div>
      </div>

      <section
        className="panel"
        style={{
          marginTop: 18,
        }}
      >
        <div
          className="actions-row"
          style={{
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: 12,
            flexWrap:
              "wrap",
          }}
        >
          <strong>
            Notification Actions
          </strong>

          <div className="actions-row">
            <form
              action={
                markAllAdminNotificationsRead
              }
            >
              <button
                className="secondary"
                type="submit"
                disabled={
                  unread === 0
                }
              >
                Mark All as Read
              </button>
            </form>

            <form
              action={
                clearAdminNotifications
              }
            >
              <button
                className="danger"
                type="submit"
              >
                Clear Notifications
              </button>
            </form>
          </div>
        </div>

        <p
          className="subtle compact"
          style={{
            marginTop: 10,
          }}
        >
          Clear hides notifications
          from this admin page. It does
          not delete delivery records
          or stop pending email/SMS
          delivery.
        </p>
      </section>

      <section
        className="panel"
        style={{
          marginTop: 18,
        }}
      >
        <details>
          <summary
            style={{
              cursor:
                "pointer",
              fontSize: 18,
              fontWeight: 700,
              padding: "6px 0",
            }}
          >
            Filters
            {filtersActive
              ? " · Active"
              : ""}
          </summary>

          <form
            className="form"
            method="GET"
            style={{
              marginTop: 18,
            }}
          >
            <input
              className="input"
              name="q"
              defaultValue={q}
              placeholder="Recipient, subject or message"
            />

            <select
              className="input"
              name="channel"
              defaultValue={
                channel
              }
            >
              <option value="">
                All channels
              </option>

              <option value="IN_APP">
                IN_APP
              </option>

              <option value="EMAIL">
                EMAIL
              </option>

              <option value="SMS">
                SMS
              </option>

              <option value="PUSH">
                PUSH
              </option>
            </select>

            <select
              className="input"
              name="state"
              defaultValue={
                state
              }
            >
              <option value="">
                All states
              </option>

              <option value="pending">
                Pending
              </option>

              <option value="sent">
                Sent
              </option>

              <option value="failed">
                Failed
              </option>
            </select>

            <div className="actions-row">
              <button
                className="primary"
                type="submit"
              >
                Apply Filters
              </button>

              {filtersActive ? (
                <Link
                  className="secondary"
                  href="/admin/notifications"
                >
                  Clear Filters
                </Link>
              ) : null}
            </div>
          </form>
        </details>
      </section>

      <section
        className="panel"
        style={{
          marginTop: 18,
        }}
      >
        <div className="request-list">
          {rows.map((n) => (
            <article
              className="request-card"
              key={n.id}
              style={
                n.adminReadAt
                  ? undefined
                  : {
                      border:
                        "2px solid #2563eb",
                    }
              }
            >
              <div className="request-head">
                <div>
                  <strong>
                    {n.subject ||
                      n.event}
                  </strong>

                  <div className="subtle compact">
                    {
                      n.user
                        .fullName
                    }
                    {" · "}
                    {
                      n.user
                        .email
                    }
                  </div>
                </div>

                <div className="actions-row">
                  {!n.adminReadAt ? (
                    <span className="badge">
                      NEW
                    </span>
                  ) : null}

                  <span className="badge">
                    {n.channel}
                  </span>
                </div>
              </div>

              <p className="compact">
                {n.message}
              </p>

              <div className="subtle compact">
                Attempts{" "}
                {n.attemptCount}
                {" · "}

                {n.sentAt
                  ? `Sent ${formatBrisbaneDateTime(
                      n.sentAt,
                    )}`
                  : n.failedAt
                    ? `Failed ${formatBrisbaneDateTime(
                        n.failedAt,
                      )}`
                    : "Pending"}

                {n.failureReason
                  ? ` · ${n.failureReason}`
                  : ""}
              </div>
            </article>
          ))}

          {rows.length ===
          0 ? (
            <p className="subtle">
              No notifications found.
            </p>
          ) : null}
        </div>
      </section>
    </main>
  );
}