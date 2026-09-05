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
  getRecentCashierSales,
} from "@/app/actions/sales";

import {
  getStudentDailySpending,
} from "@/app/actions/student-spending";

/* ============================================================
 * TYPES
 * ============================================================ */

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

type CartLine = {
  id: string;
  productId: string;
  quantity: number;
  optionIds: string[];
};

type SelectedOptions = Record<
  string,
  string[]
>;

type PrintLineOption = {
  groupName: string;
  optionName: string;
  additionalPrice: number;
};

type PrintLine = {
  name: string;
  quantity: number;
  unitPrice: number;
  options: PrintLineOption[];
};

type PrintLabel = {
  saleNumber: string;
  studentName: string;
  studentCode: string;
  total: number;
  createdAt: string;
  lines: PrintLine[];
};

type RecentSale =
  Awaited<
    ReturnType<
      typeof getRecentCashierSales
    >
  >[number];

/* ============================================================
 * COMPONENT
 * ============================================================ */

export default function CashierClient() {
  /* ==========================================================
   * STUDENT SEARCH
   * ========================================================== */

  const [q, setQ] =
    useState("");

  const [results, setResults] =
    useState<Student[]>([]);

  const [student, setStudent] =
    useState<Student | null>(null);

  /* ==========================================================
   * NFC
   * ========================================================== */

  const [nfc, setNfc] =
    useState("");

  const [
    nfcMessage,
    setNfcMessage,
  ] = useState("");

  const nfcInputRef =
    useRef<HTMLInputElement | null>(
      null,
    );

  /* ==========================================================
   * PRODUCTS
   * ========================================================== */

  const [products, setProducts] =
    useState<Product[]>([]);

  /* ==========================================================
   * CART
   * ========================================================== */

  const [cart, setCart] =
    useState<CartLine[]>([]);

  /* ==========================================================
   * PRODUCT OPTIONS
   * ========================================================== */

  const [
    selectedProduct,
    setSelectedProduct,
  ] = useState<Product | null>(
    null,
  );

  const [
    selectedOptions,
    setSelectedOptions,
  ] = useState<SelectedOptions>(
    {},
  );

  /* ==========================================================
   * SALE
   * ========================================================== */

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
    pendingPrint,
    setPendingPrint,
  ] = useState(false);

  const [
    printLabel,
    setPrintLabel,
  ] = useState<PrintLabel | null>(null);

  const [
    recentSales,
    setRecentSales,
  ] = useState<RecentSale[]>([]);

  const [
    loadingRecentSales,
    setLoadingRecentSales,
  ] = useState(false);

  const [
    selectedRecentSale,
    setSelectedRecentSale,
  ] = useState<RecentSale | null>(null);

  const [key, setKey] =
    useState(() =>
      crypto.randomUUID(),
    );

  /* ==========================================================
   * DAILY SPENDING
   * ========================================================== */

  const [
    dailySpending,
    setDailySpending,
  ] =
    useState<DailySpending | null>(
      null,
    );

  const [
    loadingDailySpending,
    setLoadingDailySpending,
  ] = useState(false);

  /* ==========================================================
   * NFC FOCUS
   * ========================================================== */

  function focusNfcInput() {
    window.setTimeout(() => {
      nfcInputRef.current?.focus();
      nfcInputRef.current?.select();
    }, 50);
  }

  /* ==========================================================
   * LAST SALES
   * ========================================================== */

  async function loadRecentSales() {
    setLoadingRecentSales(true);

    try {
      const latest =
        await getRecentCashierSales(5);

      setRecentSales(latest);
    } catch (error) {
      console.error(
        "Could not load recent sales",
        error,
      );
    } finally {
      setLoadingRecentSales(false);
    }
  }

  /* ==========================================================
   * LOAD PRODUCTS
   * ========================================================== */

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

    void loadRecentSales();

    focusNfcInput();
  }, []);

  /* ==========================================================
   * DAILY SPENDING
   * ========================================================== */

  async function loadDailySpending(
    studentId: string,
  ) {
    setLoadingDailySpending(
      true,
    );

    setDailySpending(null);

    try {
      const spending =
        await getStudentDailySpending(
          studentId,
        );

      setDailySpending(
        spending,
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Could not load daily spending",
      );
    } finally {
      setLoadingDailySpending(
        false,
      );
    }
  }

  /* ==========================================================
   * NORMAL STUDENT SEARCH
   * ========================================================== */

  async function search() {
    const value = q.trim();

    if (!value) {
      setResults([]);
      return;
    }

    setMessage("");
    setNfcMessage("");

    try {
      const found =
        await findCashierStudents(
          value,
        );

      setResults(found);

      if (
        found.length === 1
      ) {
        selectStudent(
          found[0],
        );
      }
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Search failed",
      );
    }
  }

  /* ==========================================================
   * NFC SEARCH
   * ========================================================== */

  async function searchNfc() {
    const value =
      nfc.trim();

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

      if (
        found.length === 0
      ) {
        setNfcMessage(
          "No active student is linked to this NFC card.",
        );

        setNfc("");

        focusNfcInput();

        return;
      }

      if (
        found.length === 1
      ) {
        selectStudent(
          found[0],
        );

        setNfc("");

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

  /* ==========================================================
   * SELECT STUDENT
   * ========================================================== */

  function selectStudent(
    selected: Student,
  ) {
    setStudent(selected);

    setResults([]);

    setQ(
      selected.displayCode,
    );

    setNfc("");

    setNfcMessage("");

    setCart([]);

    setSelectedProduct(null);

    setSelectedOptions({});

    setMessage("");

    setNeedsOverride(false);

    setAdminPassword("");

    setShowBalancePopup(false);

    setShowAdminApproval(false);

    void loadDailySpending(
      selected.id,
    );
  }

  /* ==========================================================
   * OPEN PRODUCT
   * ========================================================== */

  function openProduct(
    product: Product,
  ) {
    /*
     * Products are visible before
     * a student is selected, but
     * cannot be added.
     */

    if (!student) {
      return;
    }

    /*
     * No option groups:
     * add directly.
     */

    if (
      !product.optionGroups ||
      product.optionGroups
        .length === 0
    ) {
      addSimpleProduct(
        product,
      );

      return;
    }

    /*
     * Product with options.
     */

    const initial: SelectedOptions =
      {};

    for (const group of
      product.optionGroups) {
      initial[group.id] = [];
    }

    setSelectedOptions(
      initial,
    );

    setSelectedProduct(
      product,
    );

    setMessage("");
  }

  /* ==========================================================
   * SIMPLE PRODUCT
   * ========================================================== */

  function addSimpleProduct(
    product: Product,
  ) {
    if (!student) {
      return;
    }

    /*
     * If same simple product already
     * exists, increase quantity.
     */

    const existing =
      cart.find(
        (line) =>
          line.productId ===
            product.id &&
          line.optionIds.length ===
            0,
      );

    if (existing) {
      setCart((current) =>
        current.map((line) =>
          line.id ===
          existing.id
            ? {
                ...line,
                quantity:
                  line.quantity +
                  1,
              }
            : line,
        ),
      );

      return;
    }

    setCart((current) => [
      ...current,

      {
        id:
          crypto.randomUUID(),

        productId:
          product.id,

        quantity: 1,

        optionIds: [],
      },
    ]);
  }

  /* ==========================================================
   * OPTION TOGGLE
   * ========================================================== */

  function toggleOption(
    group:
      Product["optionGroups"][number],
    optionId: string,
  ) {
    setSelectedOptions(
      (current) => {
        const existing =
          current[group.id] ??
          [];

        /*
         * Single select.
         */

        if (
          group.maxSelections <=
          1
        ) {
          return {
            ...current,

            [group.id]: [
              optionId,
            ],
          };
        }

        /*
         * Multi select.
         */

        if (
          existing.includes(
            optionId,
          )
        ) {
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
         * Maximum already reached.
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
   * VALIDATE OPTIONS
   * ========================================================== */

  function validateSelectedOptions() {
    if (!selectedProduct) {
      return "Product not selected.";
    }

    for (const group of
      selectedProduct.optionGroups) {
      const chosen =
        selectedOptions[
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
        chosen.length <
        minimum
      ) {
        return `Please select ${
          minimum === 1
            ? "an option"
            : `${minimum} options`
        } for ${group.name}.`;
      }

      if (
        group.maxSelections >
          0 &&
        chosen.length >
          group.maxSelections
      ) {
        return `Maximum ${group.maxSelections} selection${
          group.maxSelections ===
          1
            ? ""
            : "s"
        } allowed for ${group.name}.`;
      }
    }

    return null;
  }

  /* ==========================================================
   * ADD CONFIGURED PRODUCT
   * ========================================================== */

  function addConfiguredProduct() {
    if (
      !student ||
      !selectedProduct
    ) {
      return;
    }

    const error =
      validateSelectedOptions();

    if (error) {
      setMessage(error);
      return;
    }

    const optionIds =
      selectedProduct.optionGroups.flatMap(
        (group) =>
          selectedOptions[
            group.id
          ] ?? [],
      );

    /*
     * Create a stable option
     * signature so same product +
     * same options can increase
     * quantity, while the same
     * product with different options
     * stays on a separate line.
     */

    const signature =
      [...optionIds]
        .sort()
        .join("|");

    const existing =
      cart.find((line) => {
        if (
          line.productId !==
          selectedProduct.id
        ) {
          return false;
        }

        return (
          [...line.optionIds]
            .sort()
            .join("|") ===
          signature
        );
      });

    if (existing) {
      setCart((current) =>
        current.map((line) =>
          line.id ===
          existing.id
            ? {
                ...line,

                quantity:
                  line.quantity +
                  1,
              }
            : line,
        ),
      );
    } else {
      setCart((current) => [
        ...current,

        {
          id:
            crypto.randomUUID(),

          productId:
            selectedProduct.id,

          quantity: 1,

          optionIds,
        },
      ]);
    }

    setSelectedProduct(null);

    setSelectedOptions({});

    setMessage("");
  }

  /* ==========================================================
   * CART QUANTITY
   * ========================================================== */

  function increaseLine(
    lineId: string,
  ) {
    if (!student) {
      return;
    }

    setCart((current) =>
      current.map((line) =>
        line.id === lineId
          ? {
              ...line,

              quantity:
                line.quantity +
                1,
            }
          : line,
      ),
    );
  }

  function decreaseLine(
    lineId: string,
  ) {
    setCart((current) =>
      current
        .map((line) =>
          line.id === lineId
            ? {
                ...line,

                quantity:
                  line.quantity -
                  1,
              }
            : line,
        )
        .filter(
          (line) =>
            line.quantity > 0,
        ),
    );
  }

  function removeLine(
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
   * PRODUCT LOOKUP
   * ========================================================== */

  function getProduct(
    productId: string,
  ) {
    return products.find(
      (product) =>
        product.id ===
        productId,
    );
  }

  /* ==========================================================
   * OPTIONS PRICE
   * ========================================================== */

  function getOptionPrice(
    line: CartLine,
  ) {
    const product =
      getProduct(
        line.productId,
      );

    if (!product) {
      return 0;
    }

    let amount = 0;

    for (const group of
      product.optionGroups ??
      []) {
      for (const option of
        group.options) {
        if (
          line.optionIds.includes(
            option.id,
          )
        ) {
          amount += Number(
            option.additionalPrice,
          );
        }
      }
    }

    return amount;
  }

  /* ==========================================================
   * UNIT PRICE
   * ========================================================== */

  function getUnitPrice(
    line: CartLine,
  ) {
    const product =
      getProduct(
        line.productId,
      );

    if (!product) {
      return 0;
    }

    return (
      Number(
        product.price,
      ) +
      getOptionPrice(line)
    );
  }

  /* ==========================================================
   * CART TOTAL
   * ========================================================== */

  const total =
    useMemo(() => {
      return cart.reduce(
        (sum, line) =>
          sum +
          getUnitPrice(line) *
            line.quantity,
        0,
      );
    }, [
      cart,
      products,
    ]);

  /* ==========================================================
   * BALANCE
   * ========================================================== */

  const balance =
    student?.parent.wallet
      ? Number(
          student.parent.wallet
            .balance,
        )
      : 0;

  /* ==========================================================
   * PRODUCT MODAL PRICE
   * ========================================================== */

  const selectedProductPrice =
    useMemo(() => {
      if (!selectedProduct) {
        return 0;
      }

      let optionsTotal = 0;

      for (const group of
        selectedProduct.optionGroups) {
        const chosen =
          selectedOptions[
            group.id
          ] ?? [];

        for (const option of
          group.options) {
          if (
            chosen.includes(
              option.id,
            )
          ) {
            optionsTotal +=
              Number(
                option.additionalPrice,
              );
          }
        }
      }

      return (
        Number(
          selectedProduct.price,
        ) +
        optionsTotal
      );
    }, [
      selectedProduct,
      selectedOptions,
    ]);

  /* ==========================================================
   * CONFIRM SALE
   * ========================================================== */

  function resetForNextStudent() {
    setStudent(null);
    setDailySpending(null);
    setQ("");
    setNfc("");
    setNfcMessage("");
    setMessage("");
    setCart([]);
    setSelectedProduct(null);
    setSelectedOptions({});
    setAdminPassword("");
    setNeedsOverride(false);
    setPendingPrint(false);
    setShowBalancePopup(false);
    setShowAdminApproval(false);

    window.setTimeout(() => {
      focusNfcInput();
    }, 50);
  }

  function buildPrintLines(): PrintLine[] {
    return cart
      .map((line) => {
        const product = getProduct(line.productId);

        if (!product) {
          return null;
        }

        const options: PrintLineOption[] =
          product.optionGroups.flatMap((group) =>
            group.options
              .filter((option) =>
                line.optionIds.includes(option.id),
              )
              .map((option) => ({
                groupName: group.name,
                optionName: option.name,
                additionalPrice: Number(
                  option.additionalPrice,
                ),
              })),
          );

        return {
          name: product.name,
          quantity: line.quantity,
          unitPrice: getUnitPrice(line),
          options,
        };
      })
      .filter(
        (line): line is PrintLine => line !== null,
      );
  }

  async function confirm(printAfterSale = false) {
    if (
      !student ||
      total <= 0 ||
      cart.length === 0 ||
      busy
    ) {
      return;
    }

    setPendingPrint(printAfterSale);
    setBusy(true);
    setMessage("");

    const printLines = buildPrintLines();

    try {
      const items = cart.map((line) => ({
        productId: line.productId,
        quantity: line.quantity,
        optionIds: line.optionIds,
      }));

      const result = await createCashierSale({
        studentId: student.id,
        items,
        idempotencyKey: key,
        adminPassword: adminPassword || undefined,
      });

      if (!result.ok) {
        if (result.needsAdminOverride === true) {
          setNeedsOverride(true);
          setPendingPrint(printAfterSale);
          setShowBalancePopup(true);
          setShowAdminApproval(false);
          return;
        }

        setMessage(result.error || "Sale failed");
        void loadDailySpending(student.id);
        return;
      }

      setShowBalancePopup(false);
      setShowAdminApproval(false);
      setNeedsOverride(false);
      setMessage(
        `Sale ${result.saleNumber} completed. New balance: $${result.balanceAfter}`,
      );
      setKey(crypto.randomUUID());
      void loadDailySpending(student.id);
      void loadRecentSales();

      if (printAfterSale) {
        setPrintLabel({
          saleNumber: String(result.saleNumber),
          studentName: `${student.firstName} ${student.lastName}`,
          studentCode: student.displayCode,
          total,
          createdAt: new Date().toLocaleString(),
          lines: printLines,
        });

        window.setTimeout(() => {
          window.print();
          setPrintLabel(null);
          resetForNextStudent();
        }, 250);
      } else {
        setCart([]);
        setAdminPassword("");
        setPendingPrint(false);

        window.setTimeout(() => {
          resetForNextStudent();
        }, 1800);
      }
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

  /* ==========================================================
   * REPRINT RECENT SALE
   * ========================================================== */

  function printRecentSale(
    sale: RecentSale,
  ) {
    const lines: PrintLine[] =
      sale.items.map((item) => ({
        name: item.productName,
        quantity: item.quantity,
        unitPrice: Number(
          item.unitPrice,
        ),
        options: item.options.map(
          (option) => ({
            groupName: "Option",
            optionName:
              option.optionName,
            additionalPrice:
              Number(
                option.additionalPrice,
              ),
          }),
        ),
      }));

    setPrintLabel({
      saleNumber:
        sale.saleNumber,
      studentName:
        `${sale.student.firstName} ${sale.student.lastName}`,
      studentCode:
        sale.student.displayCode,
      total: Number(sale.total),
      createdAt:
        new Date(
          sale.createdAt,
        ).toLocaleString(),
      lines,
    });

    window.setTimeout(() => {
      window.print();

      window.setTimeout(() => {
        setPrintLabel(null);
      }, 100);
    }, 250);
  }

  /* ==========================================================
   * BALANCE POPUP
   * ========================================================== */

  function closeBalancePopup() {
    setShowBalancePopup(
      false,
    );

    setShowAdminApproval(
      false,
    );

    setAdminPassword("");
    setPendingPrint(false);
  }

  function askAdmin() {
    setShowAdminApproval(
      true,
    );
  }

  async function approveNegativeSale() {
    if (
      !adminPassword.trim()
    ) {
      return;
    }

    await confirm(pendingPrint);
  }

  /* ============================================================
   * RENDER
   * ============================================================ */

  return (
    <>
      <style>{`
        .print-label {
          display: none;
        }

        @media print {
          @page {
            size: 80mm auto;
            margin: 0;
          }

          html,
          body {
            width: 80mm !important;
            min-width: 80mm !important;
            margin: 0 !important;
            padding: 0 !important;
            background: white !important;
          }

          body * {
            visibility: hidden !important;
          }

          .print-label,
          .print-label * {
            visibility: visible !important;
          }

          .print-label {
            display: block !important;
            position: static !important;
            width: 80mm !important;
            max-width: 80mm !important;
            min-width: 80mm !important;
            box-sizing: border-box !important;
            margin: 0 !important;
            padding: 3mm 4mm !important;
            background: white !important;
            color: black !important;
            font-family: Arial, sans-serif !important;
            font-size: 12px !important;
            line-height: 1.25 !important;
          }
        }
      `}</style>

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
            href="/staff/attendance"
          >
            Staff Attendance
          </a>

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
          STUDENT SEARCH + NFC
      ====================================================== */}

      <div
        className="panel"
        style={{
          marginBottom: 18,
        }}
      >
        {/* NORMAL SEARCH */}

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
              onChange={(
                event,
              ) =>
                setQ(
                  event.target.value,
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
              ref={
                nfcInputRef
              }
              className="input"
              value={nfc}
              onChange={(
                event,
              ) => {
                setNfc(
                  event.target.value,
                );

                setNfcMessage(
                  "",
                );
              }}
              onKeyDown={(
                event,
              ) => {
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
            Tap the student's NFC card
            on the reader. The student
            will be selected
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

        {/* SEARCH RESULTS */}

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
                  key={
                    result.id
                  }
                  className="product"
                  onClick={() =>
                    selectStudent(
                      result,
                    )
                  }
                >
                  {
                    result.firstName
                  }{" "}
                  {
                    result.lastName
                  }{" "}
                  ÔÇö{" "}
                  {
                    result.displayCode
                  }
                </button>
              ),
            )}
          </div>
        )}
      </div>

      {/* ======================================================
          SELECTED STUDENT
      ====================================================== */}

      {student && (
        <div
          className="panel"
          style={{
            marginBottom: 18,
          }}
        >
          <div
            style={{
              display: "flex",
              justifyContent:
                "space-between",
              gap: 16,
              flexWrap: "wrap",
            }}
          >
            <div>
              <strong
                style={{
                  fontSize: 18,
                }}
              >
                {
                  student.firstName
                }{" "}
                {
                  student.lastName
                }
              </strong>

              <div className="subtle compact">
                {
                  student.displayCode
                }{" "}
                ┬À Class{" "}
                {
                  student.classCode
                }
              </div>
            </div>

            <div>
              <span className="subtle">
                Family wallet
              </span>

              <br />

              <strong>
                $
                {balance.toFixed(
                  2,
                )}
              </strong>
            </div>
          </div>

          <div
            style={{
              marginTop: 12,
              display: "grid",
              gap: 5,
            }}
          >
            <div>
              <span className="subtle">
                Daily spending limit
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
                      ).toFixed(
                        2,
                      )}`}
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
                      dailySpending
                        ?.spentToday ??
                        0,
                    ).toFixed(
                      2,
                    )}`}
              </strong>
            </div>

            <div>
              <span
                className="subtle"
                style={
                  !loadingDailySpending &&
                  dailySpending
                    ?.remainingToday !==
                    null &&
                  Number(
                    dailySpending
                      ?.remainingToday ??
                      0,
                  ) < 5
                    ? {
                        color:
                          "#dc2626",
                        fontWeight:
                          700,
                      }
                    : undefined
                }
              >
                Remaining today
              </span>{" "}

              <strong
                style={
                  !loadingDailySpending &&
                  dailySpending
                    ?.remainingToday !==
                    null &&
                  Number(
                    dailySpending
                      ?.remainingToday ??
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
                      ).toFixed(
                        2,
                      )}`}
              </strong>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          PRODUCTS + CURRENT SALE
          ALWAYS VISIBLE
      ====================================================== */}

      <section className="cashier-grid">
        {/* PRODUCTS */}

        <div className="panel">
          <h2>Products</h2>

          {!student && (
            <p
              className="subtle"
              style={{
                marginBottom: 14,
              }}
            >
              Select a student before
              adding products.
            </p>
          )}

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
                  key={
                    product.id
                  }
                  disabled={
                    !student
                  }
                  onClick={() =>
                    openProduct(
                      product,
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

                    textAlign:
                      "center",

                    overflow:
                      "hidden",

                    /*
                     * Visible at all times,
                     * disabled until student.
                     */
                    opacity:
                      student
                        ? 1
                        : 0.48,

                    cursor:
                      student
                        ? "pointer"
                        : "not-allowed",
                  }}
                >
                  {/* IMAGE */}

                  <div
                    style={{
                      width: "100%",
                      height: 120,
                      borderRadius: 10,
                      overflow:
                        "hidden",
                      background:
                        "#f3f4f6",
                      display: "flex",
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
                          fontSize:
                            12,
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
                      lineHeight: 1.2,
                    }}
                  >
                    {product.name}
                  </strong>

                  {/* PRICE */}

                  <span
                    style={{
                      fontWeight: 700,
                    }}
                  >
                    $
                    {Number(
                      product.price,
                    ).toFixed(
                      2,
                    )}
                  </span>

                  {/* OPTIONS INDICATOR */}

                  {product
                    .optionGroups
                    ?.length >
                    0 && (
                    <span
                      className="subtle"
                      style={{
                        fontSize: 12,
                      }}
                    >
                      Options
                    </span>
                  )}
                </button>
              ),
            )}
          </div>
        </div>

        {/* ====================================================
            CURRENT SALE
        ==================================================== */}

        <aside className="panel">
          <h2>
            Current Sale
          </h2>

          {!student ? (
            <p className="subtle">
              Select a student to start
              a sale.
            </p>
          ) : cart.length ===
            0 ? (
            <p className="subtle">
              No products added yet.
            </p>
          ) : (
            <div>
              {cart.map(
                (line) => {
                  const product =
                    getProduct(
                      line.productId,
                    );

                  if (!product) {
                    return null;
                  }

                  const unitPrice =
                    getUnitPrice(
                      line,
                    );

                  return (
                    <div
                      key={
                        line.id
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
                            "flex-start",
                          gap: 10,
                        }}
                      >
                        {/* THUMBNAIL */}

                        <div
                          style={{
                            width: 42,
                            height: 42,
                            borderRadius:
                              8,
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
                              }}
                            />
                          ) : (
                            <span className="subtle">
                              ÔÇö
                            </span>
                          )}
                        </div>

                        {/* DETAILS */}

                        <div
                          style={{
                            flex: 1,
                            minWidth: 0,
                          }}
                        >
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
                            ├ù{" "}
                            {
                              line.quantity
                            }
                          </div>

                          {/* OPTIONS */}

                          {product.optionGroups.map(
                            (
                              group,
                            ) =>
                              group.options
                                .filter(
                                  (
                                    option,
                                  ) =>
                                    line.optionIds.includes(
                                      option.id,
                                    ),
                                )
                                .map(
                                  (
                                    option,
                                  ) => (
                                    <div
                                      key={
                                        option.id
                                      }
                                      className="subtle compact"
                                      style={{
                                        fontSize:
                                          12,
                                      }}
                                    >
                                      {
                                        group.name
                                      }
                                      :{" "}
                                      {
                                        option.name
                                      }

                                      {Number(
                                        option.additionalPrice,
                                      ) >
                                        0 &&
                                        ` (+$${Number(
                                          option.additionalPrice,
                                        ).toFixed(
                                          2,
                                        )})`}
                                    </div>
                                  ),
                                ),
                          )}
                        </div>

                        {/* LINE TOTAL */}

                        <strong>
                          $
                          {(
                            unitPrice *
                            line.quantity
                          ).toFixed(
                            2,
                          )}
                        </strong>
                      </div>

                      {/* QUANTITY */}

                      <div
                        style={{
                          display:
                            "flex",
                          gap: 8,
                          alignItems:
                            "center",
                          marginTop:
                            8,
                        }}
                      >
                        <button
                          type="button"
                          className="secondary"
                          onClick={() =>
                            decreaseLine(
                              line.id,
                            )
                          }
                          style={{
                            width: 34,
                            height: 34,
                            padding: 0,
                          }}
                        >
                          ÔêÆ
                        </button>

                        <strong>
                          {
                            line.quantity
                          }
                        </strong>

                        <button
                          type="button"
                          className="secondary"
                          onClick={() =>
                            increaseLine(
                              line.id,
                            )
                          }
                          style={{
                            width: 34,
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
                            removeLine(
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
                },
              )}
            </div>
          )}

          <div className="divider" />

          <strong
            style={{
              fontSize: 18,
            }}
          >
            Total: $
            {total.toFixed(2)}
          </strong>

          {student && (
            <>
              <br />

              <span>
                Projected balance: $
                {(
                  balance -
                  total
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
                    Remaining after sale:
                    ${" "}
                    {Math.max(
                      0,
                      dailySpending.remainingToday -
                        total,
                    ).toFixed(2)}
                  </span>
                </>
              ) : null}
            </>
          )}

          <div
            style={{
              height: 14,
            }}
          />

          <button
            type="button"
            disabled={
              !student ||
              busy ||
              total <= 0 ||
              cart.length === 0
            }
            className="primary"
            style={{
              width: "100%",
              minHeight: 48,
              fontWeight: 700,
            }}
            onClick={() => void confirm(true)}
          >
            {busy ? "ProcessingÔÇª" : "Confirm & Print"}
          </button>

          <button
            type="button"
            disabled={
              !student ||
              busy ||
              total <= 0 ||
              cart.length === 0
            }
            className="secondary"
            style={{
              width: "100%",
              marginTop: 8,
              minHeight: 34,
              fontSize: 13,
            }}
            onClick={() => void confirm(false)}
          >
            Confirm Sale
          </button>

          {message &&
            !selectedProduct && (
              <p
                className={
                  message.startsWith(
                    "Sale ",
                  )
                    ? "success"
                    : "alert"
                }
                style={{
                  marginTop: 12,
                }}
              >
                {message}
              </p>
            )}

          <div
            style={{
              marginTop: 18,
              paddingTop: 16,
              borderTop:
                "1px solid #e5e7eb",
            }}
          >
            <div
              style={{
                display: "flex",
                alignItems: "center",
                justifyContent:
                  "space-between",
                gap: 10,
                marginBottom: 10,
              }}
            >
              <h3
                style={{
                  margin: 0,
                  fontSize: 16,
                }}
              >
                Last Sales
              </h3>

              <button
                type="button"
                className="secondary"
                onClick={() =>
                  void loadRecentSales()
                }
                disabled={
                  loadingRecentSales
                }
                style={{
                  minHeight: 30,
                  padding: "4px 9px",
                  fontSize: 12,
                }}
              >
                {loadingRecentSales
                  ? "LoadingÔÇª"
                  : "Refresh"}
              </button>
            </div>

            {loadingRecentSales &&
            recentSales.length === 0 ? (
              <p className="subtle compact">
                Loading last salesÔÇª
              </p>
            ) : recentSales.length ===
              0 ? (
              <p className="subtle compact">
                No recent sales yet.
              </p>
            ) : (
              <div
                style={{
                  display: "grid",
                  gap: 7,
                }}
              >
                {recentSales.map(
                  (sale) => (
                    <button
                      type="button"
                      key={sale.id}
                      className="secondary"
                      onClick={() =>
                        setSelectedRecentSale(
                          sale,
                        )
                      }
                      style={{
                        width: "100%",
                        padding:
                          "9px 10px",
                        textAlign: "left",
                        display: "grid",
                        gridTemplateColumns:
                          "1fr auto",
                        gap: "3px 10px",
                        alignItems:
                          "center",
                      }}
                    >
                      <strong
                        style={{
                          minWidth: 0,
                          overflow:
                            "hidden",
                          textOverflow:
                            "ellipsis",
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {
                          sale.student
                            .firstName
                        }{" "}
                        {
                          sale.student
                            .lastName
                        }
                      </strong>

                      <strong>
                        $
                        {Number(
                          sale.total,
                        ).toFixed(2)}
                      </strong>

                      <span className="subtle compact">
                        #
                        {sale.saleNumber.slice(
                          -6,
                        )}{" "}
                        ┬À{" "}
                        {new Date(
                          sale.createdAt,
                        ).toLocaleTimeString(
                          [],
                          {
                            hour:
                              "2-digit",
                            minute:
                              "2-digit",
                          },
                        )}
                      </span>

                      <span className="subtle compact">
                        View details
                      </span>
                    </button>
                  ),
                )}
              </div>
            )}
          </div>
        </aside>
      </section>

      {/* ======================================================
          LAST SALE DETAILS MODAL
      ====================================================== */}

      {selectedRecentSale && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() =>
            setSelectedRecentSale(null)
          }
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9997,
            background:
              "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            padding: 18,
          }}
        >
          <div
            onClick={(event) =>
              event.stopPropagation()
            }
            style={{
              width: "100%",
              maxWidth: 540,
              maxHeight:
                "calc(100vh - 36px)",
              overflowY: "auto",
              background: "white",
              borderRadius: 18,
              padding: 22,
              boxShadow:
                "0 24px 80px rgba(0,0,0,0.35)",
            }}
          >
            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "flex-start",
                gap: 14,
                marginBottom: 16,
              }}
            >
              <div>
                <h2
                  style={{
                    margin: 0,
                  }}
                >
                  Sale Details
                </h2>

                <p
                  className="subtle"
                  style={{
                    margin:
                      "6px 0 0",
                  }}
                >
                  {
                    selectedRecentSale
                      .saleNumber
                  }
                </p>
              </div>

              <button
                type="button"
                className="secondary"
                onClick={() =>
                  setSelectedRecentSale(
                    null,
                  )
                }
                style={{
                  width: 40,
                  height: 40,
                  padding: 0,
                  fontSize: 20,
                }}
              >
                ├ù
              </button>
            </div>

            <div
              style={{
                background: "#f9fafb",
                borderRadius: 12,
                padding: 14,
                marginBottom: 16,
              }}
            >
              <strong>
                {
                  selectedRecentSale
                    .student.firstName
                }{" "}
                {
                  selectedRecentSale
                    .student.lastName
                }
              </strong>

              <div className="subtle compact">
                {
                  selectedRecentSale
                    .student.displayCode
                }
              </div>

              <div
                className="subtle compact"
                style={{
                  marginTop: 5,
                }}
              >
                {new Date(
                  selectedRecentSale
                    .createdAt,
                ).toLocaleString()}
              </div>
            </div>

            <div>
              {selectedRecentSale.items.map(
                (item, itemIndex) => (
                  <div
                    key={`${selectedRecentSale.id}-${itemIndex}`}
                    style={{
                      padding:
                        "11px 0",
                      borderBottom:
                        "1px solid #e5e7eb",
                    }}
                  >
                    <div
                      style={{
                        display: "flex",
                        justifyContent:
                          "space-between",
                        gap: 12,
                      }}
                    >
                      <div>
                        <strong>
                          {
                            item.productName
                          }
                        </strong>

                        <div className="subtle compact">
                          $
                          {Number(
                            item.unitPrice,
                          ).toFixed(2)}{" "}
                          ├ù{" "}
                          {item.quantity}
                        </div>
                      </div>

                      <strong>
                        $
                        {Number(
                          item.lineTotal,
                        ).toFixed(2)}
                      </strong>
                    </div>

                    {item.options.map(
                      (
                        option,
                        optionIndex,
                      ) => (
                        <div
                          key={`${selectedRecentSale.id}-${itemIndex}-${optionIndex}`}
                          className="subtle compact"
                          style={{
                            marginTop: 4,
                            fontSize: 12,
                          }}
                        >
                          +{" "}
                          {
                            option.optionName
                          }
                          {Number(
                            option.additionalPrice,
                          ) > 0
                            ? ` (+$${Number(
                                option.additionalPrice,
                              ).toFixed(
                                2,
                              )})`
                            : ""}
                        </div>
                      ),
                    )}
                  </div>
                ),
              )}
            </div>

            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems: "center",
                marginTop: 16,
                fontSize: 20,
              }}
            >
              <strong>Total</strong>
              <strong>
                $
                {Number(
                  selectedRecentSale.total,
                ).toFixed(2)}
              </strong>
            </div>

            <div
              style={{
                display: "flex",
                gap: 10,
                marginTop: 18,
              }}
            >
              <button
                type="button"
                className="secondary"
                onClick={() =>
                  printRecentSale(
                    selectedRecentSale,
                  )
                }
                style={{
                  flex: 1,
                }}
              >
                Print
              </button>

              <button
                type="button"
                className="primary"
                onClick={() =>
                  setSelectedRecentSale(
                    null,
                  )
                }
                style={{
                  flex: 1,
                }}
              >
                Close
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          PRODUCT OPTIONS MODAL
      ====================================================== */}

      {selectedProduct && (
        <div
          role="dialog"
          aria-modal="true"
          onClick={() => {
            setSelectedProduct(
              null,
            );

            setSelectedOptions(
              {},
            );

            setMessage("");
          }}
          style={{
            position: "fixed",
            inset: 0,
            zIndex: 9998,
            background:
              "rgba(0,0,0,0.55)",
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "center",
            padding: 18,
          }}
        >
          <div
            onClick={(
              event,
            ) =>
              event.stopPropagation()
            }
            style={{
              width: "100%",
              maxWidth: 650,
              maxHeight:
                "calc(100vh - 36px)",
              overflowY:
                "auto",
              background:
                "white",
              borderRadius: 18,
              padding: 22,
              boxShadow:
                "0 24px 80px rgba(0,0,0,0.35)",
            }}
          >
            {/* HEADER */}

            <div
              style={{
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "flex-start",
                gap: 16,
                marginBottom:
                  18,
              }}
            >
              <div>
                <h2
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
                  {Number(
                    selectedProduct.price,
                  ).toFixed(
                    2,
                  )}
                </p>
              </div>

              <button
                type="button"
                className="secondary"
                onClick={() => {
                  setSelectedProduct(
                    null,
                  );

                  setSelectedOptions(
                    {},
                  );

                  setMessage("");
                }}
                style={{
                  width: 40,
                  height: 40,
                  padding: 0,
                  fontSize: 20,
                }}
              >
                ├ù
              </button>
            </div>

            {/* OPTION GROUPS */}

            {selectedProduct.optionGroups.map(
              (group) => {
                const chosen =
                  selectedOptions[
                    group.id
                  ] ?? [];

                const minimum =
                  Math.max(
                    group.minSelections,
                    group.isRequired
                      ? 1
                      : 0,
                  );

                const single =
                  group.maxSelections <=
                  1;

                return (
                  <section
                    key={
                      group.id
                    }
                    style={{
                      marginBottom:
                        18,
                      padding: 15,
                      border:
                        "1px solid #e5e7eb",
                      borderRadius:
                        14,
                      background:
                        "#fafafa",
                    }}
                  >
                    <div
                      style={{
                        display:
                          "flex",
                        justifyContent:
                          "space-between",
                        gap: 12,
                        marginBottom:
                          10,
                      }}
                    >
                      <div>
                        <strong
                          style={{
                            fontSize:
                              17,
                          }}
                        >
                          {
                            group.name
                          }
                        </strong>

                        <div className="subtle compact">
                          {single
                            ? minimum >
                              0
                              ? "Choose 1"
                              : "Optional"
                            : group.maxSelections >
                                0
                              ? `Choose up to ${group.maxSelections}`
                              : "Multiple selections allowed"}
                        </div>
                      </div>

                      {minimum >
                        0 && (
                        <span className="badge">
                          Required
                        </span>
                      )}
                    </div>

                    <div
                      style={{
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
                            chosen.includes(
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
                                borderRadius:
                                  11,
                                background:
                                  checked
                                    ? "#f3f4f6"
                                    : "white",
                                cursor:
                                  "pointer",
                              }}
                            >
                              <input
                                type={
                                  single
                                    ? "radio"
                                    : "checkbox"
                                }
                                name={
                                  single
                                    ? `cashier-option-${group.id}`
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
                                }}
                              >
                                {
                                  option.name
                                }
                              </span>

                              {Number(
                                option.additionalPrice,
                              ) >
                              0 ? (
                                <strong>
                                  +$
                                  {Number(
                                    option.additionalPrice,
                                  ).toFixed(
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

            {message && (
              <p className="alert">
                {message}
              </p>
            )}

            {/* MODAL FOOTER */}

            <div
              style={{
                borderTop:
                  "1px solid #e5e7eb",
                paddingTop: 14,
                display: "flex",
                justifyContent:
                  "space-between",
                alignItems:
                  "center",
                gap: 12,
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
                  {selectedProductPrice.toFixed(
                    2,
                  )}
                </strong>
              </div>

              <div
                style={{
                  display: "flex",
                  gap: 8,
                }}
              >
                <button
                  type="button"
                  className="secondary"
                  onClick={() => {
                    setSelectedProduct(
                      null,
                    );

                    setSelectedOptions(
                      {},
                    );

                    setMessage("");
                  }}
                >
                  Cancel
                </button>

                <button
                  type="button"
                  className="primary"
                  onClick={
                    addConfiguredProduct
                  }
                >
                  Add to Sale
                </button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ======================================================
          PRINT LABEL
      ====================================================== */}

      {printLabel && (
        <section className="print-label">
          <div
            style={{
              textAlign: "center",
              fontWeight: 800,
              fontSize: 17,
              marginBottom: 8,
            }}
          >
            CanteenCo
          </div>

          <div
            style={{
              textAlign: "center",
              marginBottom: 10,
            }}
          >
            Order #{printLabel.saleNumber}
          </div>

          <div>
            <strong>Student:</strong>{" "}
            {printLabel.studentName}
          </div>

          <div>
            <strong>Code:</strong>{" "}
            {printLabel.studentCode}
          </div>

          <div style={{ marginBottom: 10 }}>
            <strong>Time:</strong>{" "}
            {printLabel.createdAt}
          </div>

          <div
            style={{
              borderTop: "1px dashed #000",
              paddingTop: 8,
            }}
          >
            {printLabel.lines.map((line, index) => (
              <div
                key={`${line.name}-${index}`}
                style={{ marginBottom: 9 }}
              >
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    gap: 8,
                    fontWeight: 700,
                  }}
                >
                  <span>
                    {line.quantity} ├ù {line.name}
                  </span>
                  <span>
                    ${(line.unitPrice * line.quantity).toFixed(2)}
                  </span>
                </div>

                {line.options.map((option, optionIndex) => (
                  <div
                    key={`${option.groupName}-${option.optionName}-${optionIndex}`}
                    style={{
                      paddingLeft: 10,
                      fontSize: 11,
                    }}
                  >
                    {option.groupName}: {option.optionName}
                    {option.additionalPrice > 0 &&
                      ` (+$${option.additionalPrice.toFixed(2)})`}
                  </div>
                ))}
              </div>
            ))}
          </div>

          <div
            style={{
              borderTop: "1px dashed #000",
              paddingTop: 8,
              marginTop: 4,
              display: "flex",
              justifyContent: "space-between",
              fontWeight: 800,
              fontSize: 14,
            }}
          >
            <span>Total</span>
            <span>${printLabel.total.toFixed(2)}</span>
          </div>
        </section>
      )}

      {/* ======================================================
          INSUFFICIENT BALANCE POPUP
      ====================================================== */}

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
                  Insufficient Balance
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
                    borderRadius:
                      10,
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
                    Balance after sale:{" "}
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
                      ? "ProcessingÔÇª"
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
    </>
  );
}
