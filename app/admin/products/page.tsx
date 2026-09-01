import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";
import { saveProduct } from "@/app/actions/admin-management";
import ProductReorder from "./product-reorder";

export default async function Page({
  searchParams,
}: {
  searchParams: Promise<{
    edit?: string;
    add?: string;
  }>;
}) {
  await requireAdmin();

  const params = await searchParams;
  const editId = params.edit;
  const showAddForm = params.add === "1";

  const products = await prisma.product.findMany({
    where: {
      deletedAt: null,
    },

    orderBy: [
      {
        sortOrder: "asc",
      },
      {
        name: "asc",
      },
    ],
  });

  const editingProduct = editId
    ? products.find(
        (product) => product.id === editId,
      )
    : null;

  return (
    <main className="content">
      {/* Header */}
      <div className="page-heading">
        <div>
          <h1 className="brand">
            Products
          </h1>

          <p className="subtle">
            Manage products, prices and
            product options.
          </p>
        </div>

        <Link
          className="secondary"
          href="/admin"
        >
          Dashboard
        </Link>
      </div>

      {/* Add Product button */}
      {!editingProduct && !showAddForm && (
        <div
          style={{
            marginBottom: 18,
          }}
        >
          <Link
            className="primary"
            href="/admin/products?add=1"
          >
            + Add Product
          </Link>
        </div>
      )}

      {/* Add / Edit Product */}
      {(editingProduct || showAddForm) && (
      <form
        action={saveProduct}
        className="panel form"
      >
        <h2>
          {editingProduct
            ? `Edit Product â€” ${editingProduct.name}`
            : "Add Product"}
        </h2>

        {editingProduct && (
          <input
            type="hidden"
            name="id"
            value={editingProduct.id}
          />
        )}

        {/* SKU */}
        <label className="label">
          SKU

          <input
            className="input"
            name="sku"
            placeholder="SKU"
            required
            defaultValue={
              editingProduct?.sku ?? ""
            }
          />
        </label>

        {/* Name */}
        <label className="label">
          Product name

          <input
            className="input"
            name="name"
            placeholder="Product name"
            required
            defaultValue={
              editingProduct?.name ?? ""
            }
          />
        </label>

        {/* Category */}
        <label className="label">
          Category

          <input
            className="input"
            name="category"
            placeholder="Category"
            defaultValue={
              editingProduct?.category ?? ""
            }
          />
        </label>

        {/* Price */}
        <label className="label">
          Price

          <input
            className="input"
            name="price"
            type="number"
            min="0"
            step="0.01"
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
        </label>

        {/* Sort Order */}
        <label className="label">
          Sort order

          <input
            className="input"
            name="sortOrder"
            type="number"
            defaultValue={
              editingProduct?.sortOrder ?? 0
            }
          />
        </label>

        {/* Image URL */}
        <label className="label">
          Product image URL

          <input
            className="input"
            name="imageUrl"
            type="url"
            placeholder="https://..."
            defaultValue={
              editingProduct?.imageUrl ?? ""
            }
          />
        </label>

        {/* Current Image */}
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
                border:
                  "1px solid #e5e7eb",
              }}
            />

            <span className="subtle">
              Current product image
            </span>
          </div>
        )}

        {/* Description */}
        <label className="label">
          Description

          <textarea
            className="input"
            name="description"
            placeholder="Description"
            defaultValue={
              editingProduct?.description ??
              ""
            }
            rows={4}
          />
        </label>

        {/* Active */}
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

        {/* Form Buttons */}
        <div
          style={{
            display: "flex",
            gap: 10,
            flexWrap: "wrap",
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

          <Link
            className="secondary"
            href="/admin/products"
          >
            {editingProduct
              ? "Cancel Edit"
              : "Cancel"}
          </Link>
        </div>
      </form>
      )}

      {!editingProduct &&
        !showAddForm &&
        products.length > 1 && (
          <ProductReorder
            products={products.map(
              (product) => ({
                id: product.id,
                name: product.name,
                imageUrl: product.imageUrl,
                sortOrder: product.sortOrder,
              }),
            )}
          />
        )}

      {/* Products List */}
      <section
        className="panel"
        style={{
          marginTop: 18,
        }}
      >
        <div className="page-heading">
          <div>
            <h2>Product List</h2>

            <p className="subtle compact">
              Manage your products and their
              optional choices.
            </p>
          </div>

          <span className="badge">
            {products.length}{" "}
            {products.length === 1
              ? "PRODUCT"
              : "PRODUCTS"}
          </span>
        </div>

        <div
          className="request-list"
          style={{
            marginTop: 16,
          }}
        >
          {products.length === 0 ? (
            <div
              style={{
                padding: 20,
                textAlign: "center",
              }}
            >
              <p className="subtle">
                No products found.
              </p>
            </div>
          ) : (
            products.map((product) => (
              <div
                className="list-row"
                key={product.id}
                style={{
                  alignItems: "center",
                  gap: 16,
                }}
              >
                {/* Product Information */}
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    minWidth: 0,
                    flex: 1,
                  }}
                >
                  {/* Product Image */}
                  <div
                    style={{
                      width: 64,
                      height: 64,
                      borderRadius: 10,
                      overflow: "hidden",
                      background:
                        "#f3f4f6",
                      flexShrink: 0,
                      display: "flex",
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
                        alt={
                          product.name
                        }
                        style={{
                          width: "100%",
                          height: "100%",
                          objectFit:
                            "cover",
                          display:
                            "block",
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

                  {/* Product Details */}
                  <div
                    style={{
                      minWidth: 0,
                    }}
                  >
                    <strong>
                      {product.name}
                    </strong>

                    <div className="subtle compact">
                      {product.sku} Â·{" "}
                      {product.category ||
                        "Uncategorised"}
                    </div>

                    {product.description && (
                      <div
                        className="subtle compact"
                        style={{
                          marginTop: 4,
                          maxWidth: 600,
                          overflow:
                            "hidden",
                          textOverflow:
                            "ellipsis",
                          whiteSpace:
                            "nowrap",
                        }}
                      >
                        {
                          product.description
                        }
                      </div>
                    )}

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

                {/* Product Actions */}
                <div
                  style={{
                    display: "flex",
                    alignItems:
                      "center",
                    gap: 10,
                    flexWrap: "wrap",
                    justifyContent:
                      "flex-end",
                  }}
                >
                  {/* Price */}
                  <strong>
                    $
                    {Number(
                      product.price,
                    ).toFixed(2)}
                  </strong>

                  {/* Status */}
                  <span className="badge">
                    {product.isActive
                      ? "AVAILABLE"
                      : "DISABLED"}
                  </span>

                  {/* Options */}
                  <Link
                    className="secondary"
                    href={`/admin/products/${product.id}/options`}
                  >
                    Options
                  </Link>

                  {/* Edit */}
                  <Link
                    className="secondary"
                    href={`/admin/products?edit=${product.id}`}
                  >
                    Edit
                  </Link>
                </div>
              </div>
            ))
          )}
        </div>
      </section>
    </main>
  );
}