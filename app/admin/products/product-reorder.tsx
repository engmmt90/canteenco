"use client";

import { DragEvent, useMemo, useState, useTransition } from "react";
import { saveProductOrder } from "@/app/actions/product-order";

type ProductItem = {
  id: string;
  name: string;
  imageUrl: string | null;
  sortOrder: number;
};

export default function ProductReorder({
  products,
}: {
  products: ProductItem[];
}) {
  const initial = useMemo(
    () =>
      [...products].sort(
        (a, b) => a.sortOrder - b.sortOrder || a.name.localeCompare(b.name),
      ),
    [products],
  );

  const [items, setItems] = useState(initial);
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [message, setMessage] = useState("");
  const [isPending, startTransition] = useTransition();

  function moveItem(fromIndex: number, toIndex: number) {
    if (
      fromIndex === toIndex ||
      fromIndex < 0 ||
      toIndex < 0 ||
      fromIndex >= items.length ||
      toIndex >= items.length
    ) {
      return;
    }

    setItems((current) => {
      const next = [...current];
      const [moved] = next.splice(fromIndex, 1);
      next.splice(toIndex, 0, moved);
      return next;
    });

    setMessage("");
  }

  function onDrop(event: DragEvent<HTMLDivElement>, targetId: string) {
    event.preventDefault();

    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      return;
    }

    const fromIndex = items.findIndex((item) => item.id === draggedId);
    const toIndex = items.findIndex((item) => item.id === targetId);

    moveItem(fromIndex, toIndex);
    setDraggedId(null);
  }

  function save() {
    setMessage("");

    startTransition(async () => {
      try {
        await saveProductOrder(items.map((item) => item.id));
        setMessage(
          "Product order saved. The cashier screen will use this order.",
        );
      } catch (error) {
        setMessage(
          error instanceof Error
            ? error.message
            : "Could not save product order.",
        );
      }
    });
  }

  return (
    <section className="panel" style={{ marginTop: 18, marginBottom: 18 }}>
      <div className="page-heading">
        <div>
          <h2>Reorder Products</h2>
          <p className="subtle compact">
            Drag products into the order you want on the cashier screen, then
            press Save Order.
          </p>
        </div>

        <button
          type="button"
          className="primary"
          onClick={save}
          disabled={isPending}
        >
          {isPending ? "Saving..." : "Save Order"}
        </button>
      </div>

      <div
        style={{
          display: "grid",
          gridTemplateColumns: "repeat(auto-fill, minmax(145px, 1fr))",
          gap: 12,
          marginTop: 16,
        }}
      >
        {items.map((product, index) => (
          <div
            key={product.id}
            draggable
            onDragStart={() => setDraggedId(product.id)}
            onDragEnd={() => setDraggedId(null)}
            onDragOver={(event) => event.preventDefault()}
            onDrop={(event) => onDrop(event, product.id)}
            style={{
              border: "1px solid #e5e7eb",
              borderRadius: 12,
              padding: 10,
              background: draggedId === product.id ? "#f3f4f6" : "white",
              cursor: "grab",
              userSelect: "none",
            }}
          >
            <div
              style={{
                height: 88,
                borderRadius: 10,
                overflow: "hidden",
                background: "#f3f4f6",
                display: "flex",
                alignItems: "center",
                justifyContent: "center",
              }}
            >
              {product.imageUrl ? (
                <img
                  src={product.imageUrl}
                  alt={product.name}
                  draggable={false}
                  style={{
                    width: "100%",
                    height: "100%",
                    objectFit: "cover",
                  }}
                />
              ) : (
                <span className="subtle" style={{ fontSize: 11 }}>
                  No image
                </span>
              )}
            </div>

            <strong style={{ display: "block", marginTop: 8, minHeight: 40 }}>
              {index + 1}. {product.name}
            </strong>

            <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
              <button
                type="button"
                className="secondary"
                disabled={index === 0}
                onClick={() => moveItem(index, index - 1)}
                style={{ flex: 1, padding: "6px 8px" }}
                aria-label={`Move ${product.name} earlier`}
              >
                ↑
              </button>

              <button
                type="button"
                className="secondary"
                disabled={index === items.length - 1}
                onClick={() => moveItem(index, index + 1)}
                style={{ flex: 1, padding: "6px 8px" }}
                aria-label={`Move ${product.name} later`}
              >
                ↓
              </button>
            </div>
          </div>
        ))}
      </div>

      {message ? (
        <p
          className={
            message.startsWith("Product order saved") ? "success" : "alert"
          }
          style={{ marginTop: 14 }}
        >
          {message}
        </p>
      ) : null}
    </section>
  );
}