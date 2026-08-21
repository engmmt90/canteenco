"use client";

import {
  useMemo,
  useState,
} from "react";

import {
  createParentPreOrder,
} from "@/app/actions/preorders";

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
  price: number;
  category: string | null;
};

type Props = {
  data: {
    walletBalance: number;
    students: StudentOption[];
    products: ProductOption[];
  };
};

export default function PreOrderForm({
  data,
}: Props) {
  const [studentId, setStudentId] =
    useState(
      data.students[0]?.id ?? "",
    );

  const student =
    data.students.find(
      (item) =>
        item.id === studentId,
    ) ?? null;

  const [slotId, setSlotId] =
    useState(
      student?.pickupSlots[0]?.id ??
        "",
    );

  const [
    pickupDate,
    setPickupDate,
  ] = useState("");

  const [cart, setCart] = useState<
    Record<string, number>
  >({});

  const [busy, setBusy] =
    useState(false);

  const [message, setMessage] =
    useState("");

  const [key, setKey] = useState(
    () => crypto.randomUUID(),
  );

  const total = useMemo(
    () =>
      data.products.reduce(
        (sum, product) =>
          sum +
          product.price *
            (cart[product.id] ?? 0),
        0,
      ),
    [data.products, cart],
  );

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
        ?.pickupSlots[0]?.id ?? "",
    );

    setMessage("");
  }

  function addProduct(
    productId: string,
  ) {
    setCart((current) => ({
      ...current,
      [productId]:
        (current[productId] ?? 0) +
        1,
    }));
  }

  function removeProduct(
    productId: string,
  ) {
    setCart((current) => ({
      ...current,
      [productId]: Math.max(
        0,
        (current[productId] ?? 0) -
          1,
      ),
    }));
  }

  async function submit() {
    if (
      !studentId ||
      !slotId ||
      !pickupDate ||
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
            "Order failed",
        );

        return;
      }

      setMessage(
        `Order ${result.orderNumber} confirmed. New family balance: $${result.balanceAfter}`,
      );

      setCart({});
      setKey(
        crypto.randomUUID(),
      );
    } catch (error) {
      setMessage(
        error instanceof Error
          ? error.message
          : "Order failed",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="wallet-layout">
      <section className="panel">
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

        {student && (
          <>
            <p className="subtle compact">
              Orders close at{" "}
              {student.cutoffTime} for
              same-day pickup.
            </p>

            {!student.preOrderEnabled && (
              <p className="alert">
                Pre-orders are
                currently disabled for
                this school.
              </p>
            )}

            <label className="label">
              Pickup date

              <input
                className="input"
                type="date"
                value={pickupDate}
                onChange={(event) =>
                  setPickupDate(
                    event.target.value,
                  )
                }
              />
            </label>

            <label className="label">
              Pickup time

              <select
                className="input"
                value={slotId}
                onChange={(event) =>
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

        <h2>Products</h2>

        <div className="products">
          {data.products.map(
            (product) => (
              <button
                className="product"
                key={product.id}
                type="button"
                onClick={() =>
                  addProduct(
                    product.id,
                  )
                }
              >
                <strong>
                  {product.name}
                </strong>

                <br />

                $
                {product.price.toFixed(
                  2,
                )}

                {cart[product.id]
                  ? ` × ${
                      cart[
                        product.id
                      ]
                    }`
                  : ""}
              </button>
            ),
          )}
        </div>
      </section>

      <aside className="panel">
        <h2>Order Summary</h2>

        <p>
          Family balance:{" "}
          <strong>
            $
            {data.walletBalance.toFixed(
              2,
            )}
          </strong>
        </p>

        {data.products
          .filter(
            (product) =>
              (cart[product.id] ??
                0) > 0,
          )
          .map((product) => (
            <div
              className="list-row"
              key={product.id}
            >
              <span>
                {product.name} ×{" "}
                {cart[product.id]}
              </span>

              <button
                type="button"
                onClick={() =>
                  removeProduct(
                    product.id,
                  )
                }
              >
                −
              </button>
            </div>
          ))}

        <div className="divider" />

        <strong>
          Total: ${total.toFixed(2)}
        </strong>

        <p>
          Projected balance: $
          {(
            data.walletBalance -
            total
          ).toFixed(2)}
        </p>

        <button
          type="button"
          className="primary"
          disabled={
            busy ||
            total <= 0 ||
            !pickupDate ||
            !slotId ||
            !student ||
            !student.preOrderEnabled
          }
          onClick={() =>
            void submit()
          }
        >
          {busy
            ? "Processing…"
            : "Place Order"}
        </button>

        {message && <p>{message}</p>}
      </aside>
    </div>
  );
}