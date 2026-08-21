"use client";

import { useEffect, useMemo, useState } from "react";
import { signOut } from "next-auth/react";

import {
  createCashierSale,
  findCashierStudents,
  getCashierProducts,
} from "@/app/actions/sales";

type Student = Awaited<ReturnType<typeof findCashierStudents>>[number];

type Product = Awaited<ReturnType<typeof getCashierProducts>>[number];

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
        error instanceof Error ? error.message : "Search failed",
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
  }

  function addProduct(productId: string) {
    setCart((current) => ({
      ...current,
      [productId]: (current[productId] ?? 0) + 1,
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
          Number(product.price) * (cart[product.id] ?? 0),
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
        adminPassword: adminPassword || undefined,
      });

      if (!result.ok) {
        setNeedsOverride(result.needsAdminOverride === true);
        setMessage(result.error || "Sale failed");
        return;
      }

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
        error instanceof Error ? error.message : "Sale failed",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="cashier">
      <div className="page-heading">
        <div>
          <h1 className="brand">CanteenCo Cashier</h1>
        </div>

        <div className="actions-row">
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
          Scan QR, enter student code, or search name

          <div
            style={{
              display: "flex",
              gap: 8,
            }}
          >
            <input
              className="input"
              value={q}
              onChange={(event) => setQ(event.target.value)}
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
                onClick={() => select(result)}
              >
                {result.firstName} {result.lastName} —{" "}
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
              {student.firstName} {student.lastName}
            </strong>{" "}
            · {student.displayCode} · Class {student.classCode}
            <br />

            <span className="subtle">Family wallet</span>{" "}
            <strong>${balance.toFixed(2)}</strong>

            {balance <= 0 && (
              <p>
                <strong>
                  Insufficient/negative balance — admin approval
                  will be required if school policy allows.
                </strong>
              </p>
            )}
          </div>

          <section className="cashier-grid">
            <div className="panel">
              <h2>Products</h2>

              <div className="products">
                {products.map((product) => (
                  <button
                    type="button"
                    className="product"
                    key={product.id}
                    onClick={() => addProduct(product.id)}
                  >
                    <strong>{product.name}</strong>
                    <br />
                    ${Number(product.price).toFixed(2)}

                    {cart[product.id]
                      ? ` × ${cart[product.id]}`
                      : ""}
                  </button>
                ))}
              </div>
            </div>

            <aside className="panel">
              <h2>Current Sale</h2>

              {products
                .filter(
                  (product) =>
                    (cart[product.id] ?? 0) > 0,
                )
                .map((product) => (
                  <div key={product.id}>
                    {product.name} × {cart[product.id]}

                    <button
                      type="button"
                      onClick={() =>
                        removeProduct(product.id)
                      }
                    >
                      −
                    </button>
                  </div>
                ))}

              <div className="divider" />

              <strong>Total: ${total.toFixed(2)}</strong>

              <br />

              <span>
                Projected balance: $
                {(balance - total).toFixed(2)}
              </span>

              {needsOverride && (
                <label className="label">
                  Admin password

                  <input
                    className="input"
                    type="password"
                    value={adminPassword}
                    onChange={(event) =>
                      setAdminPassword(event.target.value)
                    }
                  />
                </label>
              )}

              <div style={{ height: 12 }} />

              <button
                type="button"
                disabled={busy || total <= 0}
                className="primary"
                style={{ width: "100%" }}
                onClick={() => void confirm()}
              >
                {busy
                  ? "Processing…"
                  : needsOverride
                    ? "Approve & Complete Sale"
                    : "Confirm Sale"}
              </button>

              {message && <p>{message}</p>}
            </aside>
          </section>
        </>
      )}
    </main>
  );
}