"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  createParentPreOrder,
} from "@/app/actions/preorders";

/* ============================================================
 * TYPES
 * ============================================================ */

type StudentOption = {
  id: string;
  firstName: string;
  lastName: string;
  displayCode: string;
  schoolId: string;
  schoolName: string;
  preOrderEnabled: boolean;
  cutoffTime: string;

  pickupSlots: Array<{
    id: string;
    label: string;
  }>;
};

type ProductOption = {
  id: string;
  name: string;
  additionalPrice: number;
};
type ProductOptionGroup = {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;

  options: ProductOption[];
};
type ProductOptionData = {
  id: string;
  name: string;
  price: number;
  category: string | null;

  optionGroups: ProductOptionGroup[];
};

type SelectedOptions = Record<
  string,
  string[]
>;

type CartLine = {
  id: string;
  productId: string;
  quantity: number;

  options: Array<{
    groupId: string;
    optionId: string;
  }>;
};

type Props = {
  data: {
    walletBalance: number;
    students: StudentOption[];
    products: ProductOptionData[];
  };
};

/* ============================================================
 * COMPONENT
 * ============================================================ */

export default function PreOrderForm({
  data,
}: Props) {
  /* ==========================================================
   * STUDENT
   * ========================================================== */

  const [studentId, setStudentId] =
    useState(
      data.students[0]?.id ?? "",
    );

  const student =
    data.students.find(
      (item) =>
        item.id === studentId,
    ) ?? null;

  /* ==========================================================
   * PICKUP
   * ========================================================== */

  const [slotId, setSlotId] =
    useState(
      student?.pickupSlots[0]?.id ??
        "",
    );

  const [
    pickupDate,
    setPickupDate,
  ] = useState("");

  /* ==========================================================
   * CART
   * ========================================================== */

  const [cart, setCart] = useState<
    CartLine[]
  >([]);

  /* ==========================================================
   * OPTION MODAL
   * ========================================================== */

  const [
    selectedProduct,
    setSelectedProduct,
  ] =
    useState<ProductOptionData | null>(
      null,
    );

  const [
    modalSelections,
    setModalSelections,
  ] =
    useState<SelectedOptions>({});

  /* ==========================================================
   * UI
   * ========================================================== */

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [key, setKey] = useState(
    () => crypto.randomUUID(),
  );

  /* ==========================================================
   * CHANGE STUDENT
   * ========================================================== */

  function changeStudent(
    id: string,
  ) {
    setStudentId(id);

    const nextStudent =
      data.students.find(
        (item) => item.id === id,
      );

    setSlotId(
      nextStudent
        ?.pickupSlots[0]?.id ??
        "",
    );

    setMessage("");
  }

  /* ==========================================================
   * OPEN PRODUCT
   * ========================================================== */

  function openProduct(
    product: ProductOptionData,
  ) {
    setMessage("");

    /*
     * Product without options:
     * add immediately.
     */

    if (
      product.optionGroups.length ===
      0
    ) {
      addSimpleProduct(product);
      return;
    }

    /*
     * Product with options:
     * open modal.
     */

    const initial: SelectedOptions =
      {};

    for (const group of
      product.optionGroups) {
      initial[group.id] = [];
    }

    setModalSelections(initial);
    setSelectedProduct(product);
  }

  /* ==========================================================
   * ADD SIMPLE PRODUCT
   * ========================================================== */

  function addSimpleProduct(
    product: ProductOptionData,
  ) {
    setCart((current) => [
      ...current,

      {
        id: crypto.randomUUID(),

        productId: product.id,

        quantity: 1,

        options: [],
      },
    ]);
  }

  /* ==========================================================
   * SELECT OPTION
   * ========================================================== */

  function toggleOption(
    group: ProductOptionGroup,
    optionId: string,
  ) {
    setModalSelections(
      (current) => {
        const existing =
          current[group.id] ?? [];

        /*
         * Single selection.
         */

        if (
          group.maxSelections <= 1
        ) {
          return {
            ...current,

            [group.id]: [optionId],
          };
        }

        /*
         * Multi selection.
         */

        const alreadySelected =
          existing.includes(
            optionId,
          );

        if (alreadySelected) {
          return {
            ...current,

            [group.id]:
              existing.filter(
                (id) =>
                  id !== optionId,
              ),
          };
        }

        /*
         * Maximum reached.
         */

        if (
          group.maxSelections >
            0 &&
          existing.length >=
            group.maxSelections
        ) {
          return current;
        }

        return {
          ...current,

          [group.id]: [
            ...existing,
            optionId,
          ],
        };
      },
    );

    setMessage("");
  }

  /* ==========================================================
   * VALIDATE MODAL
   * ========================================================== */

  function validateSelections() {
    if (!selectedProduct) {
      return "Please select a product.";
    }

    for (const group of
      selectedProduct.optionGroups) {
      const selected =
        modalSelections[
          group.id
        ] ?? [];

      const minimum =
        Math.max(
          group.minSelections,
          group.isRequired
            ? 1
            : 0,
        );

      if (
        selected.length < minimum
      ) {
        return `Please select at least ${minimum} option${
          minimum === 1
            ? ""
            : "s"
        } for ${group.name}.`;
      }

      if (
        group.maxSelections >
          0 &&
        selected.length >
          group.maxSelections
      ) {
        return `You can select a maximum of ${group.maxSelections} option${
          group.maxSelections ===
          1
            ? ""
            : "s"
        } for ${group.name}.`;
      }
    }

    return null;
  }

  /* ==========================================================
   * ADD PRODUCT WITH OPTIONS
   * ========================================================== */

  function addConfiguredProduct() {
    if (!selectedProduct) {
      return;
    }

    const error =
      validateSelections();

    if (error) {
      setMessage(error);
      return;
    }

    const options: Array<{
      groupId: string;
      optionId: string;
    }> = [];

    for (const group of
      selectedProduct.optionGroups) {
      const selected =
        modalSelections[
          group.id
        ] ?? [];

      for (const optionId of selected) {
        options.push({
          groupId: group.id,
          optionId,
        });
      }
    }

    setCart((current) => [
      ...current,

      {
        id: crypto.randomUUID(),

        productId:
          selectedProduct.id,

        quantity: 1,

        options,
      },
    ]);

    setSelectedProduct(null);
    setModalSelections({});
    setMessage("");
  }

  /* ==========================================================
   * REMOVE CART LINE
   * ========================================================== */

  function removeCartLine(
    lineId: string,
  ) {
    setCart((current) =>
      current.filter(
        (line) =>
          line.id !== lineId,
      ),
    );
  }

  /* ==========================================================
   * INCREASE CART LINE
   * ========================================================== */

  function increaseCartLine(
    lineId: string,
  ) {
    setCart((current) =>
      current.map((line) =>
        line.id === lineId
          ? {
              ...line,

              quantity:
                line.quantity + 1,
            }
          : line,
      ),
    );
  }

  /* ==========================================================
   * DECREASE CART LINE
   * ========================================================== */

  function decreaseCartLine(
    lineId: string,
  ) {
    setCart((current) =>
      current
        .map((line) =>
          line.id === lineId
            ? {
                ...line,

                quantity:
                  line.quantity - 1,
              }
            : line,
        )
        .filter(
          (line) =>
            line.quantity > 0,
        ),
    );
  }

  /* ==========================================================
   * GET PRODUCT
   * ========================================================== */

  function getProduct(
    productId: string,
  ) {
    return data.products.find(
      (product) =>
        product.id === productId,
    );
  }

  /* ==========================================================
   * GET LINE OPTION PRICE
   * ========================================================== */

  function getLineOptionsPrice(
    line: CartLine,
  ) {
    const product = getProduct(
      line.productId,
    );

    if (!product) {
      return 0;
    }

    let total = 0;

    for (const selection of
      line.options) {
      const group =
        product.optionGroups.find(
          (item) =>
            item.id ===
            selection.groupId,
        );

      if (!group) {
        continue;
      }

      const option =
        group.options.find(
          (item) =>
            item.id ===
            selection.optionId,
        );

      if (!option) {
        continue;
      }

      total +=
        option.additionalPrice;
    }

    return total;
  }

  /* ==========================================================
   * GET LINE UNIT PRICE
   * ========================================================== */

  function getLineUnitPrice(
    line: CartLine,
  ) {
    const product = getProduct(
      line.productId,
    );

    if (!product) {
      return 0;
    }

    return (
      product.price +
      getLineOptionsPrice(line)
    );
  }

  /* ==========================================================
   * TOTAL
   * ========================================================== */

  const total = useMemo(() => {
    return cart.reduce(
      (sum, line) =>
        sum +
        getLineUnitPrice(line) *
          line.quantity,
      0,
    );
  }, [cart, data.products]);

  /* ==========================================================
   * SUBMIT
   * ========================================================== */

  async function submit() {
    if (
      !studentId ||
      !slotId ||
      !pickupDate ||
      cart.length === 0 ||
      total <= 0 ||
      busy
    ) {
      return;
    }

    if (!student) {
      setMessage(
        "Please select a student.",
      );
      return;
    }

    if (
      !student.preOrderEnabled
    ) {
      setMessage(
        "Pre-orders are currently disabled for this school.",
      );
      return;
    }

    setBusy(true);
    setMessage("");

    try {
      const items = cart.map(
        (line) => ({
          productId:
            line.productId,

          quantity:
            line.quantity,

          options:
            line.options,
        }),
      );

      const result =
        await createParentPreOrder({
          studentId,

          pickupSlotId: slotId,

          pickupDate,

          items,

          idempotencyKey: key,
        });

      if (!result.ok) {
        setMessage(
          result.error ||
            "Order failed.",
        );

        return;
      }

      setMessage(
        `Order ${result.orderNumber} confirmed. New family balance: $${result.balanceAfter}`,
      );

      setCart([]);

      setSelectedProduct(null);

      setModalSelections({});

      setKey(
        crypto.randomUUID(),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Order failed.",
      );
    } finally {
      setBusy(false);
    }
  }

  /* ============================================================
   * RENDER
   * ============================================================ */

  return (
    <>
      <div className="wallet-layout">
        {/* ======================================================
         * LEFT
         * ====================================================== */}

        <section className="panel">
          {/* ----------------------------------------------------
           * STUDENT
           * -------------------------------------------------- */}

          <label className="label">
            Student

            <select
              className="input"
              value={studentId}
              onChange={(event) =>
                changeStudent(
                  event.target.value,
                )
              }
            >
              {data.students.map(
                (item) => (
                  <option
                    key={item.id}
                    value={item.id}
                  >
                    {item.firstName}{" "}
                    {item.lastName} ·{" "}
                    {item.displayCode} ·{" "}
                    {item.schoolName}
                  </option>
                ),
              )}
            </select>
          </label>

          {/* ----------------------------------------------------
           * STUDENT SETTINGS
           * -------------------------------------------------- */}

          {student && (
            <>
              <p className="subtle compact">
                Orders close at{" "}
                {student.cutoffTime}{" "}
                for same-day
                pickup.
              </p>

              {!student.preOrderEnabled && (
                <p className="alert">
                  Pre-orders are
                  currently disabled
                  for this school.
                </p>
              )}

              {/* PICKUP DATE */}

              <label className="label">
                Pickup date

                <input
                  className="input"
                  type="date"
                  value={pickupDate}
                  onChange={(
                    event,
                  ) =>
                    setPickupDate(
                      event.target.value,
                    )
                  }
                />
              </label>

              {/* PICKUP SLOT */}

              <label className="label">
                Pickup time

                <select
                  className="input"
                  value={slotId}
                  onChange={(
                    event,
                  ) =>
                    setSlotId(
                      event.target.value,
                    )
                  }
                >
                  {student.pickupSlots.map(
                    (slot) => (
                      <option
                        key={slot.id}
                        value={slot.id}
                      >
                        {slot.label}
                      </option>
                    ),
                  )}
                </select>
              </label>
            </>
          )}

          <div className="divider" />

          {/* ====================================================
           * PRODUCTS
           * ================================================== */}

          <h2>Products</h2>

          <p className="subtle compact">
            Select a product to add it
            to your order. Products
            with options will ask you
            to choose them.
          </p>

          <div
            className="products"
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fill, minmax(170px, 1fr))",
              gap: 12,
            }}
          >
            {data.products.map(
              (product) => (
                <button
                  key={product.id}
                  type="button"
                  className="product"
                  onClick={() =>
                    openProduct(
                      product,
                    )
                  }
                  style={{
                    minHeight: 105,
                    padding: 16,
                    textAlign:
                      "left",
                    display: "flex",
                    flexDirection:
                      "column",
                    justifyContent:
                      "space-between",
                    gap: 8,
                  }}
                >
                  <strong
                    style={{
                      fontSize: 16,
                    }}
                  >
                    {product.name}
                  </strong>

                  <span>
                    $
                    {product.price.toFixed(
                      2,
                    )}
                  </span>

                  {product
                    .optionGroups
                    .length >
                    0 && (
                    <span
                      className="subtle compact"
                    >
                      +
                      {
                        product
                          .optionGroups
                          .length
                      }{" "}
                      option group
                      {product
                        .optionGroups
                        .length ===
                      1
                        ? ""
                        : "s"}
                    </span>
                  )}
                </button>
              ),
            )}
          </div>
        </section>

        {/* ======================================================
         * ORDER SUMMARY
         * ====================================================== */}

        <aside className="panel">
          <h2>
            Order Summary
          </h2>

          <div
            style={{
              marginBottom: 14,
            }}
          >
            <span className="subtle">
              Family balance
            </span>

            <br />

            <strong
              style={{
                fontSize: 20,
              }}
            >
              $
              {data.walletBalance.toFixed(
                2,
              )}
            </strong>
          </div>

          {/* ----------------------------------------------------
           * EMPTY
           * -------------------------------------------------- */}

          {cart.length === 0 && (
            <p className="subtle">
              No products added yet.
            </p>
          )}

          {/* ----------------------------------------------------
           * CART LINES
           * -------------------------------------------------- */}

          {cart.map((line) => {
            const product =
              getProduct(
                line.productId,
              );

            if (!product) {
              return null;
            }

            const unitPrice =
              getLineUnitPrice(
                line,
              );

            const lineTotal =
              unitPrice *
              line.quantity;

            return (
              <div
                key={line.id}
                style={{
                  padding:
                    "12px 0",
                  borderBottom:
                    "1px solid #e5e7eb",
                }}
              >
                <div
                  style={{
                    display:
                      "flex",
                    justifyContent:
                      "space-between",
                    gap: 12,
                  }}
                >
                  <div>
                    <strong>
                      {
                        product.name
                      }
                    </strong>

                    <div className="subtle compact">
                      $
                      {unitPrice.toFixed(
                        2,
                      )}{" "}
                      ×{" "}
                      {line.quantity}
                    </div>
                  </div>

                  <strong>
                    $
                    {lineTotal.toFixed(
                      2,
                    )}
                  </strong>
                </div>

                {/* SELECTED OPTIONS */}

                {line.options.length >
                  0 && (
                  <div
                    style={{
                      marginTop: 8,
                      paddingLeft: 8,
                    }}
                  >
                    {line.options.map(
                      (
                        selection,
                      ) => {
                        const group =
                          product.optionGroups.find(
                            (
                              item,
                            ) =>
                              item.id ===
                              selection.groupId,
                          );

                        const option =
                          group?.options.find(
                            (
                              item,
                            ) =>
                              item.id ===
                              selection.optionId,
                          );

                        if (
                          !group ||
                          !option
                        ) {
                          return null;
                        }

                        return (
                          <div
                            key={`${selection.groupId}-${selection.optionId}`}
                            className="subtle compact"
                          >
                            <strong>
                              {
                                group.name
                              }
                              :
                            </strong>{" "}
                            {
                              option.name
                            }

                            {option.additionalPrice >
                              0 && (
                              <>
                                {" "}
                                +
                                $
                                {option.additionalPrice.toFixed(
                                  2,
                                )}
                              </>
                            )}
                          </div>
                        );
                      },
                    )}
                  </div>
                )}

                {/* LINE ACTIONS */}

                <div
                  style={{
                    display:
                      "flex",
                    gap: 8,
                    marginTop: 10,
                  }}
                >
                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      decreaseCartLine(
                        line.id,
                      )
                    }
                    style={{
                      minWidth: 36,
                      height: 34,
                      padding: 0,
                    }}
                  >
                    −
                  </button>

                  <span
                    style={{
                      minWidth: 30,
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "center",
                    }}
                  >
                    {
                      line.quantity
                    }
                  </span>

                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      increaseCartLine(
                        line.id,
                      )
                    }
                    style={{
                      minWidth: 36,
                      height: 34,
                      padding: 0,
                    }}
                  >
                    +
                  </button>

                  <button
                    type="button"
                    className="secondary"
                    onClick={() =>
                      removeCartLine(
                        line.id,
                      )
                    }
                    style={{
                      marginLeft:
                        "auto",
                    }}
                  >
                    Remove
                  </button>
                </div>
              </div>
            );
          })}

          <div className="divider" />

          {/* TOTAL */}

          <div
            style={{
              display:
                "flex",
              justifyContent:
                "space-between",
              fontSize: 20,
              fontWeight: 700,
            }}
          >
            <span>
              Total
            </span>

            <span>
              $
              {total.toFixed(2)}
            </span>
          </div>

          <div
            style={{
              marginTop: 8,
            }}
          >
            <span className="subtle">
              Projected balance
            </span>

            <br />

            <strong>
              $
              {(
                data.walletBalance -
                total
              ).toFixed(2)}
            </strong>
          </div>

          <div
            style={{
              height: 14,
            }}
          />

          {/* PLACE ORDER */}

          <button
            type="button"
            className="primary"
            disabled={
              busy ||
              cart.length === 0 ||
              total <= 0 ||
              !pickupDate ||
              !slotId ||
              !student ||
              !student.preOrderEnabled
            }
            onClick={() =>
              void submit()
            }
            style={{
              width: "100%",
            }}
          >
            {busy
              ? "Processing…"
              : "Place Order"}
          </button>

          {message && (
            <p
              className={
                message.startsWith(
                  "Order ",
                )
                  ? "success"
                  : "alert"
              }
            >
              {message}
            </p>
          )}
        </aside>
      </div>

      {/* ========================================================
       * PRODUCT OPTIONS MODAL
       * ====================================================== */}

      {selectedProduct && (
        <div
          role="dialog"
          aria-modal="true"
          aria-labelledby="preorder-product-title"
          onClick={() =>
            setSelectedProduct(null)
          }
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9999,
            background:
              "rgba(0, 0, 0, 0.55)",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            padding: 16,
          }}
        >
          <div
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              width: "100%",
              maxWidth: 620,
              maxHeight:
                "calc(100vh - 32px)",
              overflowY: "auto",
              background:
                "white",
              borderRadius: 18,
              padding: 22,
              boxShadow:
                "0 24px 80px rgba(0,0,0,0.35)",
            }}
          >
            {/* --------------------------------------------------
             * MODAL HEADER
             * ------------------------------------------------ */}

            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "flex-start",
                gap: 16,
                marginBottom: 18,
              }}
            >
              <div>
                <h2
                  id="preorder-product-title"
                  style={{
                    margin: 0,
                  }}
                >
                  {
                    selectedProduct.name
                  }
                </h2>

                <p
                  className="subtle"
                  style={{
                    margin:
                      "6px 0 0",
                  }}
                >
                  Base price: $
                  {selectedProduct.price.toFixed(
                    2,
                  )}
                </p>
              </div>

              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setSelectedProduct(
                    null,
                  )
                }
                style={{
                  minWidth: 40,
                  height: 40,
                  padding: 0,
                  fontSize: 20,
                }}
              >
                ×
              </button>
            </div>

            {/* --------------------------------------------------
             * OPTION GROUPS
             * ------------------------------------------------ */}

            {selectedProduct.optionGroups.map(
              (group) => {
                const selected =
                  modalSelections[
                    group.id
                  ] ?? [];

                const minimum =
                  Math.max(
                    group.minSelections,
                    group.isRequired
                      ? 1
                      : 0,
                  );

                const isSingle =
                  group.maxSelections <=
                  1;

                return (
                  <section
                    key={group.id}
                    style={{
                      marginBottom: 20,
                      padding: 16,
                      border:
                        "1px solid #e5e7eb",
                      borderRadius: 14,
                      background:
                        "#fafafa",
                    }}
                  >
                    {/* GROUP HEADER */}

                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        alignItems:
                          "flex-start",
                        gap: 10,
                        marginBottom: 12,
                      }}
                    >
                      <div>
                        <strong
                          style={{
                            fontSize: 17,
                          }}
                        >
                          {
                            group.name
                          }
                        </strong>

                        <div className="subtle compact">
                          {isSingle
                            ? "Choose 1"
                            : `Choose ${minimum}–${group.maxSelections}`}
                        </div>
                      </div>

                      {minimum >
                        0 && (
                        <span
                          className="badge"
                        >
                          Required
                        </span>
                      )}
                    </div>

                    {/* OPTIONS */}

                    <div
                      style={{
                        display:
                          "grid",
                        gap: 9,
                      }}
                    >
                      {group.options.map(
                        (option) => {
                          const checked =
                            selected.includes(
                              option.id,
                            );

                          return (
                            <label
                              key={
                                option.id
                              }
                              style={{
                                display:
                                  "flex",
                                alignItems:
                                  "center",
                                gap: 12,
                                padding:
                                  "12px 14px",
                                border:
                                  checked
                                    ? "2px solid #111827"
                                    : "1px solid #d1d5db",
                                borderRadius: 12,
                                background:
                                  checked
                                    ? "#f3f4f6"
                                    : "white",
                                cursor:
                                  "pointer",
                                transition:
                                  "all 0.15s ease",
                              }}
                            >
                              <input
                                type={
                                  isSingle
                                    ? "radio"
                                    : "checkbox"
                                }
                                name={
                                  isSingle
                                    ? `group-${group.id}`
                                    : undefined
                                }
                                checked={
                                  checked
                                }
                                onChange={() =>
                                  toggleOption(
                                    group,
                                    option.id,
                                  )
                                }
                              />

                              <span
                                style={{
                                  flex: 1,
                                  fontWeight:
                                    checked
                                      ? 600
                                      : 400,
                                }}
                              >
                                {
                                  option.name
                                }
                              </span>

                              {option.additionalPrice >
                              0 ? (
                                <strong>
                                  +$
                                  {option.additionalPrice.toFixed(
                                    2,
                                  )}
                                </strong>
                              ) : (
                                <span className="subtle">
                                  Included
                                </span>
                              )}
                            </label>
                          );
                        },
                      )}
                    </div>
                  </section>
                );
              },
            )}

            {/* --------------------------------------------------
             * MODAL ERROR
             * ------------------------------------------------ */}

            {message &&
              !message.startsWith(
                "Order ",
              ) && (
                <p className="alert">
                  {message}
                </p>
              )}

            {/* --------------------------------------------------
             * MODAL FOOTER
             * ------------------------------------------------ */}

            <div
              style={{
                display:
                  "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap: 12,
                paddingTop: 6,
                borderTop:
                  "1px solid #e5e7eb",
              }}
            >
              <div>
                <span className="subtle">
                  Final price
                </span>

                <br />

                <strong
                  style={{
                    fontSize: 22,
                  }}
                >
                  $
                  {(
                    selectedProduct.price +
                    Object.entries(
                      modalSelections,
                    ).reduce(
                      (
                        total,
                        [
                          groupId,
                          optionIds,
                        ],
                      ) => {
                        const group =
                          selectedProduct.optionGroups.find(
                            (
                              item,
                            ) =>
                              item.id ===
                              groupId,
                          );

                        if (!group) {
                          return total;
                        }

                        return (
                          total +
                          optionIds.reduce(
                            (
                              optionTotal,
                              optionId,
                            ) => {
                              const option =
                                group.options.find(
                                  (
                                    item,
                                  ) =>
                                    item.id ===
                                    optionId,
                                );

                              return (
                                optionTotal +
                                (option
                                  ?.additionalPrice ??
                                  0)
                              );
                            },
                            0,
                          )
                        );
                      },
                      0,
                    )
                  ).toFixed(2)}
                </strong>
              </div>

              <div
                style={{
                  display:
                    "flex",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  className="secondary"
                  onClick={() =>
                    setSelectedProduct(
                      null,
                    )
                  }
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="primary"
                  onClick={() =>
                    addConfiguredProduct()
                  }
                >
                  Add to Order
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </>
  );
}