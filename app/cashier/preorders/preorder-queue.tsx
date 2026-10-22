"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
  cancelCashierPreOrder,
  markPreOrderLabelPrinted,
  updatePreOrderStatus,
} from "@/app/actions/preorders";

/* ============================================================
 * TYPES
 * ============================================================ */

type PreOrderOption = {
  id: string;
  groupId: string;
  groupName: string;
  optionId: string;
  name: string;
  additionalPrice: number;
};

type PreOrderItem = {
  id: string;
  name: string;
  quantity: number;
  unitPrice?: number;
  lineTotal?: number;

  options: PreOrderOption[];
};

type O = {
  id: string;
  orderNumber: string;
  status: string;
  pickupDate: string;
  total: number;
  labelPrintedAt: string | null;

  student: {
    id: string;
    firstName: string;
    lastName: string;
    displayCode: string;
    classCode: string;
    nfcCardNumber: string | null;
  };

  schoolName: string;

  pickupSlot: {
    label: string;
  };

  items: PreOrderItem[];
};

/* ============================================================
 * COMPONENT
 * ============================================================ */

export default function PreOrderQueue({
  initialOrders,
}: {
  initialOrders: O[];
}) {
  const [orders, setOrders] =
    useState<O[]>(initialOrders);

  const [message, setMessage] =
    useState("");

  const [printOrder, setPrintOrder] =
    useState<O | null>(null);

  const [
    cancelOrder,
    setCancelOrder,
  ] = useState<O | null>(null);

  const [
    cancelling,
    setCancelling,
  ] = useState(false);

  const [
    refundAmount,
    setRefundAmount,
  ] = useState("");

  const [
    cancelReason,
    setCancelReason,
  ] = useState("");

  const [
    cancelNote,
    setCancelNote,
  ] = useState("");

  const [showFilters, setShowFilters] =
    useState(false);

  const [selectedClass, setSelectedClass] =
    useState("");

  const [
    selectedPickupSlot,
    setSelectedPickupSlot,
  ] = useState("");

  const [nfcInput, setNfcInput] =
    useState("");

  const [
    nfcStudentCard,
    setNfcStudentCard,
  ] = useState("");

  /* ==========================================================
   * STATUS
   * ========================================================== */

  async function move(
    order: O,
    status:
      | "PREPARING"
      | "READY"
      | "PICKED_UP",
  ) {
    setMessage("");

    const result =
      await updatePreOrderStatus(
        order.id,
        status,
      );

    if (!result.ok) {
      setMessage(
        result.error ??
          "Update failed",
      );

      return;
    }

    setOrders((current) =>
      status === "PICKED_UP"
        ? current.filter(
            (item) =>
              item.id !== order.id,
          )
        : current.map((item) =>
            item.id === order.id
              ? {
                  ...item,
                  status,
                }
              : item,
          ),
    );
  }

  /* ==========================================================
   * CANCEL
   * ========================================================== */

  async function cancelSelectedOrder(
    refund: boolean,
  ) {
    if (!cancelOrder || cancelling) {
      return;
    }

    if (!cancelReason) {
      setMessage(
        "Please select a cancellation reason.",
      );
      return;
    }

    if (refund) {
      const parsedRefundAmount =
        Number(refundAmount);

      if (
        !Number.isFinite(
          parsedRefundAmount,
        ) ||
        parsedRefundAmount <= 0
      ) {
        setMessage(
          "Refund amount must be greater than $0.00.",
        );
        return;
      }

      if (
        parsedRefundAmount >
        cancelOrder.total
      ) {
        setMessage(
          "Refund amount cannot exceed the order total.",
        );
        return;
      }
    }

    setCancelling(true);
    setMessage("");

    try {
      const result =
        await cancelCashierPreOrder(
          cancelOrder.id,
          refund,
          refund
            ? Number(refundAmount)
            : undefined,
          cancelReason,
          cancelReason === "Other"
            ? cancelNote.trim()
            : undefined,
        );

      if (!result.ok) {
        setMessage(
          result.error ??
            "Cancellation failed",
        );
        return;
      }

      setOrders((current) =>
        current.filter(
          (item) =>
            item.id !==
            cancelOrder.id,
        ),
      );

      setCancelOrder(null);
      setRefundAmount("");
      setCancelReason("");
      setCancelNote("");

      setMessage(
        refund
          ? `Pre-order cancelled and ${result.refundedAmount ?? refundAmount} refunded.`
          : "Pre-order cancelled without refund.",
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Cancellation failed",
      );
    } finally {
      setCancelling(false);
    }
  }

  /* ==========================================================
   * PRINT
   * ========================================================== */

  async function printLabel(
    order: O,
  ) {
    setPrintOrder(order);

    await markPreOrderLabelPrinted(
      order.id,
    );

    setOrders((current) =>
      current.map((item) =>
        item.id === order.id
          ? {
              ...item,
              labelPrintedAt:
                new Date().toISOString(),
            }
          : item,
      ),
    );

    setTimeout(() => {
      window.print();
    }, 50);
  }

  /* ==========================================================
   * CLASSES
   * ========================================================== */

  const classes =
    useMemo(() => {
      return Array.from(
        new Set(
          orders
            .map(
              (order) =>
                order.student
                  .classCode,
            )
            .filter(Boolean),
        ),
      ).sort();
    }, [orders]);

  /* ==========================================================
   * PICKUP SLOTS
   * ========================================================== */

  const pickupSlots =
    useMemo(() => {
      return Array.from(
        new Set(
          orders
            .map(
              (order) =>
                order.pickupSlot
                  .label,
            )
            .filter(Boolean),
        ),
      ).sort();
    }, [orders]);

  /* ==========================================================
   * NFC AUTO DETECTION
   * ========================================================== */

  useEffect(() => {
    const value =
      nfcInput.trim();

    if (!value) {
      return;
    }

    const timer =
      window.setTimeout(() => {
        const matchingOrders =
          orders.filter(
            (order) =>
              (
                order.student
                  .nfcCardNumber ??
                ""
              )
                .trim()
                .toLowerCase() ===
              value.toLowerCase(),
          );

        setNfcStudentCard(
          value,
        );

        setNfcInput("");

        if (
          matchingOrders.length ===
          0
        ) {
          setMessage(
            "No open pre-orders found for this NFC card.",
          );

          return;
        }

        setMessage("");
      }, 220);

    return () => {
      window.clearTimeout(
        timer,
      );
    };
  }, [
    nfcInput,
    orders,
  ]);

  /* ==========================================================
   * FILTER
   * ========================================================== */

  const filteredOrders =
    useMemo(() => {
      return orders.filter(
        (order) => {
          const matchesNfc =
            !nfcStudentCard ||
            (
              order.student
                .nfcCardNumber ??
              ""
            )
              .trim()
              .toLowerCase() ===
              nfcStudentCard
                .trim()
                .toLowerCase();

          const matchesClass =
            !selectedClass ||
            order.student
              .classCode ===
              selectedClass;

          const matchesPickup =
            !selectedPickupSlot ||
            order.pickupSlot
              .label ===
              selectedPickupSlot;

          return (
            matchesNfc &&
            matchesClass &&
            matchesPickup
          );
        },
      );
    }, [
      orders,
      nfcStudentCard,
      selectedClass,
      selectedPickupSlot,
    ]);

  /* ==========================================================
   * CLEAR NFC
   * ========================================================== */

  function clearNfc() {
    setNfcInput("");
    setNfcStudentCard("");
    setMessage("");
  }

  /* ==========================================================
   * CLEAR FILTERS
   * ========================================================== */

  function clearFilters() {
    setSelectedClass("");
    setSelectedPickupSlot("");
    clearNfc();
  }

  /* ==========================================================
   * GROUP ORDERS
   * ========================================================== */

  const groups =
    filteredOrders.reduce<
      Record<string, O[]>
    >(
      (
        grouped,
        order,
      ) => {
        const key =
          `${order.pickupDate.slice(
            0,
            10,
          )} · ${order.pickupSlot.label}`;

        (
          grouped[key] ??=
            []
        ).push(order);

        return grouped;
      },
      {},
    );

  /* ==========================================================
   * ACTIVE FILTERS
   * ========================================================== */

  const hasActiveFilters =
    Boolean(
      selectedClass ||
        selectedPickupSlot ||
        nfcStudentCard,
    );

  /* ==========================================================
   * NFC STUDENT
   * ========================================================== */

  const nfcStudent =
    nfcStudentCard
      ? orders.find(
          (order) =>
            (
              order.student
                .nfcCardNumber ??
              ""
            )
              .trim()
              .toLowerCase() ===
            nfcStudentCard
              .trim()
              .toLowerCase(),
        )?.student ?? null
      : null;

  /* ==========================================================
   * RENDER
   * ========================================================== */

  return (
    <main className="cashier">
      {/* ======================================================
       * HEADER
       * ==================================================== */}

      <div className="page-heading">
        <div>
          <h1 className="brand">
            Today’s Pre-Orders
          </h1>

          <p className="subtle">
            Prepare, label and hand
            over orders by pickup
            time.
          </p>
        </div>

        <a
          className="secondary"
          href="/cashier"
        >
          Walk-in Sales
        </a>
      </div>

      {/* ======================================================
       * NFC SEARCH
       * ==================================================== */}

      <section
        className="panel"
        style={{
          marginBottom: 18,
        }}
      >
        <label className="label">
          NFC Card

          <span className="subtle compact">
            Tap the student card
          </span>

          <input
            className="input"
            value={nfcInput}
            onChange={(event) => {
              const value =
                event.target.value;

              setNfcInput(value);

              if (!value.trim()) {
                setNfcStudentCard(
                  "",
                );

                setMessage("");
              }
            }}
            placeholder="Tap NFC card"
            autoComplete="off"
            autoFocus
          />
        </label>

        {nfcStudentCard && (
          <div
            style={{
              marginTop: 12,
              display: "flex",
              alignItems:
                "center",
              justifyContent:
                "space-between",
              gap: 12,
              flexWrap: "wrap",
            }}
          >
            <div>
              {nfcStudent ? (
                <>
                  <strong>
                    {
                      nfcStudent.firstName
                    }{" "}
                    {
                      nfcStudent.lastName
                    }
                  </strong>

                  <div className="subtle compact">
                    {
                      nfcStudent.displayCode
                    }{" "}
                    · Class{" "}
                    {
                      nfcStudent.classCode
                    }
                  </div>
                </>
              ) : (
                <strong>
                  NFC card detected
                </strong>
              )}
            </div>

            <button
              type="button"
              className="secondary"
              onClick={clearNfc}
            >
              Clear NFC
            </button>
          </div>
        )}
      </section>

      {/* ======================================================
       * FILTERS
       * ==================================================== */}

      <section
        className="panel"
        style={{
          marginBottom: 18,
        }}
      >
        <div
          className="actions-row"
          style={{
            justifyContent:
              "space-between",
          }}
        >
          <button
            type="button"
            className="secondary"
            onClick={() =>
              setShowFilters(
                (current) =>
                  !current,
              )
            }
          >
            {showFilters
              ? "Hide Filters"
              : "Filter"}
          </button>

          {hasActiveFilters && (
            <button
              type="button"
              className="secondary"
              onClick={
                clearFilters
              }
            >
              Clear Filters
            </button>
          )}
        </div>

        {showFilters && (
          <div
            className="two-col"
            style={{
              marginTop: 16,
            }}
          >
            <label className="label">
              Class

              <select
                className="input"
                value={
                  selectedClass
                }
                onChange={(
                  event,
                ) =>
                  setSelectedClass(
                    event.target
                      .value,
                  )
                }
              >
                <option value="">
                  All Classes
                </option>

                {classes.map(
                  (classCode) => (
                    <option
                      key={
                        classCode
                      }
                      value={
                        classCode
                      }
                    >
                      {classCode}
                    </option>
                  ),
                )}
              </select>
            </label>

            <label className="label">
              Pickup Slot

              <select
                className="input"
                value={
                  selectedPickupSlot
                }
                onChange={(
                  event,
                ) =>
                  setSelectedPickupSlot(
                    event.target
                      .value,
                  )
                }
              >
                <option value="">
                  All Pickup Slots
                </option>

                {pickupSlots.map(
                  (slot) => (
                    <option
                      key={slot}
                      value={slot}
                    >
                      {slot}
                    </option>
                  ),
                )}
              </select>
            </label>
          </div>
        )}
      </section>

      {/* ======================================================
       * MESSAGE
       * ==================================================== */}

      {message && (
        <p className="alert">
          {message}
        </p>
      )}

      {/* ======================================================
       * FILTER INFO
       * ==================================================== */}

      {hasActiveFilters && (
        <div
          className="subtle"
          style={{
            marginBottom: 14,
          }}
        >
          Showing{" "}
          <strong>
            {
              filteredOrders.length
            }
          </strong>{" "}
          pre-order
          {filteredOrders.length ===
          1
            ? ""
            : "s"}
          {selectedClass
            ? ` · Class ${selectedClass}`
            : ""}
          {selectedPickupSlot
            ? ` · ${selectedPickupSlot}`
            : ""}
          {nfcStudent
            ? ` · ${nfcStudent.firstName} ${nfcStudent.lastName}`
            : ""}
        </div>
      )}

      {/* ======================================================
       * ORDERS
       * ==================================================== */}

      {Object.entries(
        groups,
      ).map(
        ([group, list]) => (
          <section
            className="panel"
            key={group}
            style={{
              marginBottom: 18,
            }}
          >
            <h2>
              {group}
            </h2>

            <div className="request-list">
              {list.map(
                (order) => (
                  <article
                    className="request-card"
                    key={
                      order.id
                    }
                  >
                    {/* ----------------------------------------
                     * ORDER HEADER
                     * -------------------------------------- */}

                    <div className="request-head">
                      <div>
                        <strong>
                          {
                            order.orderNumber
                          }
                        </strong>

                        <div className="subtle compact">
                          {
                            order
                              .student
                              .firstName
                          }{" "}
                          {
                            order
                              .student
                              .lastName
                          }
                          {" · "}
                          {
                            order
                              .student
                              .displayCode
                          }
                          {" · Class "}
                          {
                            order
                              .student
                              .classCode
                          }
                        </div>
                      </div>

                      <span className="badge">
                        {
                          order.status
                        }
                      </span>
                    </div>

                    {/* ----------------------------------------
                     * ORDER ITEMS
                     * -------------------------------------- */}

                    <div
                      style={{
                        marginTop: 14,
                        display: "grid",
                        gap: 12,
                      }}
                    >
                      {order.items.map(
                        (item) => (
                          <div
                            key={
                              item.id
                            }
                            style={{
                              padding:
                                "12px 14px",
                              border:
                                "1px solid #e5e7eb",
                              borderRadius: 12,
                              background:
                                "#fafafa",
                            }}
                          >
                            {/* PRODUCT */}

                            <div
                              style={{
                                display:
                                  "flex",
                                justifyContent:
                                  "space-between",
                                gap: 12,
                                alignItems:
                                  "flex-start",
                              }}
                            >
                              <strong
                                style={{
                                  fontSize: 16,
                                }}
                              >
                                {
                                  item.quantity
                                }{" "}
                                ×{" "}
                                {
                                  item.name
                                }
                              </strong>

                              {item.lineTotal !==
                                undefined && (
                                <strong>
                                  $
                                  {item.lineTotal.toFixed(
                                    2,
                                  )}
                                </strong>
                              )}
                            </div>

                            {/* OPTIONS */}

                            {item.options.length >
                              0 && (
                              <div
                                style={{
                                  marginTop: 9,
                                  paddingLeft: 4,
                                  display:
                                    "grid",
                                  gap: 5,
                                }}
                              >
                                {item.options.map(
                                  (
                                    option,
                                  ) => (
                                    <div
                                      key={
                                        option.id
                                      }
                                      style={{
                                        display:
                                          "flex",
                                        justifyContent:
                                          "space-between",
                                        gap: 10,
                                        fontSize:
                                          14,
                                      }}
                                    >
                                      <span>
                                        <span className="subtle">
                                          {
                                            option.groupName
                                          }
                                          :
                                        </span>{" "}
                                        <strong>
                                          {
                                            option.name
                                          }
                                        </strong>
                                      </span>

                                      {option.additionalPrice >
                                      0 ? (
                                        <span className="subtle">
                                          +$
                                          {option.additionalPrice.toFixed(
                                            2,
                                          )}
                                        </span>
                                      ) : (
                                        <span className="subtle">
                                          Included
                                        </span>
                                      )}
                                    </div>
                                  ),
                                )}
                              </div>
                            )}
                          </div>
                        ),
                      )}
                    </div>

                    {/* ----------------------------------------
                     * TOTAL
                     * -------------------------------------- */}

                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "center",
                        marginTop: 14,
                        paddingTop: 12,
                        borderTop:
                          "1px solid #e5e7eb",
                      }}
                    >
                      <span className="subtle">
                        Total
                      </span>

                      <strong
                        style={{
                          fontSize: 18,
                        }}
                      >
                        $
                        {order.total.toFixed(
                          2,
                        )}
                      </strong>
                    </div>

                    {/* ----------------------------------------
                     * ACTIONS
                     * -------------------------------------- */}

                    <div className="actions-row">
                      <button
                        type="button"
                        onClick={() => {
                          setRefundAmount(
                            order.total.toFixed(
                              2,
                            ),
                          );
                          setCancelReason("");
                          setCancelNote("");
                          setCancelOrder(
                            order,
                          );
                        }}
                        style={{
                          border:
                            "1px solid #dc2626",
                          background:
                            "#dc2626",
                          color: "white",
                          borderRadius: 8,
                          padding:
                            "9px 14px",
                          fontWeight: 700,
                          cursor:
                            "pointer",
                        }}
                      >
                        Cancel
                      </button>

                      <button
                        type="button"
                        className="secondary"
                        onClick={() =>
                          void printLabel(
                            order,
                          )
                        }
                      >
                        Print Label
                        {order.labelPrintedAt
                          ? " ✓"
                          : ""}
                      </button>

                      {order.status ===
                        "CONFIRMED" && (
                        <button
                          type="button"
                          className="secondary"
                          onClick={() =>
                            void move(
                              order,
                              "PREPARING",
                            )
                          }
                        >
                          Preparing
                        </button>
                      )}

                      {(
                        order.status ===
                          "CONFIRMED" ||
                        order.status ===
                          "PREPARING"
                      ) && (
                        <button
                          type="button"
                          className="primary"
                          onClick={() =>
                            void move(
                              order,
                              "READY",
                            )
                          }
                        >
                          Ready
                        </button>
                      )}

                      {order.status ===
                        "READY" && (
                        <button
                          type="button"
                          className="primary"
                          onClick={() =>
                            void move(
                              order,
                              "PICKED_UP",
                            )
                          }
                        >
                          Picked Up
                        </button>
                      )}
                    </div>
                  </article>
                ),
              )}
            </div>
          </section>
        ),
      )}

      {/* ======================================================
       * EMPTY
       * ==================================================== */}

      {filteredOrders.length ===
        0 && (
        <section className="panel">
          <p>
            {nfcStudentCard
              ? "No open pre-orders found for this NFC card."
              : hasActiveFilters
                ? "No pre-orders match the selected filters."
                : "No open pre-orders."}
          </p>

          {hasActiveFilters && (
            <button
              type="button"
              className="secondary"
              onClick={
                clearFilters
              }
            >
              Clear Filters
            </button>
          )}
        </section>
      )}

      {/* ======================================================
       * CANCEL MODAL
       * ==================================================== */}

      {cancelOrder && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="cancel-preorder-title"
          onClick={() => {
            if (!cancelling) {
              setCancelOrder(null);
              setRefundAmount("");
              setCancelReason("");
              setCancelNote("");
            }
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 10000,
            background:
              "rgba(0, 0, 0, 0.5)",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            padding: 18,
          }}
        >
          <div
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              width: "100%",
              maxWidth: 420,
              background: "white",
              borderRadius: 16,
              padding: 22,
              boxShadow:
                "0 24px 80px rgba(0,0,0,0.3)",
            }}
          >
            <h2
              id="cancel-preorder-title"
              style={{
                margin:
                  "0 0 8px",
              }}
            >
              Cancel Pre-Order
            </h2>

            <p
              className="subtle"
              style={{
                margin:
                  "0 0 18px",
              }}
            >
              {cancelOrder.orderNumber}
              {" · "}
              {
                cancelOrder.student
                  .firstName
              }{" "}
              {
                cancelOrder.student
                  .lastName
              }
            </p>

            <p
              style={{
                margin:
                  "0 0 12px",
              }}
            >
              Select a cancellation reason.
            </p>

            <div
              style={{
                display: "grid",
                gap: 8,
                marginBottom: 16,
              }}
            >
              {[
                "Out of stock",
                "Customer request",
                "Duplicate order",
                "Wrong order / item",
                "Payment issue",
                "Student unable to collect",
                "Other",
              ].map((reason) => (
                <label
                  key={reason}
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 10,
                    cursor: "pointer",
                  }}
                >
                  <input
                    type="radio"
                    name="cancelReason"
                    value={reason}
                    checked={
                      cancelReason === reason
                    }
                    disabled={cancelling}
                    onChange={() => {
                      setCancelReason(reason);
                      if (reason !== "Other") {
                        setCancelNote("");
                      }
                    }}
                  />
                  <span>{reason}</span>
                </label>
              ))}

              {cancelReason ===
                "Other" && (
                <label
                  className="label"
                  style={{
                    marginTop: 4,
                  }}
                >
                  Note (optional)
                  <textarea
                    className="input"
                    value={cancelNote}
                    disabled={cancelling}
                    onChange={(event) =>
                      setCancelNote(
                        event.target.value,
                      )
                    }
                    placeholder="Add a note if needed"
                    rows={3}
                  />
                </label>
              )}
            </div>

            <p
              style={{
                margin:
                  "0 0 18px",
              }}
            >
              Choose how you want to
              cancel this order.
            </p>

            <div
              style={{
                display: "grid",
                gap: 10,
              }}
            >
              <button
                type="button"
                disabled={cancelling}
                onClick={() =>
                  void cancelSelectedOrder(
                    false,
                  )
                }
                style={{
                  width: "100%",
                  border:
                    "1px solid #dc2626",
                  background:
                    "white",
                  color: "#dc2626",
                  borderRadius: 9,
                  padding:
                    "11px 14px",
                  fontWeight: 700,
                  cursor:
                    cancelling
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {cancelling
                  ? "Processing..."
                  : "Cancel Only"}
              </button>

              <label
                style={{
                  display: "grid",
                  gap: 6,
                  fontWeight: 700,
                }}
              >
                Refund amount
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    border:
                      "1px solid #d1d5db",
                    borderRadius: 9,
                    overflow: "hidden",
                    background: "white",
                  }}
                >
                  <span
                    style={{
                      padding:
                        "10px 0 10px 12px",
                      color: "#6b7280",
                    }}
                  >
                    $
                  </span>
                  <input
                    type="number"
                    min="0.01"
                    max={
                      cancelOrder.total
                    }
                    step="0.01"
                    value={refundAmount}
                    disabled={cancelling}
                    onChange={(event) =>
                      setRefundAmount(
                        event.target.value,
                      )
                    }
                    style={{
                      width: "100%",
                      border: 0,
                      outline: "none",
                      padding:
                        "10px 12px 10px 6px",
                      fontSize: 16,
                    }}
                  />
                </div>
                <span
                  className="subtle"
                  style={{
                    fontSize: 12,
                    fontWeight: 400,
                  }}
                >
                  Maximum $
                  {cancelOrder.total.toFixed(
                    2,
                  )}
                </span>
              </label>

              <button
                type="button"
                disabled={cancelling}
                onClick={() =>
                  void cancelSelectedOrder(
                    true,
                  )
                }
                style={{
                  width: "100%",
                  border:
                    "1px solid #dc2626",
                  background:
                    "#dc2626",
                  color: "white",
                  borderRadius: 9,
                  padding:
                    "11px 14px",
                  fontWeight: 700,
                  cursor:
                    cancelling
                      ? "not-allowed"
                      : "pointer",
                }}
              >
                {cancelling
                  ? "Processing..."
                  : `Cancel & Refund (${Number(
                      refundAmount || 0,
                    ).toFixed(2)})`}
              </button>

              <button
                type="button"
                className="secondary"
                disabled={cancelling}
                onClick={() =>
                  {
                    setCancelOrder(
                      null,
                    );
                    setRefundAmount("");
                    setCancelReason("");
                    setCancelNote("");
                  }
                }
                style={{
                  width: "100%",
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
       * PRINT LABEL
       * ==================================================== */}

      {printOrder && (
        <div className="print-label">
          <strong className="label-order">
            {
              printOrder.orderNumber
            }
          </strong>

          <strong>
            {
              printOrder.student
                .firstName
            }{" "}
            {
              printOrder.student
                .lastName
            }
          </strong>

          <span>
            {
              printOrder.student
                .displayCode
            }
            {" · Class "}
            {
              printOrder.student
                .classCode
            }
          </span>

          <span>
            Pickup:{" "}
            {
              printOrder
                .pickupSlot.label
            }
          </span>

          {/* PRINT ITEMS */}

          <div
            style={{
              marginTop: 8,
              display: "grid",
              gap: 5,
            }}
          >
            {printOrder.items.map(
              (item) => (
                <div
                  key={item.id}
                >
                  <strong>
                    {
                      item.quantity
                    }{" "}
                    ×{" "}
                    {
                      item.name
                    }
                  </strong>

                  {item.options.length >
                    0 && (
                    <div
                      style={{
                        marginLeft: 8,
                      }}
                    >
                      {item.options.map(
                        (
                          option,
                        ) => (
                          <div
                            key={
                              option.id
                            }
                          >
                            {
                              option.groupName
                            }
                            :{" "}
                            {
                              option.name
                            }
                          </div>
                        ),
                      )}
                    </div>
                  )}
                </div>
              ),
            )}
          </div>
        </div>
      )}
    </main>
  );
}