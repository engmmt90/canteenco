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

  items: Array<{
    id: string;
    name: string;
    quantity: number;
  }>;
};

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

  /*
   * NFC AUTO DETECTION
   *
   * The reader types the card number
   * quickly like a keyboard.
   *
   * We wait 220ms after the last
   * character, then automatically
   * treat the input as a completed
   * NFC scan.
   */
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

  function clearNfc() {
    setNfcInput("");
    setNfcStudentCard("");
    setMessage("");
  }

  function clearFilters() {
    setSelectedClass("");
    setSelectedPickupSlot("");
    clearNfc();
  }

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

  const hasActiveFilters =
    Boolean(
      selectedClass ||
        selectedPickupSlot ||
        nfcStudentCard,
    );

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

  return (
    <main className="cashier">
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

      {/* NFC SEARCH */}

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

              if (
                !value.trim()
              ) {
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

      {/* FILTERS */}

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

      {message && (
        <p className="alert">
          {message}
        </p>
      )}

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

      {/* ORDERS */}

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
                    <div className="request-head">
                      <div>
                        <strong>
                          {
                            order.orderNumber
                          }
                        </strong>

                        <div className="subtle compact">
                          {
                            order.student
                              .firstName
                          }{" "}
                          {
                            order.student
                              .lastName
                          }
                          {" · "}
                          {
                            order.student
                              .displayCode
                          }
                          {" · Class "}
                          {
                            order.student
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

                    <div>
                      {order.items.map(
                        (item) => (
                          <div
                            key={
                              item.id
                            }
                          >
                            {
                              item.quantity
                            }{" "}
                            ×{" "}
                            {
                              item.name
                            }
                          </div>
                        ),
                      )}
                    </div>

                    <div className="actions-row">
                      <button
                        className="secondary"
                        onClick={() =>
                          printLabel(
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
                          className="secondary"
                          onClick={() =>
                            move(
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
                          className="primary"
                          onClick={() =>
                            move(
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
                          className="primary"
                          onClick={() =>
                            move(
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

      {/* PRINT LABEL */}

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
        </div>
      )}
    </main>
  );
}