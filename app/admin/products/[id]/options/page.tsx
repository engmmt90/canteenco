import Link from "next/link";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

import {
  saveProductOptionGroup,
  deleteProductOptionGroup,
  saveProductOption,
  deleteProductOption,
} from "@/app/actions/admin-product-options";

export default async function ProductOptionsPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  await requireAdmin();

  const { id } = await params;

  const product = await prisma.product.findUnique({
    where: {
      id,
    },
    include: {
      optionGroups: {
        orderBy: [
          {
            sortOrder: "asc",
          },
          {
            name: "asc",
          },
        ],
        include: {
          options: {
            orderBy: [
              {
                sortOrder: "asc",
              },
              {
                name: "asc",
              },
            ],
          },
        },
      },
    },
  });

  if (!product) {
    return (
      <main className="content">
        <section className="panel">
          <h1>Product not found</h1>

          <Link
            className="secondary"
            href="/admin/products"
          >
            Back to Products
          </Link>
        </section>
      </main>
    );
  }

  return (
    <main className="content">
      <div className="page-heading">
        <div>
          <h1 className="brand">
            Product Options
          </h1>

          <p className="subtle">
            {product.name} · {product.sku}
          </p>
        </div>

        <Link
          className="secondary"
          href="/admin/products"
        >
          Back to Products
        </Link>
      </div>

      <section
        className="panel"
        style={{
          marginTop: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems: "center",
            justifyContent: "space-between",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <div>
            <h2
              style={{
                marginBottom: 4,
              }}
            >
              {product.name}
            </h2>

            <p className="subtle compact">
              Base price: $
              {Number(product.price).toFixed(2)}
            </p>
          </div>

          <span className="badge">
            {product.isActive
              ? "AVAILABLE"
              : "DISABLED"}
          </span>
        </div>
      </section>

      <section
        className="panel form"
        style={{
          marginTop: 18,
        }}
      >
        <h2>Add Option Group</h2>

        <p className="subtle">
          Example: Drink, Chips, Sauce, Size or
          Main.
        </p>

        <form
          action={saveProductOptionGroup}
          className="form"
        >
          <input
            type="hidden"
            name="productId"
            value={product.id}
          />

          <label className="label">
            Group name

            <input
              className="input"
              name="name"
              placeholder="e.g. Drink"
              required
            />
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(160px, 1fr))",
              gap: 12,
            }}
          >
            <label className="label">
              Minimum selections

              <input
                className="input"
                name="minSelections"
                type="number"
                min="0"
                defaultValue="0"
                required
              />
            </label>

            <label className="label">
              Maximum selections

              <input
                className="input"
                name="maxSelections"
                type="number"
                min="1"
                defaultValue="1"
                required
              />
            </label>

            <label className="label">
              Sort order

              <input
                className="input"
                name="sortOrder"
                type="number"
                defaultValue="0"
              />
            </label>
          </div>

          <label
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
            }}
          >
            <input
              type="checkbox"
              name="isRequired"
            />

            Required
          </label>

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
              defaultChecked
            />

            Active
          </label>

          <button
            className="primary"
            type="submit"
          >
            Add Option Group
          </button>
        </form>
      </section>

      <section
        style={{
          marginTop: 18,
        }}
      >
        {product.optionGroups.length === 0 ? (
          <section className="panel">
            <h2>No option groups yet</h2>

            <p className="subtle">
              Add your first option group above.
            </p>
          </section>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 18,
            }}
          >
            {product.optionGroups.map((group) => (
              <section
                className="panel"
                key={group.id}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "flex-start",
                    justifyContent: "space-between",
                    gap: 16,
                    flexWrap: "wrap",
                  }}
                >
                  <div>
                    <h2
                      style={{
                        marginBottom: 4,
                      }}
                    >
                      {group.name}
                    </h2>

                    <p className="subtle compact">
                      {group.isRequired
                        ? "Required"
                        : "Optional"}{" "}
                      · Choose{" "}
                      {group.minSelections}–
                      {group.maxSelections}
                    </p>
                  </div>

                  <span className="badge">
                    {group.isActive
                      ? "ACTIVE"
                      : "DISABLED"}
                  </span>
                </div>

                <div
                  className="divider"
                  style={{
                    margin: "16px 0",
                  }}
                />

                <form
                  action={saveProductOptionGroup}
                  className="form"
                >
                  <input
                    type="hidden"
                    name="id"
                    value={group.id}
                  />

                  <input
                    type="hidden"
                    name="productId"
                    value={product.id}
                  />

                  <label className="label">
                    Group name

                    <input
                      className="input"
                      name="name"
                      defaultValue={group.name}
                      required
                    />
                  </label>

                  <div
                    style={{
                      display: "grid",
                      gridTemplateColumns:
                        "repeat(auto-fit, minmax(150px, 1fr))",
                      gap: 10,
                    }}
                  >
                    <label className="label">
                      Minimum

                      <input
                        className="input"
                        name="minSelections"
                        type="number"
                        min="0"
                        defaultValue={
                          group.minSelections
                        }
                        required
                      />
                    </label>

                    <label className="label">
                      Maximum

                      <input
                        className="input"
                        name="maxSelections"
                        type="number"
                        min="1"
                        defaultValue={
                          group.maxSelections
                        }
                        required
                      />
                    </label>

                    <label className="label">
                      Sort order

                      <input
                        className="input"
                        name="sortOrder"
                        type="number"
                        defaultValue={
                          group.sortOrder
                        }
                      />
                    </label>
                  </div>

                  <label
                    style={{
                      display: "flex",
                      alignItems: "center",
                      gap: 8,
                    }}
                  >
                    <input
                      type="checkbox"
                      name="isRequired"
                      defaultChecked={
                        group.isRequired
                      }
                    />

                    Required
                  </label>

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
                        group.isActive
                      }
                    />

                    Active
                  </label>

                  <div className="actions-row">
                    <button
                      className="primary"
                      type="submit"
                    >
                      Save Group
                    </button>
                  </div>
                </form>

                <div
                  className="divider"
                  style={{
                    margin: "20px 0",
                  }}
                />

                <h3>Options</h3>

                {group.options.length === 0 ? (
                  <p className="subtle">
                    No options yet.
                  </p>
                ) : (
                  <div
                    className="request-list"
                    style={{
                      marginTop: 12,
                    }}
                  >
                    {group.options.map((option) => (
                      <div
                        className="list-row"
                        key={option.id}
                      >
                        <div>
                          <strong>
                            {option.name}
                          </strong>

                          <div className="subtle compact">
                            {Number(
                              option.additionalPrice,
                            ) > 0
                              ? `+$${Number(
                                  option.additionalPrice,
                                ).toFixed(2)}`
                              : "$0.00"}{" "}
                            · Sort{" "}
                            {option.sortOrder}
                          </div>
                        </div>

                        <div
                          style={{
                            display: "flex",
                            alignItems: "center",
                            gap: 8,
                            flexWrap: "wrap",
                            justifyContent:
                              "flex-end",
                          }}
                        >
                          <span className="badge">
                            {option.isActive
                              ? "ACTIVE"
                              : "DISABLED"}
                          </span>

                          <form
                            action={
                              saveProductOption
                            }
                            style={{
                              display: "flex",
                              gap: 8,
                              alignItems:
                                "center",
                              flexWrap:
                                "wrap",
                            }}
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={option.id}
                            />

                            <input
                              type="hidden"
                              name="groupId"
                              value={group.id}
                            />

                            <input
                              className="input"
                              name="name"
                              defaultValue={
                                option.name
                              }
                              required
                              style={{
                                minWidth: 150,
                              }}
                            />

                            <input
                              className="input"
                              name="additionalPrice"
                              type="number"
                              min="0"
                              step="0.01"
                              defaultValue={Number(
                                option.additionalPrice,
                              ).toFixed(2)}
                              style={{
                                width: 110,
                              }}
                            />

                            <input
                              className="input"
                              name="sortOrder"
                              type="number"
                              defaultValue={
                                option.sortOrder
                              }
                              style={{
                                width: 90,
                              }}
                            />

                            <label
                              style={{
                                display: "flex",
                                alignItems:
                                  "center",
                                gap: 5,
                              }}
                            >
                              <input
                                type="checkbox"
                                name="isActive"
                                defaultChecked={
                                  option.isActive
                                }
                              />

                              Active
                            </label>

                            <button
                              className="secondary"
                              type="submit"
                            >
                              Save
                            </button>
                          </form>

                          <form
                            action={
                              deleteProductOption
                            }
                          >
                            <input
                              type="hidden"
                              name="id"
                              value={option.id}
                            />

                            <button
                              className="secondary"
                              type="submit"
                            >
                              Delete
                            </button>
                          </form>
                        </div>
                      </div>
                    ))}
                  </div>
                )}

                <div
                  className="panel"
                  style={{
                    marginTop: 16,
                    background: "#f8fafc",
                  }}
                >
                  <h3>Add Option</h3>

                  <form
                    action={saveProductOption}
                    className="form"
                  >
                    <input
                      type="hidden"
                      name="groupId"
                      value={group.id}
                    />

                    <label className="label">
                      Option name

                      <input
                        className="input"
                        name="name"
                        placeholder="e.g. Milkshake"
                        required
                      />
                    </label>

                    <div
                      style={{
                        display: "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(150px, 1fr))",
                        gap: 10,
                      }}
                    >
                      <label className="label">
                        Additional price

                        <input
                          className="input"
                          name="additionalPrice"
                          type="number"
                          min="0"
                          step="0.01"
                          defaultValue="0.00"
                        />
                      </label>

                      <label className="label">
                        Sort order

                        <input
                          className="input"
                          name="sortOrder"
                          type="number"
                          defaultValue="0"
                        />
                      </label>
                    </div>

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
                        defaultChecked
                      />

                      Active
                    </label>

                    <button
                      className="primary"
                      type="submit"
                    >
                      Add Option
                    </button>
                  </form>
                </div>

                <form
                  action={deleteProductOptionGroup}
                  style={{
                    marginTop: 16,
                  }}
                >
                  <input
                    type="hidden"
                    name="id"
                    value={group.id}
                  />

                  <button
                    className="secondary"
                    type="submit"
                  >
                    Delete Group
                  </button>
                </form>
              </section>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}