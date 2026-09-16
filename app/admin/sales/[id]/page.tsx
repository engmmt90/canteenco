import Link from "next/link";
import { notFound } from "next/navigation";

import {
  refundSale,
} from "@/app/actions/admin-sales-orders";
import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

function money(
  value: unknown,
) {
  return `$${Number(
    value ?? 0,
  ).toFixed(2)}`;
}

export default async function SaleDetailPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  const session =
    await requireAdmin();

  const {
    id,
  } =
    await params;

  const sale =
    await prisma.sale.findUnique({
      where: {
        id,
      },

      include: {
        student: {
          include: {
            parent: {
              include: {
                user: true,
              },
            },
          },
        },

        wallet:
          true,

        school:
          true,

        cashier:
          true,

        overrideApprovedBy:
          true,

        items: {
          include: {
            options:
              true,
          },
        },

        refundTransactions:
          true,
      },
    });

  if (!sale) {
    notFound();
  }

  if (
    session.user.role ===
      "SCHOOL_ADMIN" &&
    session.user.schoolId !==
      sale.schoolId
  ) {
    notFound();
  }

  const customerName =
    sale.student
      ? `${sale.student.firstName} ${sale.student.lastName}`
      : "Guest / Walk-in";

  const customerCode =
    sale.student
      ?.displayCode ??
    "GUEST";

  const isWalletSale =
    sale.paymentMethod ===
    "WALLET";

  return (
    <main className="content">
      <div className="page-heading">
        <div>
          <h1 className="brand">
            Sale Details
          </h1>

          <p className="subtle">
            {
              sale.saleNumber
            }
          </p>
        </div>

        <div className="actions-row">
          <Link
            className="secondary"
            href="/admin/sales"
          >
            Back to Sales
          </Link>

          <Link
            className="secondary"
            href="/admin"
          >
            Dashboard
          </Link>
        </div>
      </div>

      <div className="grid">
        <div className="stat">
          Total

          <strong>
            {money(
              sale.total,
            )}
          </strong>
        </div>

        <div className="stat">
          Status

          <strong>
            {
              sale.status
            }
          </strong>
        </div>

        <div className="stat">
          Payment

          <strong>
            {
              sale.paymentMethod
            }
          </strong>
        </div>

        <div className="stat">
          Customer Type

          <strong>
            {
              sale.customerType
            }
          </strong>
        </div>
      </div>

      <section
        className="panel"
        style={{
          marginTop: 18,
        }}
      >
        <h2>
          Sale Information
        </h2>

        <div
          style={{
            display: "grid",
            gap: 10,
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          <div>
            <span className="subtle">
              Customer
            </span>

            <div>
              <strong>
                {
                  customerName
                }
              </strong>
            </div>

            <div className="subtle compact">
              {
                customerCode
              }
            </div>
          </div>

          <div>
            <span className="subtle">
              School
            </span>

            <div>
              <strong>
                {
                  sale.school
                    .name
                }
              </strong>
            </div>
          </div>

          <div>
            <span className="subtle">
              Cashier
            </span>

            <div>
              <strong>
                {
                  sale.cashier
                    .fullName
                }
              </strong>
            </div>
          </div>

          <div>
            <span className="subtle">
              Date
            </span>

            <div>
              <strong>
                {sale.createdAt.toLocaleString(
                  "en-AU",
                )}
              </strong>
            </div>
          </div>

          {isWalletSale &&
          sale.wallet ? (
            <div>
              <span className="subtle">
                Current Wallet Balance
              </span>

              <div>
                <strong>
                  {money(
                    sale.wallet
                      .balance,
                  )}
                </strong>
              </div>
            </div>
          ) : null}

          {sale.isOverdraftOverride ? (
            <div>
              <span className="subtle">
                Negative Balance Override
              </span>

              <div>
                <strong>
                  Approved
                </strong>
              </div>

              {sale.overrideApprovedBy ? (
                <div className="subtle compact">
                  {
                    sale.overrideApprovedBy
                      .fullName
                  }
                </div>
              ) : null}
            </div>
          ) : null}
        </div>
      </section>

      <section
        className="panel"
        style={{
          marginTop: 18,
        }}
      >
        <h2>
          Items
        </h2>

        <div className="request-list">
          {sale.items.map(
            (item) => (
              <div
                className="list-row"
                key={
                  item.id
                }
              >
                <div>
                  <strong>
                    {
                      item.quantity
                    }{" "}
                    ×{" "}
                    {
                      item.productNameSnapshot
                    }
                  </strong>

                  <div className="subtle compact">
                    {money(
                      item.unitPrice,
                    )}{" "}
                    each
                  </div>

                  {item.options.length >
                  0 ? (
                    <div
                      className="subtle compact"
                      style={{
                        marginTop:
                          4,
                      }}
                    >
                      {item.options
                        .map(
                          (
                            option,
                          ) =>
                            `${option.optionName}${
                              Number(
                                option.additionalPrice,
                              ) >
                              0
                                ? ` (+${money(
                                    option.additionalPrice,
                                  )})`
                                : ""
                            }`,
                        )
                        .join(
                          " · ",
                        )}
                    </div>
                  ) : null}
                </div>

                <strong>
                  {money(
                    item.lineTotal,
                  )}
                </strong>
              </div>
            ),
          )}
        </div>

        <div className="divider" />

        <div
          style={{
            display: "flex",
            justifyContent:
              "space-between",
            alignItems:
              "center",
            gap: 12,
            fontSize: 20,
          }}
        >
          <strong>
            Total
          </strong>

          <strong>
            {money(
              sale.total,
            )}
          </strong>
        </div>
      </section>

      {sale.refundTransactions.length > 0 ? (
        <section
          className="panel"
          style={{
            marginTop: 18,
          }}
        >
          <h2>
            Refund History
          </h2>

          <div className="request-list">
            {sale.refundTransactions.map(
              (refund) => (
                <div
                  className="list-row"
                  key={refund.id}
                >
                  <div>
                    <strong>
                      {refund.description ||
                        `Refund ${sale.saleNumber}`}
                    </strong>

                    <div className="subtle compact">
                      {refund.createdAt.toLocaleString(
                        "en-AU",
                      )}
                    </div>
                  </div>

                  <strong>
                    +{money(
                      refund.amount,
                    )}
                  </strong>
                </div>
              ),
            )}
          </div>
        </section>
      ) : null}

      {sale.status ===
      "COMPLETED" ? (
        <section
          className="panel"
          style={{
            marginTop: 18,
          }}
        >
          <h2>
            Refund Sale
          </h2>

          <p className="subtle">
            {isWalletSale
              ? "The sale amount will be returned to the family wallet."
              : `This will mark the ${sale.paymentMethod.toLowerCase()} sale as refunded in CanteenCo. Complete the physical payment refund separately.`}
          </p>

          <form
            action={
              refundSale
            }
            className="form"
          >
            <input
              type="hidden"
              name="saleId"
              value={
                sale.id
              }
            />

            <label className="label">
              Refund reason

              <input
                className="input"
                name="reason"
                placeholder="Admin refund"
              />
            </label>

            <button
              type="submit"
              className="danger"
            >
              Refund Sale
            </button>
          </form>
        </section>
      ) : null}
    </main>
  );
}
