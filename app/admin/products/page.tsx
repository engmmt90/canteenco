import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { saveProduct } from "@/app/actions/admin-management";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{ edit?: string }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const editId = params.edit;

  const products = await prisma.product.findMany({
    where: {
      deletedAt: null,
    },
    orderBy: [
      { sortOrder: "asc" },
      { name: "asc" },
    ],
  });

  const editingProduct = editId
    ? products.find((product) => product.id === editId)
    : null;

  return (
    <main className="content">
      <div className="page-heading">
        <h1 className="brand">Products</h1>

        <Link
          className="secondary"
          href="/admin"
        >
          Dashboard
        </Link>
      </div>

      <form
        action={saveProduct}
        className="panel form"
      >
        <h2>
          {editingProduct
            ? `Edit Product — ${editingProduct.name}`
            : "Add Product"}
        </h2>

        {editingProduct && (
          <input
            type="hidden"
            name="id"
            value={editingProduct.id}
          />
        )}

        <input
          className="input"
          name="sku"
          placeholder="SKU"
          required
          defaultValue={
            editingProduct?.sku ?? ""
          }
        />

        <input
          className="input"
          name="name"
          placeholder="Product name"
          required
          defaultValue={
            editingProduct?.name ?? ""
          }
        />

        <input
          className="input"
          name="category"
          placeholder="Category"
          defaultValue={
            editingProduct?.category ?? ""
          }
        />

        <input
          className="input"
          name="price"
          type="number"
          min="0"
          step=".01"
          placeholder="Price"
          required
          defaultValue={
            editingProduct
              ? Number(
                  editingProduct.price,
                ).toFixed(2)
              : ""
          }
        />

        <input
          className="input"
          name="sortOrder"
          type="number"
          defaultValue={
            editingProduct?.sortOrder ?? 0
          }
        />

        <input
          className="input"
          name="imageUrl"
          type="url"
          placeholder="Product image URL"
          defaultValue={
            editingProduct?.imageUrl ?? ""
          }
        />

        {editingProduct?.imageUrl && (
          <div
            style={{
              display: "flex",
              alignItems: "center",
              gap: 12,
            }}
          >
            <img
              src={editingProduct.imageUrl}
              alt={editingProduct.name}
              style={{
                width: 90,
                height: 90,
                objectFit: "cover",
                borderRadius: 12,
                border: "1px solid #e5e7eb",
              }}
            />

            <span className="subtle">
              Current product image
            </span>
          </div>
        )}

        <textarea
          className="input"
          name="description"
          placeholder="Description"
          defaultValue={
            editingProduct?.description ??
            ""
          }
        />

        <label
          style={{
            display: "flex",
            alignItems: "center",
            gap: 8,
          }}
        >
          <input
            type="checkbox"
            name="isActive"
            defaultChecked={
              editingProduct
                ? editingProduct.isActive
                : true
            }
          />

          Available for sale
        </label>

        <div
          style={{
            display: "flex",
            gap: 10,
          }}
        >
          <button
            className="primary"
            type="submit"
          >
            {editingProduct
              ? "Save Changes"
              : "Add Product"}
          </button>

          {editingProduct && (
            <Link
              className="secondary"
              href="/admin/products"
            >
              Cancel Edit
            </Link>
          )}
        </div>
      </form>

      <section
        className="panel"
        style={{
          marginTop: 18,
        }}
      >
        <div className="request-list">
          {products.map((product) => (
            <div
              className="list-row"
              key={product.id}
            >
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                }}
              >
                <div
                  style={{
                    width: 64,
                    height: 64,
                    borderRadius: 10,
                    overflow: "hidden",
                    background: "#f3f4f6",
                    flexShrink: 0,
                    display: "flex",
                    alignItems: "center",
                    justifyContent: "center",
                  }}
                >
                  {product.imageUrl ? (
                    <img
                      src={product.imageUrl}
                      alt={product.name}
                      style={{
                        width: "100%",
                        height: "100%",
                        objectFit: "cover",
                        display: "block",
                      }}
                    />
                  ) : (
                    <span
                      className="subtle"
                      style={{
                        fontSize: 11,
                      }}
                    >
                      No image
                    </span>
                  )}
                </div>

                <div>
                  <strong>
                    {product.name}
                  </strong>

                  <div className="subtle compact">
                    {product.sku} ·{" "}
                    {product.category ||
                      "Uncategorised"}
                  </div>

                  <div
                    className="subtle compact"
                    style={{
                      marginTop: 4,
                    }}
                  >
                    Sort order:{" "}
                    {product.sortOrder}
                  </div>
                </div>
              </div>

              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  flexWrap: "wrap",
                  justifyContent:
                    "flex-end",
                }}
              >
                <strong>
                  $
                  {Number(
                    product.price,
                  ).toFixed(2)}
                </strong>

                <span className="badge">
                  {product.isActive
                    ? "AVAILABLE"
                    : "DISABLED"}
                </span>

                <Link
                  className="secondary"
                  href={`/admin/products?edit=${product.id}`}
                >
                  Edit
                </Link>
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}