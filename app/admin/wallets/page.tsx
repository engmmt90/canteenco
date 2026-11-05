import Link from "next/link";
import { getWalletReportSettings } from "@/lib/daily-wallet-report";

import { prisma } from "@/lib/prisma";
import {
  adminSchoolScope,
} from "@/lib/admin-scope";

import {
  addAdminWalletCredit,
} from "@/app/actions/admin-wallet";
import {
  emailWalletReportToMe,
  saveDailyWalletReportSettings,
} from "@/app/actions/admin-wallet-report";

type SearchParams = {
  q?: string;
  negative?: string;
  credit?: string;
  reportEmail?: string;
  reportSchedule?: string;
};

export default async function WalletsPage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const {
    schoolId,
    session,
  } =
    await adminSchoolScope();
  const dailySettings = await getWalletReportSettings(session.user.id);
  const schoolTimezone = schoolId
    ? (await prisma.schoolSettings.findUnique({ where: { schoolId }, select: { timezone: true } }))?.timezone
    : null;

  const p =
    await searchParams;

  const q =
    (p.q || "").trim();

  const where: any = {};

  if (p.negative === "1") {
    where.balance = {
      lt: 0,
    };
  }

  where.parent = {
    ...(schoolId
      ? {
          students: {
            some: {
              schoolId,
              status: "ACTIVE",
            },
          },
        }
      : {}),

    ...(q
      ? {
          OR: [
            {
              user: {
                fullName: {
                  contains: q,
                  mode: "insensitive",
                },
              },
            },

            {
              students: {
                some: {
                  OR: [
                    {
                      displayCode: {
                        contains: q,
                        mode: "insensitive",
                      },
                    },

                    {
                      firstName: {
                        contains: q,
                        mode: "insensitive",
                      },
                    },

                    {
                      lastName: {
                        contains: q,
                        mode: "insensitive",
                      },
                    },
                  ],
                },
              },
            },
          ],
        }
      : {}),
  };

  const wallets =
    await prisma.wallet.findMany({
      where,

      include: {
        parent: {
          include: {
            user: true,

            students: {
              where: {
                status: "ACTIVE",
                deletedAt: null,
              },

              include: {
                school: true,
              },
            },
          },
        },
      },

      orderBy: {
        balance: "asc",
      },

      take: 100,
    });

  const selectedWallet =
    p.credit
      ? wallets.find(
          (wallet) =>
            wallet.id ===
            p.credit,
        )
      : null;

  return (
    <main className="content">
      <div className="page-heading">
        <div>
          <h1 className="brand">
            Family Wallets
          </h1>

          <p className="subtle">
            View family wallet balances
            and add credit when required.
          </p>
        </div>

        <Link
          className="secondary"
          href="/admin"
        >
          Dashboard
        </Link>
      </div>

      {/* REPORT ACTIONS */}

      <section
        className="panel"
        style={{
          marginBottom: 18,
        }}
      >
        <div className="page-heading">
          <div>
            <h2>
              Wallet Balance Report
            </h2>

            <p className="subtle compact">
              Print, export or email a report
              of all wallet balances available
              to your admin account.
            </p>
          </div>

          <div
            className="actions-row"
            style={{
              justifyContent:
                "flex-end",
            }}
          >
            <Link
              className="secondary"
              href="/admin/wallets/print"
              target="_blank"
            >
              Print Report
            </Link>

            <a
              className="secondary"
              href="/api/admin/wallets/report.pdf"
            >
              Export PDF
            </a>

            <form
              action={
                emailWalletReportToMe
              }
            >
              <label className="label">
                Additional recipient (optional)
                <input
                  className="input"
                  name="additionalEmail"
                  type="email"
                  autoComplete="email"
                  placeholder="name@example.com"
                  maxLength={254}
                />
              </label>
              <button
                className="primary"
                type="submit"
              >
                Email PDF to Me
              </button>
            </form>
          </div>
        </div>

        {p.reportEmail ===
        "sent" ? (
          <p
            className="success"
            style={{
              marginTop: 12,
            }}
          >
            Wallet report PDF was sent to your admin email.
          </p>
        ) : null}
      </section>

      <section className="panel" style={{ marginBottom: 18 }}>
        <h2>Daily Wallet PDF Email</h2>
        <p className="subtle">Save a daily send time and an optional additional recipient. The admin account always receives the report.</p>
        <form action={saveDailyWalletReportSettings} className="form">
          <label className="label">
            <input type="checkbox" name="enabled" defaultChecked={dailySettings.enabled} />
            {" "}Send automatically every day
          </label>
          <label className="label">
            Send time ({schoolTimezone ? `school timezone: ${schoolTimezone}` : "selected timezone"})
            <input className="input" type="time" name="sendTime" defaultValue={dailySettings.sendTime} required />
          </label>
          {schoolTimezone ? (
            <input type="hidden" name="timezone" value={schoolTimezone} />
          ) : (
            <label className="label">
              Timezone
              <select className="input" name="timezone" defaultValue={dailySettings.timezone}>
                <option value="Australia/Brisbane">Brisbane</option>
                <option value="Australia/Sydney">Sydney / Melbourne</option>
                <option value="Australia/Adelaide">Adelaide</option>
                <option value="Australia/Perth">Perth</option>
                <option value="Australia/Darwin">Darwin</option>
                <option value="Australia/Hobart">Hobart</option>
              </select>
            </label>
          )}
          <label className="label">
            Additional recipient (optional)
            <input className="input" type="email" name="additionalEmail" maxLength={254}
              defaultValue={dailySettings.additionalEmail ?? ""} placeholder="name@example.com" />
          </label>
          <button className="primary" type="submit">Save daily email settings</button>
        </form>
        {p.reportSchedule === "saved" ? <p className="success">Daily email settings saved.</p> : null}
      </section>

      {/* SEARCH */}

      <form
        className="panel actions-row"
        method="GET"
      >
        <input
          className="input"
          name="q"
          defaultValue={q}
          placeholder="Parent, student or code"
        />

        <label>
          <input
            type="checkbox"
            name="negative"
            value="1"
            defaultChecked={
              p.negative === "1"
            }
          />

          {" "}
          Negative only
        </label>

        <button className="primary">
          Search
        </button>
      </form>

      {/* ADD CREDIT FORM */}

      {selectedWallet && (
        <section
          className="panel"
          style={{
            marginTop: 18,
          }}
        >
          <div className="page-heading">
            <div>
              <h2>
                Add Credit
              </h2>

              <p className="subtle">
                {
                  selectedWallet
                    .parent.user
                    .fullName
                }
              </p>
            </div>

            <Link
              className="secondary"
              href={`/admin/wallets${
                q ||
                p.negative === "1"
                  ? `?${new URLSearchParams(
                      {
                        ...(q
                          ? {
                              q,
                            }
                          : {}),
                        ...(p.negative ===
                        "1"
                          ? {
                              negative:
                                "1",
                            }
                          : {}),
                      },
                    ).toString()}`
                  : ""
              }`}
            >
              Cancel
            </Link>
          </div>

          <div
            className="subtle"
            style={{
              marginBottom: 16,
            }}
          >
            Current balance:{" "}
            <strong>
              $
              {Number(
                selectedWallet.balance,
              ).toFixed(2)}
            </strong>
          </div>

          <form
            action={
              addAdminWalletCredit
            }
            className="form"
          >
            <input
              type="hidden"
              name="walletId"
              value={
                selectedWallet.id
              }
            />

            <label className="label">
              Amount

              <input
                className="input"
                name="amount"
                type="number"
                min="0.01"
                step="0.01"
                placeholder="0.00"
                required
                autoFocus
              />
            </label>

            <label className="label">
              Note / Reason

              <input
                className="input"
                name="note"
                placeholder="e.g. Cash top-up"
                defaultValue="Admin wallet credit"
              />
            </label>

            <div className="actions-row">
              <Link
                className="secondary"
                href="/admin/wallets"
              >
                Cancel
              </Link>

              <button
                className="primary"
                type="submit"
              >
                Add Credit
              </button>
            </div>
          </form>
        </section>
      )}

      {/* WALLETS */}

      <section
        className="panel"
        style={{
          marginTop: 18,
        }}
      >
        <div className="request-list">
          {wallets.map(
            (wallet) => (
              <div
                className="list-row"
                key={wallet.id}
              >
                <div>
                  <strong>
                    {
                      wallet.parent
                        .user.fullName
                    }
                  </strong>

                  <div className="subtle compact">
                    {wallet.parent.students
                      .map(
                        (
                          student,
                        ) =>
                          `${student.firstName} ${student.lastName} (${student.displayCode})`,
                      )
                      .join(", ")}
                  </div>
                </div>

                <div
                  className="actions-row"
                  style={{
                    justifyContent:
                      "flex-end",
                  }}
                >
                  <strong>
                    $
                    {Number(
                      wallet.balance,
                    ).toFixed(2)}
                  </strong>

                  <Link
                    className="secondary"
                    href={`/admin/wallets?credit=${wallet.id}`}
                  >
                    Add Credit
                  </Link>
                </div>
              </div>
            ),
          )}

          {wallets.length ===
            0 && (
            <p className="subtle">
              No wallets found.
            </p>
          )}
        </div>
      </section>
    </main>
  );
}