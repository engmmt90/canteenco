"use client";

import {
  useEffect,
  useMemo,
  useState,
} from "react";

import {
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