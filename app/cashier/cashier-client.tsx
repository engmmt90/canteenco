"use client";

import {
  useEffect,
  useMemo,
  useRef,
  useState,
} from "react";

import { signOut } from "next-auth/react";

import {
  createCashierSale,
  findCashierStudents,
  getCashierProducts,
} from "@/app/actions/sales";

import {
  getStudentDailySpending,
} from "@/app/actions/student-spending";

type Student =
  Awaited<
    ReturnType<typeof findCashierStudents>
  >[number];

type Product =
  Awaited<
    ReturnType<typeof getCashierProducts>
  >[number];

type DailySpending = {
  dailyLimit: number | null;
  spentToday: number;
  remainingToday: number | null;
};

export default function CashierClient() {
  const [q, setQ] = useState("");
  const [nfc, setNfc] = useState("");
  const [nfcMessage, setNfcMessage] =
    useState("");

  const [results, setResults] =
    useState<Student[]>([]);

  const [student, setStudent] =
    useState<Student | null>(null);

  const [products, setProducts] =
    useState<Product[]>([]);

  const [cart, setCart] =
    useState<Record<string, number>>({});

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [adminPassword, setAdminPassword] =
    useState("");

  const [needsOverride, setNeedsOverride] =
    useState(false);

  const [
    showBalancePopup,
    setShowBalancePopup,
  ] = useState(false);

  const [
    showAdminApproval,
    setShowAdminApproval,
  ] = useState(false);

  const [
    dailySpending,
    setDailySpending,
  ] = useState<DailySpending | null>(null);

  const [
    loadingDailySpending,
    setLoadingDailySpending,
  ] = useState(false);

  const [key, setKey] =
    useState(() => crypto.randomUUID());

  const nfcInputRef =
    useRef<HTMLInputElement | null>(null);

  /*
   * Keep the NFC reader input focused.
   *
   * The reader behaves like a keyboard, so
   * whatever is focused receives the card number.
   */
  function focusNfcInput() {
    window.setTimeout(() => {
      nfcInputRef.current?.focus();
      nfcInputRef.current?.select();
    }, 50);
  }

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

    /*
     * When the cashier page opens,
     * immediately prepare the NFC reader.
     */
    focusNfcInput();
  }, []);

  async function loadDailySpending(
    studentId: string,
  ) {
    setLoadingDailySpending(true);
    setDailySpending(null);

    try {
      const spending =
        await getStudentDailySpending(
          studentId,
        );

      setDailySpending(spending);
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load daily spending",
      );
    } finally {
      setLoadingDailySpending(false);
    }
  }

  async function search() {
    const value = q.trim();

    if (!value) {
      setResults([]);
      focusNfcInput();
      return;
    }

    setMessage("");

    try {
      const found =
        await findCashierStudents(value);

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

  /*
   * NFC SEARCH
   *
   * The NFC reader behaves like a keyboard.
   * It types the card number into the NFC
   * input and normally sends Enter afterwards.
   */
  async function searchNfc() {
    const value = nfc.trim();

    if (!value) {
      focusNfcInput();
      return;
    }

    setMessage("");
    setNfcMessage("");

    try {
      const found =
        await findCashierStudents(value);

      if (found.length === 0) {
        setNfcMessage(
          "No active student is linked to this NFC card.",
        );

        setNfc("");

        focusNfcInput();

        return;
      }

      if (found.length === 1) {
        select(found[0]);

        setNfc("");

        focusNfcInput();

        return;
      }

      setNfcMessage(
        "More than one student was found. Please use the student search.",
      );

      setNfc("");

      focusNfcInput();
    } catch (error) {
      setNfcMessage(
        error instanceof Error
          ? error.message
          : "NFC search failed",
      );

      setNfc("");

      focusNfcInput();
    }
  }

  function select(selected: Student) {
    setStudent(selected);

    setResults([]);

    setQ(selected.displayCode);

    setNfc("");

    setNfcMessage("");

    setCart({});

    setMessage("");

    setNeedsOverride(false);

    setAdminPassword("");

    setShowBalancePopup(false);

    setShowAdminApproval(false);

    void loadDailySpending(
      selected.id,
    );
  }

  function addProduct(productId: string) {
    setCart((current) => ({
      ...current,

      [productId]:
        (current[productId] ?? 0) + 1,
    }));
  }

  function removeProduct(
    productId: string,
  ) {
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

  const balance =
    student?.parent.wallet
      ? Number(
          student.parent.wallet.balance,
        )
      : 0;

  async function confirm() {
    if (
      !student ||
      total <= 0 ||
      busy
    ) {
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const items =
        Object.entries(cart)
          .filter(
            ([, quantity]) =>
              quantity > 0,
          )
          .map(
            ([
              productId,
              quantity,
            ]) => ({
              productId,
              quantity,
            }),
          );

      const result =
        await createCashierSale({
          studentId: student.id,
          items,
          idempotencyKey: key,
          adminPassword:
            adminPassword || undefined,
        });

      if (!result.ok) {
        if (
          result.needsAdminOverride ===
          true
        ) {
          setNeedsOverride(true);

          setShowBalancePopup(true);

          setShowAdminApproval(false);

          return;
        }

        setMessage(
          result.error ||
            "Sale failed",
        );

        void loadDailySpending(
          student.id,
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

      setKey(
        crypto.randomUUID(),
      );

      void loadDailySpending(
        student.id,
      );

      /*
       * Keep the success message visible
       * briefly, then prepare the cashier
       * for the next NFC card.
       */
      setTimeout(() => {
        setStudent(null);

        setDailySpending(null);

        setQ("");

        setNfc("");

        setNfcMessage("");

        setMessage("");

        focusNfcInput();
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

    focusNfcInput();
  }

  function askAdmin() {
    setShowAdminApproval(true);
  }

  async function approveNegativeSale() {
    if (
      !adminPassword.trim()
    ) {
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
                callbackUrl:
                  "/staff/login",
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
                if (
                  event.key === "Enter"
                ) {
                  event.preventDefault();

                  void search();
                }
              }}
              placeholder="3C-001"
            />

            <button
              type="button"
              className="primary"
              onClick={() =>
                void search()
              }
            >
              Search
            </button>
          </div>
        </label>

        <div
          style={{
            marginTop: 16,
            paddingTop: 16,
            borderTop:
              "1px solid #e5e7eb",
          }}
        >
          <label className="label">
            NFC Card

            <input
              ref={nfcInputRef}
              className="input"
              value={nfc}
              onChange={(event) => {
                setNfc(
                  event.target.value,
                );

                setNfcMessage("");
              }}
              onKeyDown={(event) => {
                if (
                  event.key === "Enter"
                ) {
                  event.preventDefault();

                  void searchNfc();
                }
              }}
              placeholder="Tap NFC card here"
              autoComplete="off"
              inputMode="numeric"
            />
          </label>

          <p className="subtle compact">
            Tap the student's NFC card on
            the reader. The card number will
            be entered automatically.
          </p>

          {nfcMessage && (
            <p
              className="alert"
              style={{
                marginTop: 8,
              }}
            >
              {nfcMessage}
            </p>
          )}
        </div>

        {results.length > 1 && (
          <div
            style={{
              marginTop: 12,
            }}
          >
            {results.map((result) => (
              <button
                type="button"
                key={result.id}
                className="product"
                onClick={() => {
                  select(result);
                  focusNfcInput();
                }}
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

            <div
              style={{
                marginTop: 8,
                display: "grid",
                gap: 5,
              }}
            >
              <div>
                <span className="subtle">
                  Family wallet
                </span>{" "}
                <strong>
                  ${balance.toFixed(2)}
                </strong>
              </div>

              <div>
                <span className="subtle">
                  Daily spending limit
                  for this student
                </span>{" "}
                <strong>
                  {loadingDailySpending
                    ? "Loading..."
                    : dailySpending
                        ?.dailyLimit ===
                      null
                    ? "No limit"
                    : `$${Number(
                        dailySpending?.dailyLimit ??
                          student.dailySpendLimit ??
                          0,
                      ).toFixed(2)}`}
                </strong>
              </div>

              <div>
                <span className="subtle">
                  Spent today
                </span>{" "}
                <strong>
                  {loadingDailySpending
                    ? "Loading..."
                    : `$${Number(
                        dailySpending?.spentToday ??
                          0,
                      ).toFixed(2)}`}
                </strong>
              </div>

              <div>
                <span className="subtle">
                  Remaining today
                </span>{" "}
                <strong>
                  {loadingDailySpending
                    ? "Loading..."
                    : dailySpending
                        ?.remainingToday ===
                      null
                    ? "Unlimited"
                    : `$${Number(
                        dailySpending?.remainingToday ??
                          0,
                      ).toFixed(2)}`}
                </strong>
              </div>
            </div>
          </div>

          <section className="cashier-grid">
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
                {products.map(
                  (product) => (
                    <button
                      type="button"
                      className="product"
                      key={product.id}
                      onClick={() =>
                        addProduct(
                          product.id,
                        )
                      }
                      style={{
                        padding: 10,
                        display: "flex",
                        flexDirection:
                          "column",
                        alignItems:
                          "center",
                        justifyContent:
                          "flex-start",
                        gap: 7,
                        minHeight: 195,
                        textAlign: "center",
                        overflow:
                          "hidden",
                      }}
                    >
                      <div
                        style={{
                          width: "100%",
                          height: 120,
                          borderRadius: 10,
                          overflow:
                            "hidden",
                          background:
                            "#f3f4f6",
                          display:
                            "flex",
                          alignItems:
                            "center",
                          justifyContent:
                            "center",
                          flexShrink: 0,
                        }}
                      >
                        {product.imageUrl ? (
                          <img
                            src={
                              product.imageUrl
                            }
                            alt={
                              product.name
                            }
                            style={{
                              width:
                                "100%",
                              height:
                                "100%",
                              objectFit:
                                "cover",
                              display:
                                "block",
                            }}
                          />
                        ) : (
                          <span
                            style={{
                              fontSize: 12,
                              color:
                                "#9ca3af",
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
                        $
                        {Number(
                          product.price,
                        ).toFixed(2)}
                      </span>

                      {cart[
                        product.id
                      ] ? (
                        <span
                          style={{
                            fontSize: 13,
                            fontWeight: 700,
                          }}
                        >
                          ×{" "}
                          {
                            cart[
                              product.id
                            ]
                          }
                        </span>
                      ) : null}
                    </button>
                  ),
                )}
              </div>
            </div>

            <aside className="panel">
              <h2>
                Current Sale
              </h2>

              {products
                .filter(
                  (product) =>
                    (cart[
                      product.id
                    ] ?? 0) > 0,
                )
                .map((product) => (
                  <div
                    key={product.id}
                    style={{
                      display: "flex",
                      alignItems:
                        "center",
                      gap: 10,
                      padding: "8px 0",
                      minHeight: 52,
                    }}
                  >
                    <div
                      style={{
                        width: 36,
                        height: 36,
                        borderRadius: 8,
                        overflow:
                          "hidden",
                        background:
                          "#f3f4f6",
                        flexShrink: 0,
                        display:
                          "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                      }}
                    >
                      {product.imageUrl ? (
                        <img
                          src={
                            product.imageUrl
                          }
                          alt=""
                          style={{
                            width:
                              "100%",
                            height:
                              "100%",
                            objectFit:
                              "cover",
                            display:
                              "block",
                          }}
                        />
                      ) : (
                        <span
                          style={{
                            fontSize: 10,
                            color:
                              "#9ca3af",
                          }}
                        >
                          —
                        </span>
                      )}
                    </div>

                    <div
                      style={{
                        flex: 1,
                        minWidth: 0,
                      }}
                    >
                      <strong
                        style={{
                          display:
                            "block",
                          overflow:
                            "hidden",
                          textOverflow:
                            "ellipsis",
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {
                          product.name
                        }
                      </strong>

                      <span className="subtle">
                        ×{" "}
                        {
                          cart[
                            product.id
                          ]
                        }
                      </span>
                    </div>

                    <button
                      type="button"
                      className="secondary"
                      onClick={() =>
                        removeProduct(
                          product.id,
                        )
                      }
                      style={{
                        minWidth: 36,
                        width: 36,
                        height: 36,
                        padding: 0,
                        display:
                          "flex",
                        alignItems:
                          "center",
                        justifyContent:
                          "center",
                      }}
                    >
                      −
                    </button>
                  </div>
                ))}

              <div className="divider" />

              <strong>
                Total: $
                {total.toFixed(2)}
              </strong>

              <br />

              <span>
                Projected balance: $
                {(
                  balance - total
                ).toFixed(2)}
              </span>

              {dailySpending &&
              dailySpending.remainingToday !==
                null ? (
                <>
                  <div
                    style={{
                      height: 10,
                    }}
                  />

                  <span>
                    Projected daily
                    spending: $
                    {(
                      dailySpending.spentToday +
                      total
                    ).toFixed(2)}
                  </span>

                  <br />

                  <span>
                    Remaining after
                    sale: $
                    {Math.max(
                      0,
                      dailySpending.remainingToday -
                        total,
                    ).toFixed(2)}
                  </span>
                </>
              ) : null}

              <div
                style={{
                  height: 12,
                }}
              />

              <button
                type="button"
                disabled={
                  busy ||
                  total <= 0
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

      {showBalancePopup && (
        <div
          style={{
            position: "fixed",
            inset: 0,
            background:
              "rgba(0, 0, 0, 0.55)",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
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
                  Insufficient
                  Balance
                </h2>

                <p>
                  This family wallet
                  does not have enough
                  balance to complete
                  this sale.
                </p>

                <div
                  style={{
                    background:
                      "#f3f4f6",
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
                    Balance after
                    sale:{" "}
                    <strong>
                      $
                      {(
                        balance -
                        total
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
                    onClick={
                      askAdmin
                    }
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
                  Admin approval is
                  required to complete
                  this sale with a
                  negative balance.
                </p>

                <label className="label">
                  Admin password

                  <input
                    className="input"
                    type="password"
                    autoFocus
                    value={
                      adminPassword
                    }
                    onChange={(
                      event,
                    ) =>
                      setAdminPassword(
                        event.target
                          .value,
                      )
                    }
                    onKeyDown={(
                      event,
                    ) => {
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

                      setAdminPassword(
                        "",
                      );

                      focusNfcInput();
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