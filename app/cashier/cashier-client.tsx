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

type SelectedOptionsMap =
  Record<string, string[]>;

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

  /*
   * Product id -> selected option ids
   *
   * We keep the selected options separately
   * from the quantity so the existing cart
   * structure remains simple.
   */
  const [
    selectedOptions,
    setSelectedOptions,
  ] = useState<SelectedOptionsMap>({});

  /*
   * Product currently being configured.
   */
  const [
    optionProduct,
    setOptionProduct,
  ] = useState<Product | null>(null);

  const [
    optionError,
    setOptionError,
  ] = useState("");

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [
    adminPassword,
    setAdminPassword,
  ] = useState("");

  const [
    needsOverride,
    setNeedsOverride,
  ] = useState(false);

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
  ] = useState<DailySpending | null>(
    null,
  );

  const [
    loadingDailySpending,
    setLoadingDailySpending,
  ] = useState(false);

  const [key, setKey] =
    useState(() =>
      crypto.randomUUID(),
    );

  const nfcInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  /*
   * ------------------------------------------------------------
   * NFC FOCUS
   * ------------------------------------------------------------
   */

  function focusNfcInput() {
    window.setTimeout(() => {
      nfcInputRef.current?.focus();
      nfcInputRef.current?.select();
    }, 50);
  }

  /*
   * ------------------------------------------------------------
   * INITIAL LOAD
   * ------------------------------------------------------------
   */

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
     * Prepare NFC input when cashier
     * page opens.
     */
    focusNfcInput();
  }, []);

  /*
   * ------------------------------------------------------------
   * DAILY SPENDING
   * ------------------------------------------------------------
   */

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

  /*
   * ------------------------------------------------------------
   * NORMAL STUDENT SEARCH
   * ------------------------------------------------------------
   */

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
        await findCashierStudents(
          value,
        );

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
   * ------------------------------------------------------------
   * NFC SEARCH
   * ------------------------------------------------------------
   *
   * The NFC reader behaves like a keyboard.
   *
   * It types the card number into the NFC
   * input and normally sends Enter afterwards.
   *
   * The important part is that the Enter is
   * handled automatically here, so the cashier
   * does not have to click Search.
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
        await findCashierStudents(
          value,
        );

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

  /*
   * ------------------------------------------------------------
   * SELECT STUDENT
   * ------------------------------------------------------------
   */

  function select(
    selected: Student,
  ) {
    setStudent(selected);

    setResults([]);

    setQ(selected.displayCode);

    setNfc("");

    setNfcMessage("");

    setCart({});

    setSelectedOptions({});

    setOptionProduct(null);

    setOptionError("");

    setMessage("");

    setNeedsOverride(false);

    setAdminPassword("");

    setShowBalancePopup(false);

    setShowAdminApproval(false);

    void loadDailySpending(
      selected.id,
    );
  }

  /*
   * ------------------------------------------------------------
   * PRODUCT OPTIONS HELPERS
   * ------------------------------------------------------------
   */

  function productHasOptions(
    product: Product,
  ) {
    return (
      product.optionGroups.length > 0
    );
  }

  function getSelectedOptionIds(
    productId: string,
  ) {
    return (
      selectedOptions[productId] ?? []
    );
  }

  function getSelectedOptionsForGroup(
    product: Product,
    groupId: string,
  ) {
    const ids =
      getSelectedOptionIds(
        product.id,
      );

    const group =
      product.optionGroups.find(
        (item) =>
          item.id === groupId,
      );

    if (!group) {
      return [];
    }

    return group.options.filter(
      (option) =>
        ids.includes(option.id),
    );
  }

  /*
   * ------------------------------------------------------------
   * ADD PRODUCT
   * ------------------------------------------------------------
   */

  function addProduct(
    product: Product,
  ) {
    /*
     * Products without options are added
     * immediately.
     */

    if (
      !productHasOptions(product)
    ) {
      setCart((current) => ({
        ...current,

        [product.id]:
          (current[product.id] ?? 0) +
          1,
      }));

      return;
    }

    /*
     * Products with options open the
     * configuration popup.
     */

    setOptionProduct(product);

    setOptionError("");
  }

  /*
   * ------------------------------------------------------------
   * TOGGLE OPTION
   * ------------------------------------------------------------
   */

  function toggleOption(
    product: Product,
    groupId: string,
    optionId: string,
  ) {
    const group =
      product.optionGroups.find(
        (item) =>
          item.id === groupId,
      );

    if (!group) {
      return;
    }

    setSelectedOptions(
      (current) => {
        const currentIds =
          current[product.id] ?? [];

        const groupOptionIds =
          group.options.map(
            (option) =>
              option.id,
          );

        const selectedInGroup =
          currentIds.filter((id) =>
            groupOptionIds.includes(
              id,
            ),
          );

        /*
         * Remove selected option.
         */

        if (
          currentIds.includes(
            optionId,
          )
        ) {
          return {
            ...current,

            [product.id]:
              currentIds.filter(
                (id) =>
                  id !== optionId,
              ),
          };
        }

        /*
         * If the group only allows one
         * selection, replace the existing
         * selection.
         */

        if (
          group.maxSelections === 1
        ) {
          return {
            ...current,

            [product.id]: [
              ...currentIds.filter(
                (id) =>
                  !groupOptionIds.includes(
                    id,
                  ),
              ),
              optionId,
            ],
          };
        }

        /*
         * Maximum selection reached.
         */

        if (
          group.maxSelections > 0 &&
          selectedInGroup.length >=
            group.maxSelections
        ) {
          return current;
        }

        /*
         * Add option.
         */

        return {
          ...current,

          [product.id]: [
            ...currentIds,
            optionId,
          ],
        };
      },
    );

    setOptionError("");
  }

  /*
   * ------------------------------------------------------------
   * VALIDATE OPTIONS
   * ------------------------------------------------------------
   */

  function validateOptions(
    product: Product,
  ) {
    const ids =
      getSelectedOptionIds(
        product.id,
      );

    for (const group of
      product.optionGroups) {
      const groupOptionIds =
        group.options.map(
          (option) =>
            option.id,
        );

      const selectedCount =
        ids.filter((id) =>
          groupOptionIds.includes(
            id,
          ),
        ).length;

      const minimum =
        Math.max(
          group.minSelections,
          group.isRequired
            ? 1
            : 0,
        );

      if (
        selectedCount < minimum
      ) {
        return `${group.name} requires at least ${minimum} selection${
          minimum === 1 ? "" : "s"
        }.`;
      }

      if (
        group.maxSelections > 0 &&
        selectedCount >
          group.maxSelections
      ) {
        return `${group.name} allows a maximum of ${group.maxSelections} selections.`;
      }
    }

    return null;
  }

  /*
   * ------------------------------------------------------------
   * CONFIRM PRODUCT OPTIONS
   * ------------------------------------------------------------
   */

  function confirmOptions() {
    if (!optionProduct) {
      return;
    }

    const error =
      validateOptions(
        optionProduct,
      );

    if (error) {
      setOptionError(error);
      return;
    }

    /*
     * Add one quantity of this configured
     * product.
     */

    setCart((current) => ({
      ...current,

      [optionProduct.id]:
        (current[optionProduct.id] ??
          0) + 1,
    }));

    setOptionProduct(null);

    setOptionError("");
  }

  /*
   * ------------------------------------------------------------
   * CANCEL OPTIONS
   * ------------------------------------------------------------
   */

  function cancelOptions() {
    setOptionProduct(null);

    setOptionError("");

    focusNfcInput();
  }

  /*
   * ------------------------------------------------------------
   * REMOVE PRODUCT
   * ------------------------------------------------------------
   */

  function removeProduct(
    productId: string,
  ) {
    setCart((current) => {
      const nextQuantity =
        Math.max(
          0,
          (current[productId] ?? 0) -
            1,
        );

      return {
        ...current,
        [productId]:
          nextQuantity,
      };
    });
  }

  /*
   * ------------------------------------------------------------
   * OPTION PRICE
   * ------------------------------------------------------------
   */

  function getProductUnitPrice(
    product: Product,
  ) {
    const ids =
      getSelectedOptionIds(
        product.id,
      );

    const optionTotal =
      product.optionGroups
        .flatMap(
          (group) =>
            group.options,
        )
        .filter((option) =>
          ids.includes(option.id),
        )
        .reduce(
          (sum, option) =>
            sum +
            Number(
              option.additionalPrice,
            ),
          0,
        );

    return (
      Number(product.price) +
      optionTotal
    );
  }

  /*
   * ------------------------------------------------------------
   * TOTAL
   * ------------------------------------------------------------
   */

  const total = useMemo(
    () =>
      products.reduce(
        (sum, product) => {
          const quantity =
            cart[product.id] ?? 0;

          if (quantity <= 0) {
            return sum;
          }

          return (
            sum +
            getProductUnitPrice(
              product,
            ) *
              quantity
          );
        },
        0,
      ),
    [
      products,
      cart,
      selectedOptions,
    ],
  );

  /*
   * ------------------------------------------------------------
   * BALANCE
   * ------------------------------------------------------------
   */

  const balance =
    student?.parent.wallet
      ? Number(
          student.parent.wallet
            .balance,
        )
      : 0;

  /*
   * ------------------------------------------------------------
   * CONFIRM SALE
   * ------------------------------------------------------------
   */

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

              optionIds:
                selectedOptions[
                  productId
                ] ?? [],
            }),
          );

      const result =
        await createCashierSale({
          studentId:
            student.id,

          items,

          idempotencyKey:
            key,

          adminPassword:
            adminPassword ||
            undefined,
        });

      if (!result.ok) {
        if (
          result.needsAdminOverride ===
          true
        ) {
          setNeedsOverride(true);

          setShowBalancePopup(
            true,
          );

          setShowAdminApproval(
            false,
          );

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

      setShowBalancePopup(
        false,
      );

      setShowAdminApproval(
        false,
      );

      setMessage(
        `Sale ${result.saleNumber} completed. New balance: $${result.balanceAfter}`,
      );

      setCart({});

      setSelectedOptions({});

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

  /*
   * ------------------------------------------------------------
   * BALANCE POPUP
   * ------------------------------------------------------------
   */

  function closeBalancePopup() {
    setShowBalancePopup(
      false,
    );

    setShowAdminApproval(
      false,
    );

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

  /*
   * ------------------------------------------------------------
   * RENDER
   * ------------------------------------------------------------
   */

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
            alignItems:
              "center",
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
        {/* NORMAL STUDENT SEARCH */}

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
                setQ(
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

        {/* NFC */}

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
                  event.target
                    .value,
                );

                setNfcMessage("");
              }}
              onKeyDown={(
                event,
              ) => {
                /*
                 * NFC readers normally send
                 * Enter automatically.
                 *
                 * This performs the lookup
                 * immediately.
                 */

                if (
                  event.key ===
                  "Enter"
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
            Tap the student's NFC
            card on the reader. The
            student will be selected
            automatically.
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
            {results.map(
              (result) => (
                <button
                  type="button"
                  key={result.id}
                  className="product"
                  onClick={() => {
                    select(
                      result,
                    );

                    focusNfcInput();
                  }}
                >
                  {result.firstName}{" "}
                  {result.lastName}{" "}
                  —{" "}
                  {
                    result.displayCode
                  }
                </button>
              ),
            )}
          </div>
        )}
      </div>

      {student && (
        <>
          {/* STUDENT */}

          <div className="panel">
            <strong>
              {student.firstName}{" "}
              {student.lastName}
            </strong>{" "}
            ·{" "}
            {student.displayCode}{" "}
            · Class{" "}
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
                  $
                  {balance.toFixed(
                    2,
                  )}
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
                <span
                  className="subtle"
                  style={
                    !loadingDailySpending &&
                    dailySpending?.remainingToday !==
                      null &&
                    Number(
                      dailySpending?.remainingToday ??
                        0,
                    ) < 5
                      ? {
                          color:
                            "#dc2626",
                          fontWeight: 700,
                        }
                      : undefined
                  }
                >
                  Remaining today
                </span>{" "}
                <strong
                  style={
                    !loadingDailySpending &&
                    dailySpending?.remainingToday !==
                      null &&
                    Number(
                      dailySpending?.remainingToday ??
                        0,
                    ) < 5
                      ? {
                          color:
                            "#dc2626",
                        }
                      : undefined
                  }
                >
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
            {/* PRODUCTS */}

            <div className="panel">
              <h2>
                Products
              </h2>

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
                          product,
                        )
                      }
                      style={{
                        padding: 10,
                        display:
                          "flex",
                        flexDirection:
                          "column",
                        alignItems:
                          "center",
                        justifyContent:
                          "flex-start",
                        gap: 7,
                        minHeight: 195,
                        textAlign:
                          "center",
                        overflow:
                          "hidden",
                      }}
                    >
                      <div
                        style={{
                          width:
                            "100%",
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
                          lineHeight:
                            1.2,
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

                      {productHasOptions(
                        product,
                      ) && (
                        <span
                          className="subtle compact"
                          style={{
                            fontSize: 11,
                          }}
                        >
                          Options available
                        </span>
                      )}

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

            {/* CURRENT SALE */}

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
                .map(
                  (product) => {
                    const quantity =
                      cart[
                        product.id
                      ] ?? 0;

                    const unitPrice =
                      getProductUnitPrice(
                        product,
                      );

                    const optionIds =
                      getSelectedOptionIds(
                        product.id,
                      );

                    const chosenOptions =
                      product.optionGroups
                        .flatMap(
                          (group) =>
                            group.options,
                        )
                        .filter(
                          (option) =>
                            optionIds.includes(
                              option.id,
                            ),
                        );

                    return (
                      <div
                        key={
                          product.id
                        }
                        style={{
                          display:
                            "flex",
                          alignItems:
                            "flex-start",
                          gap: 10,
                          padding:
                            "8px 0",
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
                              quantity
                            }{" "}
                            · $
                            {unitPrice.toFixed(
                              2,
                            )}
                          </span>

                          {chosenOptions.length >
                            0 && (
                            <div
                              className="subtle compact"
                              style={{
                                marginTop: 3,
                                lineHeight:
                                  1.4,
                              }}
                            >
                              {chosenOptions
                                .map(
                                  (
                                    option,
                                  ) =>
                                    `${option.name}${
                                      Number(
                                        option.additionalPrice,
                                      ) > 0
                                        ? ` (+$${Number(
                                            option.additionalPrice,
                                          ).toFixed(
                                            2,
                                          )})`
                                        : ""
                                    }`,
                                )
                                .join(
                                  ", ",
                                )}
                            </div>
                          )}
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
                    );
                  },
                )}

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

      {/* ============================================================
          PRODUCT OPTIONS POPUP
          ============================================================ */}

      {optionProduct && (
        <div
          style={{
            position:
              "fixed",
            inset: 0,
            background:
              "rgba(0, 0, 0, 0.55)",
            display:
              "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            zIndex: 10000,
            padding: 20,
          }}
        >
          <div
            style={{
              width: "100%",
              maxWidth: 520,
              maxHeight:
                "90vh",
              overflowY:
                "auto",
              background:
                "white",
              borderRadius: 16,
              padding: 24,
              boxShadow:
                "0 20px 60px rgba(0,0,0,0.3)",
            }}
          >
            <h2
              style={{
                marginTop: 0,
              }}
            >
              {optionProduct.name}
            </h2>

            <p className="subtle">
              Base price: $
              {Number(
                optionProduct.price,
              ).toFixed(2)}
            </p>

            {optionProduct.optionGroups.map(
              (group) => {
                const ids =
                  getSelectedOptionIds(
                    optionProduct.id,
                  );

                const selectedCount =
                  group.options.filter(
                    (option) =>
                      ids.includes(
                        option.id,
                      ),
                  ).length;

                const minimum =
                  Math.max(
                    group.minSelections,
                    group.isRequired
                      ? 1
                      : 0,
                  );

                return (
                  <section
                    key={
                      group.id
                    }
                    className="panel"
                    style={{
                      marginTop: 12,
                    }}
                  >
                    <strong>
                      {group.name}
                    </strong>

                    <div
                      className="subtle compact"
                      style={{
                        marginTop: 4,
                      }}
                    >
                      {group.isRequired
                        ? "Required"
                        : "Optional"}

                      {" · "}

                      {minimum >
                      0
                        ? `Choose at least ${minimum}`
                        : group.maxSelections ===
                          1
                        ? "Choose one"
                        : group.maxSelections >
                          1
                        ? `Choose up to ${group.maxSelections}`
                        : "No minimum selection"}
                    </div>

                    <div
                      style={{
                        marginTop: 10,
                        display:
                          "grid",
                        gap: 8,
                      }}
                    >
                      {group.options.map(
                        (
                          option,
                        ) => {
                          const checked =
                            ids.includes(
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
                                justifyContent:
                                  "space-between",
                                gap: 10,
                                padding: 10,
                                border:
                                  "1px solid #e5e7eb",
                                borderRadius: 10,
                                cursor:
                                  "pointer",
                              }}
                            >
                              <span
                                style={{
                                  display:
                                    "flex",
                                  alignItems:
                                    "center",
                                  gap: 8,
                                }}
                              >
                                <input
                                  type={
                                    group.maxSelections ===
                                    1
                                      ? "radio"
                                      : "checkbox"
                                  }
                                  name={
                                    group.maxSelections ===
                                    1
                                      ? `option-${group.id}`
                                      : undefined
                                  }
                                  checked={
                                    checked
                                  }
                                  onChange={() =>
                                    toggleOption(
                                      optionProduct,
                                      group.id,
                                      option.id,
                                    )
                                  }
                                />

                                {
                                  option.name
                                }
                              </span>

                              <strong>
                                {Number(
                                  option.additionalPrice,
                                ) >
                                0
                                  ? `+$${Number(
                                      option.additionalPrice,
                                    ).toFixed(
                                      2,
                                    )}`
                                  : "$0.00"}
                              </strong>
                            </label>
                          );
                        },
                      )}
                    </div>

                    <div
                      className="subtle compact"
                      style={{
                        marginTop: 8,
                      }}
                    >
                      Selected:{" "}
                      {
                        selectedCount
                      }
                    </div>
                  </section>
                );
              },
            )}

            {optionError && (
              <p className="alert">
                {optionError}
              </p>
            )}

            <div
              className="actions-row"
              style={{
                marginTop: 16,
              }}
            >
              <button
                type="button"
                className="secondary"
                onClick={
                  cancelOptions
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary"
                onClick={
                  confirmOptions
                }
              >
                Add to Sale
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ============================================================
          INSUFFICIENT BALANCE POPUP
          ============================================================ */}

      {showBalancePopup && (
        <div
          style={{
            position:
              "fixed",
            inset: 0,
            background:
              "rgba(0, 0, 0, 0.55)",
            display:
              "flex",
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
              background:
                "white",
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
                  does not have
                  enough balance to
                  complete this
                  sale.
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
                      ).toFixed(
                        2,
                      )}
                    </strong>
                  </div>
                </div>

                <div
                  style={{
                    display:
                      "flex",
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
                    display:
                      "flex",
                    gap: 10,
                  }}
                >
                  <button
                    type="button"
                    className="secondary"
                    style={{
                      flex: 1,
                    }}
                    disabled={
                      busy
                    }
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
                      width:
                        "100%",
                    }}
                    disabled={
                      busy
                    }
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