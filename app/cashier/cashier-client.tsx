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

type ProductOption = {
  id: string;
  name: string;
  additionalPrice: unknown;
  isActive: boolean;
  sortOrder: number;
};

type ProductOptionGroup = {
  id: string;
  name: string;
  minSelections: number;
  maxSelections: number;
  isRequired: boolean;
  isActive: boolean;
  sortOrder: number;
  options: ProductOption[];
};

type ProductWithOptions = Product & {
  optionGroups?: ProductOptionGroup[];
};

type DailySpending = {
  dailyLimit: number | null;
  spentToday: number;
  remainingToday: number | null;
};

type CartLine = {
  productId: string;
  quantity: number;
  optionIds: string[];
};

type CartItem = {
  key: string;
  productId: string;
  quantity: number;
  optionIds: string[];
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
    useState<ProductWithOptions[]>([]);

  const [cart, setCart] =
    useState<CartItem[]>([]);

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

  const [
    selectedProduct,
    setSelectedProduct,
  ] =
    useState<ProductWithOptions | null>(null);

  const [
    selectedOptions,
    setSelectedOptions,
  ] = useState<Record<string, string[]>>({});

  const [key, setKey] =
    useState(() => crypto.randomUUID());

  const nfcInputRef =
    useRef<HTMLInputElement | null>(null);

  /*
   * ------------------------------------------------------------
   * LOAD PRODUCTS
   * ------------------------------------------------------------
   */

  useEffect(() => {
    getCashierProducts()
      .then((data) => {
        setProducts(
          data as ProductWithOptions[],
        );
      })
      .catch((error) => {
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not load products",
        );
      });
  }, []);

  /*
   * ------------------------------------------------------------
   * NFC FOCUS
   * ------------------------------------------------------------
   */

  function focusNfcInput() {
    setTimeout(() => {
      nfcInputRef.current?.focus();
    }, 50);
  }

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
   * ------------------------------------------------------------
   * NFC SEARCH
   * ------------------------------------------------------------
   */

  async function searchNfc() {
    const value = nfc.trim();

    if (!value) {
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
    } catch (error) {
      setNfcMessage(
        error instanceof Error
          ? error.message
          : "NFC search failed",
      );
    }
  }

  /*
   * ------------------------------------------------------------
   * SELECT STUDENT
   * ------------------------------------------------------------
   */

  function select(selected: Student) {
    setStudent(selected);

    setResults([]);

    setQ(selected.displayCode);

    setNfc("");
    setNfcMessage("");

    setCart([]);

    setMessage("");

    setNeedsOverride(false);

    setAdminPassword("");

    setShowBalancePopup(false);
    setShowAdminApproval(false);

    void loadDailySpending(
      selected.id,
    );

    focusNfcInput();
  }

  /*
   * ------------------------------------------------------------
   * PRODUCT OPTIONS HELPERS
   * ------------------------------------------------------------
   */

  function getProductOptions(
    product: ProductWithOptions,
  ) {
    return (
      product.optionGroups?.filter(
        (group) =>
          group.isActive &&
          group.options?.some(
            (option) => option.isActive,
          ),
      ) ?? []
    );
  }

  function productHasOptions(
    product: ProductWithOptions,
  ) {
    return (
      getProductOptions(product).length > 0
    );
  }

  function optionPrice(
    option: ProductOption,
  ) {
    return Number(
      option.additionalPrice ?? 0,
    );
  }

  function selectedOptionCount(
    groupId: string,
  ) {
    return (
      selectedOptions[groupId]?.length ?? 0
    );
  }

  function allRequiredOptionsSelected() {
    if (!selectedProduct) {
      return true;
    }

    const groups =
      getProductOptions(selectedProduct);

    for (const group of groups) {
      const count =
        selectedOptionCount(group.id);

      const min =
        Math.max(
          group.minSelections ?? 0,
          group.isRequired ? 1 : 0,
        );

      if (count < min) {
        return false;
      }

      if (
        group.maxSelections > 0 &&
        count > group.maxSelections
      ) {
        return false;
      }
    }

    return true;
  }

  function optionValidationMessage() {
    if (!selectedProduct) {
      return "";
    }

    const groups =
      getProductOptions(selectedProduct);

    for (const group of groups) {
      const count =
        selectedOptionCount(group.id);

      const min =
        Math.max(
          group.minSelections ?? 0,
          group.isRequired ? 1 : 0,
        );

      if (count < min) {
        return `${group.name}: please select at least ${min} option${
          min === 1 ? "" : "s"
        }.`;
      }

      if (
        group.maxSelections > 0 &&
        count > group.maxSelections
      ) {
        return `${group.name}: please select no more than ${group.maxSelections} option${
          group.maxSelections === 1
            ? ""
            : "s"
        }.`;
      }
    }

    return "";
  }

  function toggleOption(
    group: ProductOptionGroup,
    optionId: string,
  ) {
    setSelectedOptions((current) => {
      const existing =
        current[group.id] ?? [];

      const alreadySelected =
        existing.includes(optionId);

      if (alreadySelected) {
        return {
          ...current,
          [group.id]: existing.filter(
            (id) => id !== optionId,
          ),
        };
      }

      const max =
        group.maxSelections;

      if (
        max > 0 &&
        existing.length >= max
      ) {
        if (max === 1) {
          return {
            ...current,
            [group.id]: [optionId],
          };
        }

        return current;
      }

      return {
        ...current,
        [group.id]: [
          ...existing,
          optionId,
        ],
      };
    });
  }

  /*
   * ------------------------------------------------------------
   * OPEN PRODUCT
   * ------------------------------------------------------------
   */

  function handleProductClick(
    product: ProductWithOptions,
  ) {
    if (!productHasOptions(product)) {
      addProduct(
        product.id,
        [],
      );

      return;
    }

    const initial: Record<
      string,
      string[]
    > = {};

    for (const group of getProductOptions(
      product,
    )) {
      initial[group.id] = [];
    }

    setSelectedOptions(initial);

    setSelectedProduct(product);
  }

  /*
   * ------------------------------------------------------------
   * ADD PRODUCT
   * ------------------------------------------------------------
   */

  function addProduct(
    productId: string,
    optionIds: string[],
  ) {
    const optionKey =
      [...optionIds]
        .sort()
        .join("|");

    const itemKey =
      `${productId}:${optionKey}`;

    setCart((current) => {
      const existing =
        current.find(
          (item) =>
            item.key === itemKey,
        );

      if (existing) {
        return current.map((item) =>
          item.key === itemKey
            ? {
                ...item,
                quantity:
                  item.quantity + 1,
              }
            : item,
        );
      }

      return [
        ...current,
        {
          key: itemKey,
          productId,
          quantity: 1,
          optionIds,
        },
      ];
    });
  }

  /*
   * ------------------------------------------------------------
   * CONFIRM PRODUCT WITH OPTIONS
   * ------------------------------------------------------------
   */

  function confirmProductOptions() {
    if (!selectedProduct) {
      return;
    }

    const validation =
      optionValidationMessage();

    if (validation) {
      setMessage(validation);
      return;
    }

    const optionIds =
      Object.values(
        selectedOptions,
      ).flat();

    addProduct(
      selectedProduct.id,
      optionIds,
    );

    setSelectedProduct(null);
    setSelectedOptions({});
    setMessage("");
  }

  function closeProductOptions() {
    setSelectedProduct(null);
    setSelectedOptions({});
  }

  /*
   * ------------------------------------------------------------
   * REMOVE PRODUCT
   * ------------------------------------------------------------
   */

  function removeCartItem(
    cartKey: string,
  ) {
    setCart((current) => {
      const item =
        current.find(
          (entry) =>
            entry.key === cartKey,
        );

      if (!item) {
        return current;
      }

      if (item.quantity > 1) {
        return current.map(
          (entry) =>
            entry.key === cartKey
              ? {
                  ...entry,
                  quantity:
                    entry.quantity - 1,
                }
              : entry,
        );
      }

      return current.filter(
        (entry) =>
          entry.key !== cartKey,
      );
    });
  }

  /*
   * ------------------------------------------------------------
   * PRODUCT MAP
   * ------------------------------------------------------------
   */

  const productMap = useMemo(
    () =>
      new Map(
        products.map((product) => [
          product.id,
          product,
        ]),
      ),
    [products],
  );

  /*
   * ------------------------------------------------------------
   * CART ITEM PRICE
   * ------------------------------------------------------------
   */

  function getCartItemUnitPrice(
    item: CartItem,
  ) {
    const product =
      productMap.get(
        item.productId,
      );

    if (!product) {
      return 0;
    }

    const basePrice =
      Number(product.price);

    const optionTotal =
      item.optionIds.reduce(
        (sum, optionId) => {
          for (const group of getProductOptions(
            product,
          )) {
            const option =
              group.options.find(
                (entry) =>
                  entry.id === optionId,
              );

            if (option) {
              return (
                sum +
                optionPrice(option)
              );
            }
          }

          return sum;
        },
        0,
      );

    return (
      basePrice +
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
      cart.reduce(
        (sum, item) =>
          sum +
          getCartItemUnitPrice(
            item,
          ) *
            item.quantity,
        0,
      ),
    [cart, products],
  );

  /*
   * ------------------------------------------------------------
   * BALANCE
   * ------------------------------------------------------------
   */

  const balance =
    student?.parent.wallet
      ? Number(
          student.parent.wallet.balance,
        )
      : 0;

  /*
   * ------------------------------------------------------------
   * CART DISPLAY OPTIONS
   * ------------------------------------------------------------
   */

  function getSelectedOptionNames(
    item: CartItem,
  ) {
    const product =
      productMap.get(
        item.productId,
      );

    if (!product) {
      return [];
    }

    const names: string[] = [];

    for (const group of getProductOptions(
      product,
    )) {
      for (const option of group.options) {
        if (
          item.optionIds.includes(
            option.id,
          )
        ) {
          names.push(option.name);
        }
      }
    }

    return names;
  }

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
      const items: CartLine[] =
        cart
          .filter(
            (item) =>
              item.quantity > 0,
          )
          .map((item) => ({
            productId:
              item.productId,
            quantity:
              item.quantity,
            optionIds:
              item.optionIds,
          }));

      const result =
        await createCashierSale({
          studentId:
            student.id,
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

      setCart([]);

      setAdminPassword("");

      setNeedsOverride(false);

      setKey(
        crypto.randomUUID(),
      );

      void loadDailySpending(
        student.id,
      );

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

  /*
   * ------------------------------------------------------------
   * RENDER
   * ------------------------------------------------------------
   */

  return (
    <main className="cashier">
      {/* ======================================================
          HEADER
      ====================================================== */}

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

      {/* ======================================================
          STUDENT SEARCH
      ====================================================== */}

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
                setQ(
                  event.target.value,
                )
              }
              onKeyDown={(event) => {
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

        {/* ==================================================
            NFC
        ================================================== */}

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
            card number will be entered
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

        {/* ==================================================
            SEARCH RESULTS
        ================================================== */}

        {results.length > 1 && (
          <div
            style={{
              marginTop: 12,
              display: "grid",
              gap: 8,
            }}
          >
            {results.map(
              (result) => (
                <button
                  type="button"
                  key={result.id}
                  className="product"
                  onClick={() =>
                    select(result)
                  }
                  style={{
                    textAlign:
                      "left",
                  }}
                >
                  {result.firstName}{" "}
                  {result.lastName}{" "}
                  —{" "}
                  {result.displayCode}
                </button>
              ),
            )}
          </div>
        )}
      </div>

      {/* ======================================================
          STUDENT + PRODUCTS
      ====================================================== */}

      {student && (
        <>
          {/* ==================================================
              STUDENT INFORMATION
          ================================================== */}

          <div className="panel">
            <strong>
              {student.firstName}{" "}
              {student.lastName}
            </strong>{" "}
            · {student.displayCode} ·
            Class{" "}
            {student.classCode}

            <br />

            <div
              style={{
                marginTop: 8,
                display: "grid",
                gap: 5,
              }}
            >
              {/* FAMILY WALLET */}

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

              {/* DAILY LIMIT */}

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
                        dailySpending
                          ?.dailyLimit ??
                          student.dailySpendLimit ??
                          0,
                      ).toFixed(2)}`}
                </strong>
              </div>

              {/* SPENT TODAY */}

              <div>
                <span className="subtle">
                  Spent today
                </span>{" "}
                <strong>
                  {loadingDailySpending
                    ? "Loading..."
                    : `$${Number(
                        dailySpending
                          ?.spentToday ??
                          0,
                      ).toFixed(2)}`}
                </strong>
              </div>

              {/* REMAINING */}

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
                        dailySpending
                          ?.remainingToday ??
                          0,
                      ).toFixed(2)}`}
                </strong>
              </div>
            </div>
          </div>

          {/* ==================================================
              PRODUCTS + CURRENT SALE
          ================================================== */}

          <section className="cashier-grid">
            {/* =================================================
                PRODUCTS
            ================================================= */}

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
                  (product) => {
                    const hasOptions =
                      productHasOptions(
                        product,
                      );

                    const quantity =
                      cart
                        .filter(
                          (item) =>
                            item.productId ===
                            product.id,
                        )
                        .reduce(
                          (
                            sum,
                            item,
                          ) =>
                            sum +
                            item.quantity,
                          0,
                        );

                    return (
                      <button
                        type="button"
                        className="product"
                        key={
                          product.id
                        }
                        onClick={() =>
                          handleProductClick(
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
                        {/* IMAGE */}

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

                        {/* NAME */}

                        <strong
                          style={{
                            fontSize: 15,
                            lineHeight:
                              1.2,
                          }}
                        >
                          {
                            product.name
                          }
                        </strong>

                        {/* PRICE */}

                        <span
                          style={{
                            fontWeight:
                              700,
                          }}
                        >
                          $
                          {Number(
                            product.price,
                          ).toFixed(
                            2,
                          )}
                        </span>

                        {/* OPTIONS LABEL */}

                        {hasOptions && (
                          <span
                            style={{
                              fontSize: 12,
                              fontWeight:
                                600,
                            }}
                          >
                            Options
                            available
                          </span>
                        )}

                        {/* QUANTITY */}

                        {quantity >
                        0 ? (
                          <span
                            style={{
                              fontSize: 13,
                              fontWeight:
                                700,
                            }}
                          >
                            ×{" "}
                            {
                              quantity
                            }
                          </span>
                        ) : null}
                      </button>
                    );
                  },
                )}
              </div>
            </div>

            {/* =================================================
                CURRENT SALE
            ================================================= */}

            <aside className="panel">
              <h2>
                Current Sale
              </h2>

              {cart.length ===
              0 ? (
                <p className="subtle">
                  No items selected.
                </p>
              ) : (
                cart.map(
                  (item) => {
                    const product =
                      productMap.get(
                        item.productId,
                      );

                    if (!product) {
                      return null;
                    }

                    const unitPrice =
                      getCartItemUnitPrice(
                        item,
                      );

                    const lineTotal =
                      unitPrice *
                      item.quantity;

                    const optionNames =
                      getSelectedOptionNames(
                        item,
                      );

                    return (
                      <div
                        key={
                          item.key
                        }
                        style={{
                          padding:
                            "10px 0",
                          borderBottom:
                            "1px solid #e5e7eb",
                        }}
                      >
                        <div
                          style={{
                            display:
                              "flex",
                            alignItems:
                              "center",
                            gap: 10,
                          }}
                        >
                          {/* SMALL IMAGE */}

                          <div
                            style={{
                              width: 42,
                              height: 42,
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

                          {/* NAME */}

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
                                item.quantity
                              }
                            </span>
                          </div>

                          {/* LINE PRICE */}

                          <strong>
                            $
                            {lineTotal.toFixed(
                              2,
                            )}
                          </strong>

                          {/* REMOVE */}

                          <button
                            type="button"
                            className="secondary"
                            onClick={() =>
                              removeCartItem(
                                item.key,
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

                        {/* SELECTED OPTIONS */}

                        {optionNames.length >
                          0 && (
                          <div
                            style={{
                              marginTop: 6,
                              marginLeft: 52,
                              fontSize: 12,
                              color:
                                "#6b7280",
                            }}
                          >
                            {optionNames.join(
                              ", ",
                            )}
                          </div>
                        )}

                        {/* UNIT PRICE */}

                        {optionNames.length >
                          0 && (
                          <div
                            style={{
                              marginTop: 4,
                              marginLeft: 52,
                              fontSize: 12,
                              color:
                                "#6b7280",
                            }}
                          >
                            $
                            {unitPrice.toFixed(
                              2,
                            )}{" "}
                            each
                          </div>
                        )}
                      </div>
                    );
                  },
                )
              )}

              <div className="divider" />

              {/* TOTAL */}

              <strong>
                Total: $
                {total.toFixed(2)}
              </strong>

              <br />

              {/* PROJECTED BALANCE */}

              <span>
                Projected balance: $
                {(
                  balance -
                  total
                ).toFixed(2)}
              </span>

              {/* DAILY SPENDING */}

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

                  <span
                    style={
                      dailySpending.remainingToday -
                        total <
                      0
                        ? {
                            color:
                              "#dc2626",
                            fontWeight:
                              700,
                          }
                        : undefined
                    }
                  >
                    Remaining after
                    sale: $
                    {(
                      dailySpending.remainingToday -
                      total
                    ).toFixed(2)}
                  </span>
                </>
              ) : null}

              <div
                style={{
                  height: 12,
                }}
              />

              {/* CONFIRM */}

              <button
                type="button"
                disabled={
                  busy ||
                  total <= 0
                }
                className="primary"
                style={{
                  width:
                    "100%",
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
                <p
                  className={
                    message
                      .toLowerCase()
                      .includes(
                        "completed",
                      )
                      ? undefined
                      : "alert"
                  }
                >
                  {message}
                </p>
              )}
            </aside>
          </section>
        </>
      )}

      {/* ======================================================
          PRODUCT OPTIONS MODAL
      ====================================================== */}

      {selectedProduct && (
        <div
          style={{
            position:
              "fixed",
            inset: 0,
            background:
              "rgba(0, 0, 0, 0.55)",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            zIndex: 9998,
            padding: 20,
          }}
        >
          <div
            style={{
              width:
                "100%",
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
                marginBottom: 6,
              }}
            >
              {
                selectedProduct.name
              }
            </h2>

            <div
              className="subtle"
              style={{
                marginBottom: 20,
              }}
            >
              Base price: $
              {Number(
                selectedProduct.price,
              ).toFixed(2)}
            </div>

            {getProductOptions(
              selectedProduct,
            ).map(
              (group) => {
                const selected =
                  selectedOptions[
                    group.id
                  ] ?? [];

                const min =
                  Math.max(
                    group.minSelections ??
                      0,
                    group.isRequired
                      ? 1
                      : 0,
                  );

                return (
                  <div
                    key={
                      group.id
                    }
                    style={{
                      marginBottom: 20,
                    }}
                  >
                    <div
                      style={{
                        marginBottom:
                          8,
                      }}
                    >
                      <strong>
                        {
                          group.name
                        }
                      </strong>

                      <div
                        className="subtle"
                        style={{
                          marginTop: 3,
                          fontSize: 12,
                        }}
                      >
                        {min >
                        0
                          ? `Choose at least ${min}`
                          : "Optional"}

                        {group.maxSelections >
                          0
                          ? ` · Maximum ${group.maxSelections}`
                          : ""}
                      </div>
                    </div>

                    <div
                      style={{
                        display:
                          "grid",
                        gap: 8,
                      }}
                    >
                      {group.options
                        .filter(
                          (
                            option,
                          ) =>
                            option.isActive,
                        )
                        .map(
                          (
                            option,
                          ) => {
                            const isSelected =
                              selected.includes(
                                option.id,
                              );

                            return (
                              <button
                                type="button"
                                key={
                                  option.id
                                }
                                onClick={() =>
                                  toggleOption(
                                    group,
                                    option.id,
                                  )
                                }
                                style={{
                                  display:
                                    "flex",
                                  alignItems:
                                    "center",
                                  justifyContent:
                                    "space-between",
                                  gap: 10,
                                  padding:
                                    "12px 14px",
                                  border:
                                    isSelected
                                      ? "2px solid #111827"
                                      : "1px solid #d1d5db",
                                  borderRadius:
                                    10,
                                  background:
                                    isSelected
                                      ? "#f3f4f6"
                                      : "white",
                                  cursor:
                                    "pointer",
                                  textAlign:
                                    "left",
                                }}
                              >
                                <span>
                                  <strong>
                                    {
                                      option.name
                                    }
                                  </strong>
                                </span>

                                <span
                                  style={{
                                    fontWeight:
                                      700,
                                  }}
                                >
                                  {optionPrice(
                                    option,
                                  ) >
                                  0
                                    ? `+$${optionPrice(
                                        option,
                                      ).toFixed(
                                        2,
                                      )}`
                                    : "Included"}
                                </span>
                              </button>
                            );
                          },
                        )}
                    </div>
                  </div>
                );
              },
            )}

            {/* MODAL ACTIONS */}

            <div
              style={{
                display:
                  "flex",
                gap: 10,
                marginTop: 10,
              }}
            >
              <button
                type="button"
                className="secondary"
                style={{
                  flex: 1,
                }}
                onClick={
                  closeProductOptions
                }
              >
                Cancel
              </button>

              <button
                type="button"
                className="primary"
                style={{
                  flex: 1,
                }}
                disabled={
                  !allRequiredOptionsSelected()
                }
                onClick={
                  confirmProductOptions
                }
              >
                Add to Sale
              </button>
            </div>

            {!allRequiredOptionsSelected() && (
              <p
                className="alert"
                style={{
                  marginBottom:
                    0,
                  marginTop: 12,
                }}
              >
                {optionValidationMessage()}
              </p>
            )}
          </div>
        </div>
      )}

      {/* ======================================================
          INSUFFICIENT BALANCE POPUP
      ====================================================== */}

      {showBalancePopup && (
        <div
          style={{
            position:
              "fixed",
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
              width:
                "100%",
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
                    marginBottom:
                      20,
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