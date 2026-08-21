"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";

import {
  createCashierSale,
  findCashierStudents,
  getCashierProducts,
} from "@/app/actions/sales";

type Student =
  Awaited<ReturnType<typeof findCashierStudents>>[number];

type Product =
  Awaited<ReturnType<typeof getCashierProducts>>[number];

export default function CashierClient() {
  const [q, setQ] = useState("");
  const [results, setResults] = useState<Student[]>([]);
  const [student, setStudent] = useState<Student | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [cart, setCart] = useState<Record<string, number>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  const [adminPassword, setAdminPassword] = useState("");
  const [needsOverride, setNeedsOverride] = useState(false);

  const [showBalancePopup, setShowBalancePopup] = useState(false);
  const [showAdminApproval, setShowAdminApproval] = useState(false);

  const [key, setKey] = useState(() => crypto.randomUUID());

  useEffect(() => {
    getCashierProducts()
      .then(setProducts)
      .catch((error) => {
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not load products",
        );
      });
  }, []);

  async function search() {
    setMessage("");

    try {
      const found = await findCashierStudents(q);

      setResults(found);

      if (found.length === 1) {
        select(found[0]);
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Search failed",
      );
    }
  }

  function select(selected: Student) {
    setStudent(selected);
    setResults([]);
    setQ(selected.displayCode);
    setCart({});
    setMessage("");
    setNeedsOverride(false);
    setAdminPassword("");
    setShowBalancePopup(false);
    setShowAdminApproval(false);
  }

  function addProduct(productId: string) {
    setCart((current) => ({
      ...current,
      [productId]:
        (current[productId] ?? 0) + 1,
    }));
  }

  function removeProduct(productId: string) {
    setCart((current) => {
      const nextQuantity = Math.max(
        0,
        (current[productId] ?? 0) - 1,
      );

      return {
        ...current,
        [productId]: nextQuantity,
      };
    });
  }

  const total = useMemo(
    () =>
      products.reduce(
        (sum, product) =>
          sum +
          Number(product.price) *
            (cart[product.id] ?? 0),
        0,
      ),
    [products, cart],
  );

  const balance = student?.parent.wallet
    ? Number(student.parent.wallet.balance)
    : 0;

  async function confirm() {
    if (!student || total <= 0 || busy) {
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const items = Object.entries(cart)
        .filter(([, quantity]) => quantity > 0)
        .map(([productId, quantity]) => ({
          productId,
          quantity,
        }));

      const result = await createCashierSale({
        studentId: student.id,
        items,
        idempotencyKey: key,
        adminPassword:
          adminPassword || undefined,
      });

      if (!result.ok) {
        if (result.needsAdminOverride === true) {
          setNeedsOverride(true);
          setShowBalancePopup(true);
          setShowAdminApproval(false);
          return;
        }

        setMessage(
          result.error || "Sale failed",
        );

        return;
      }

      setShowBalancePopup(false);
      setShowAdminApproval(false);

      setMessage(
        `Sale ${result.saleNumber} completed. New balance: $${result.balanceAfter}`,
      );

      setCart({});
      setAdminPassword("");
      setNeedsOverride(false);
      setKey(crypto.randomUUID());

      setTimeout(() => {
        setStudent(null);
        setQ("");
        setMessage("");
      }, 1800);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Sale failed",
      );
    } finally {
      setBusy(false);
    }
  }

  function closeBalancePopup() {
    setShowBalancePopup(false);
    setShowAdminApproval(false);
    setAdminPassword("");
  }

  function askAdmin() {
    setShowAdminApproval(true);
  }

  async function approveNegativeSale() {
    if (!adminPassword.trim()) {
      return;
    }

    await confirm();
  }

  return (
    <main className="cashier">
      <div className="page-heading">
        <div>
          <h1 className="brand">
            CanteenCo Cashier
          </h1>
        </div>

        <div
          style={{
            display: "flex",
            gap: 10,
            alignItems: "center",
          }}
        >
          <a
            className="secondary"
            href="/cashier/preorders"
          >
            Pre-Orders
          </a>

          <button
            type="button"
            className="secondary"
            onClick={() =>
              signOut({
                callbackUrl: "/staff/login",
              })
            }
          >
            Sign out
          </button>
        </div>
      </div>

      <div className="panel">
        <label className="label">
          Scan QR, enter student code,
          or search name

          <div
            style={{
              display: "flex",
              gap: 8,
            }}
          >
            <input
              className="input"
              value={q}
              onChange={(event) =>
                setQ(event.target.value)
              }
              onKeyDown={(event) => {
                if (event.key === "Enter") {
                  event.preventDefault();
                  void search();
                }
              }}
              placeholder="3C-001"
            />

            <button
              type="button"
              className="primary"
              onClick={() => void search()}
            >
              Search
            </button>
          </div>
        </label>

        {results.length > 1 && (
          <div>
            {results.map((result) => (
              <button
                type="button"
                key={result.id}
                className="product"
                onClick={() =>
                  select(result)
                }
              >
                {result.firstName}{" "}
                {result.lastName} —{" "}
                {result.displayCode}
              </button>
            ))}
          </div>
        )}
      </div>

      {student && (
        <>
          <div className="panel">
            <strong>
              {student.firstName}{" "}
              {student.lastName}
            </strong>{" "}
            · {student.displayCode} · Class{" "}
            {student.classCode}
            <br />

            <span className="subtle">
              Family wallet
            </span>{" "}
            <strong>
              ${balance.toFixed(2)}
            </strong>
          </div>

          <section className="cashier-grid">
            {/* PRODUCTS */}
            <div className="panel">
              <h2>Products</h2>

              <div
                className="products"
                style={{
                  display: "grid",
                  gridTemplateColumns:
                    "repeat(auto-fill, minmax(140px, 1fr))",
                  gap: 12,
                }}
              >
                {products.map((product) => (
                  <button
                    type="button"
                    className="product"
                    key={product.id}
                    onClick={() =>
                      addProduct(product.id)
                    }
                    style={{
                      padding: 10,
                      display: "flex",
                      flexDirection: "column",
                      alignItems: "center",
                      justifyContent: "flex-start",
                      gap: 7,
                      minHeight: 170,
                      textAlign: "center",
                      overflow: "hidden",
                    }}
                  >
                    {/* Product image */}
                    <div
                      style={{
                        width: "100%",
                        height: 95,
                        borderRadius: 10,
                        overflow: "hidden",
                        background: "#f3f4f6",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                        flexShrink: 0,
                      }}
                    >
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt={product.name}
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: 12,
                            color: "#9ca3af",
                          }}
                        >
                          No image
                        </span>
                      )}
                    </div>

                    <strong
                      style={{
                        fontSize: 15,
                        lineHeight: 1.2,
                      }}
                    >
                      {product.name}
                    </strong>

                    <span
                      style={{
                        fontWeight: 700,
                      }}
                    >
                      ${Number(product.price).toFixed(2)}
                    </span>

                    {cart[product.id] ? (
                      <span
                        style={{
                          fontSize: 13,
                          fontWeight: 700,
                        }}
                      >
                        × {cart[product.id]}
                      </span>
                    ) : null}
                  </button>
                ))}
              </div>
            </div>

            {/* CURRENT SALE */}
            <aside className="panel">
              <h2>Current Sale</h2>

              {products
                .filter(
                  (product) =>
                    (cart[product.id] ?? 0) > 0,
                )
                .map((product) => (
                  <div
                    key={product.id}
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 10,
                      padding: "8px 0",
                      minHeight: 58,
                    }}
                  >
                    {/* Small current-sale image */}
                    <div
                      style={{
                        width: 42,
                        height: 42,
                        borderRadius: 8,
                        overflow: "hidden",
                        background: "#f3f4f6",
                        flexShrink: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      {product.imageUrl ? (
                        <img
                          src={product.imageUrl}
                          alt=""
                          style={{
                            width: "100%",
                            height: "100%",
                            objectFit: "cover",
                            display: "block",
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: 10,
                            color: "#9ca3af",
                          }}
                        >
                          —
                        </span>
                      )}
                    </div>

                    {/* Product name / quantity */}
                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <strong
                        style={{
                          display: "block",
                          overflow: "hidden",
                          textOverflow: "ellipsis",
                          whiteSpace: "nowrap",
                        }}
                      >
                        {product.name}
                      </strong>

                      <span className="subtle">
                        × {cart[product.id]}
                      </span>
                    </div>

                    {/* Remove one */}
                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        removeProduct(product.id)
                      }
                      style={{
                        minWidth: 36,
                        width: 36,
                        height: 36,
                        padding: 0,
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "center",
                      }}
                    >
                      −
                    </button>
                  </div>
                ))}

              <div className="divider" />

              <strong>
                Total: ${total.toFixed(2)}
              </strong>

              <br />

              <span>
                Projected balance: $
                {(balance - total).toFixed(
                  2,
                )}
              </span>

              <div
                style={{ height: 12 }}
              />

              <button
                type="button"
                disabled={
                  busy || total <= 0
                }
                className="primary"
                style={{
                  width: "100%",
                }}
                onClick={() =>
                  void confirm()
                }
              >
                {busy
                  ? "Processing…"
                  : "Confirm Sale"}
              </button>

              {message && (
                <p>{message}</p>
              )}
            </aside>
          </section>
        </>
      )}

      {/* INSUFFICIENT BALANCE POPUP */}
      {showBalancePopup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(0, 0, 0, 0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            zIndex: 9999,
            padding: 20,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 440,
              background: "white",
              borderRadius: 16,
              padding: 24,
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            {!showAdminApproval ? (
              <>
                <h2
                  style={{
                    marginTop: 0,
                  }}
                >
                  Insufficient Balance
                </h2>

                <p>
                  This family wallet does not
                  have enough balance to
                  complete this sale.
                </p>

                <div
                  style={{
                    background: "#f3f4f6",
                    borderRadius: 10,
                    padding: 14,
                    marginBottom: 20,
                  }}
                >
                  <div>
                    Current balance:{" "}
                    <strong>
                      $
                      {balance.toFixed(
                        2,
                      )}
                    </strong>
                  </div>

                  <div>
                    Sale total:{" "}
                    <strong>
                      $
                      {total.toFixed(
                        2,
                      )}
                    </strong>
                  </div>

                  <div>
                    Balance after sale:{" "}
                    <strong>
                      $
                      {(
                        balance - total
                      ).toFixed(2)}
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                  }}
                >
                  <button
                    type="button"
                    className="secondary"
                    style={{
                      flex: 1,
                    }}
                    onClick={
                      closeBalancePopup
                    }
                  >
                    Close
                  </button>

                  <button
                    type="button"
                    className="primary"
                    style={{
                      flex: 1,
                    }}
                    onClick={askAdmin}
                  >
                    Ask Admin
                  </button>
                </div>
              </>
            ) : (
              <>
                <h2
                  style={{
                    marginTop: 0,
                  }}
                >
                  Admin Approval
                </h2>

                <p>
                  Admin approval is required
                  to complete this sale with
                  a negative balance.
                </p>

                <label className="label">
                  Admin password

                  <input
                    className="input"
                    type="password"
                    autoFocus
                    value={adminPassword}
                    onChange={(event) =>
                      setAdminPassword(
                        event.target.value,
                      )
                    }
                    onKeyDown={(event) => {
                      if (
                        event.key ===
                        "Enter"
                      ) {
                        event.preventDefault();

                        void approveNegativeSale();
                      }
                    }}
                  />
                </label>

                <div
                  style={{
                    height: 16,
                  }}
                />

                <div
                  style={{
                    display: "flex",
                    gap: 10,
                  }}
                >
                  <button
                    type="button"
                    className="secondary"
                    style={{
                      flex: 1,
                    }}
                    disabled={busy}
                    onClick={() => {
                      setShowAdminApproval(
                        false,
                      );
                      setAdminPassword("");
                    }}
                  >
                    Back
                  </button>

                  <button
                    type="button"
                    className="primary"
                    style={{
                      flex: 1,
                    }}
                    disabled={
                      busy ||
                      !adminPassword.trim()
                    }
                    onClick={() =>
                      void approveNegativeSale()
                    }
                  >
                    {busy
                      ? "Processing…"
                      : "Approve & Complete Sale"}
                  </button>
                </div>

                <div
                  style={{
                    marginTop: 10,
                  }}
                >
                  <button
                    type="button"
                    className="secondary"
                    style={{
                      width: "100%",
                    }}
                    disabled={busy}
                    onClick={
                      closeBalancePopup
                    }
                  >
                    Cancel Sale
                  </button>
                </div>
              </>
            )}
          </div>
        </div>
      )}
    </main>
  );
}