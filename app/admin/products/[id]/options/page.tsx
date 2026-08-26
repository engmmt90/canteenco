import Link from "next/link";

import {
  deleteProductOption,
  deleteProductOptionGroup,
  saveProductOption,
  saveProductOptionGroup,
} from "@/app/actions/admin-product-options";

import { requireAdmin } from "@/lib/authz";
import { prisma } from "@/lib/prisma";

export default async function ProductOptionsPage({
  params,
}: {
  params: Promise<{
    id: string;
  }>;
}) {
  await requireAdmin();

  const { id } =
    await params;

  const product =
    await prisma.product.findUnique({
      where: {
        id,
      },

      include: {
        optionGroups: {
          orderBy: [
            {
              sortOrder:
                "asc",
            },

            {
              name: "asc",
            },
          ],

          include: {
            options: {
              orderBy: [
                {
                  sortOrder:
                    "asc",
                },

                {
                  name:
                    "asc",
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
          <h1>
            Product not found
          </h1>

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
      {/* HEADER */}

      <div className="page-heading">
        <div>
          <h1 className="brand">
            Product Options
          </h1>

          <p className="subtle">
            {product.name}
            {" · "}
            {product.sku}
          </p>
        </div>

        <Link
          className="secondary"
          href="/admin/products"
        >
          Back to Products
        </Link>
      </div>

      {/* PRODUCT INFO */}

      <section
        className="panel"
        style={{
          marginTop: 18,
        }}
      >
        <div
          style={{
            display: "flex",
            alignItems:
              "center",
            justifyContent:
              "space-between",
            gap: 16,
            flexWrap:
              "wrap",
          }}
        >
          <div>
            <h2
              style={{
                margin:
                  "0 0 4px",
              }}
            >
              {product.name}
            </h2>

            <p className="subtle compact">
              Base price: $
              {Number(
                product.price,
              ).toFixed(2)}
            </p>
          </div>

          <span className="badge">
            {product.isActive
              ? "AVAILABLE"
              : "DISABLED"}
          </span>
        </div>
      </section>

      {/* ADD GROUP */}

      <section
        className="panel"
        style={{
          marginTop: 18,
        }}
      >
        <h2>
          Add Option Group
        </h2>

        <p className="subtle">
          Create a group such as
          Sauce, Drink, Chips,
          Size or Extras.
        </p>

        <form
          action={
            saveProductOptionGroup
          }
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
              placeholder="e.g. Sauce"
              required
            />
          </label>

          <div
            style={{
              display: "grid",
              gridTemplateColumns:
                "repeat(auto-fit, minmax(180px, 1fr))",
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
              alignItems:
                "center",
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
              alignItems:
                "center",
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

      {/* OPTION GROUPS */}

      <section
        style={{
          marginTop: 18,
        }}
      >
        {product.optionGroups
          .length === 0 ? (
          <section className="panel">
            <h2>
              No option groups
            </h2>

            <p className="subtle">
              Create your first
              option group above.
            </p>
          </section>
        ) : (
          <div
            style={{
              display: "grid",
              gap: 18,
            }}
          >
            {product.optionGroups.map(
              (group) => (
                <section
                  className="panel"
                  key={group.id}
                >
                  {/* GROUP HEADER */}

                  <div
                    style={{
                      display:
                        "flex",
                      alignItems:
                        "flex-start",
                      justifyContent:
                        "space-between",
                      gap: 12,
                      flexWrap:
                        "wrap",
                    }}
                  >
                    <div>
                      <h2
                        style={{
                          margin:
                            "0 0 4px",
                        }}
                      >
                        {group.name}
                      </h2>

                      <p className="subtle compact">
                        {group.isRequired
                          ? "Required"
                          : "Optional"}

                        {" · "}

                        Choose{" "}
                        {
                          group.minSelections
                        }
                        –
                        {
                          group.maxSelections
                        }

                        {" · "}

                        {
                          group.options
                            .length
                        }{" "}
                        option
                        {group.options
                          .length === 1
                          ? ""
                          : "s"}
                      </p>
                    </div>

                    <span className="badge">
                      {group.isActive
                        ? "ACTIVE"
                        : "INACTIVE"}
                    </span>
                  </div>

                  {/* EDIT GROUP */}

                  <div
                    className="divider"
                    style={{
                      margin:
                        "16px 0",
                    }}
                  />

                  <form
                    action={
                      saveProductOptionGroup
                    }
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
                      value={
                        product.id
                      }
                    />

                    <label className="label">
                      Group name

                      <input
                        className="input"
                        name="name"
                        required
                        defaultValue={
                          group.name
                        }
                      />
                    </label>

                    <div
                      style={{
                        display:
                          "grid",
                        gridTemplateColumns:
                          "repeat(auto-fit, minmax(170px, 1fr))",
                        gap: 12,
                      }}
                    >
                      <label className="label">
                        Minimum

                        <input
                          className="input"
                          name="minSelections"
                          type="number"
                          min="0"
                          required
                          defaultValue={
                            group.minSelections
                          }
                        />
                      </label>

                      <label className="label">
                        Maximum

                        <input
                          className="input"
                          name="maxSelections"
                          type="number"
                          min="1"
                          required
                          defaultValue={
                            group.maxSelections
                          }
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
                        display:
                          "flex",
                        alignItems:
                          "center",
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
                        display:
                          "flex",
                        alignItems:
                          "center",
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

                    <button
                      className="secondary"
                      type="submit"
                    >
                      Save Group
                    </button>
                  </form>

                  {/* OPTIONS TITLE */}

                  <div
                    className="divider"
                    style={{
                      margin:
                        "22px 0 16px",
                    }}
                  />

                  <div
                    style={{
                      display:
                        "flex",
                      alignItems:
                        "center",
                      justifyContent:
                        "space-between",
                      gap: 12,
                    }}
                  >
                    <div>
                      <h3
                        style={{
                          margin: 0,
                        }}
                      >
                        {group.name} Options
                      </h3>

                      <p
                        className="subtle compact"
                        style={{
                          marginTop: 4,
                        }}
                      >
                        Add the choices
                        that belong to{" "}
                        <strong>
                          {group.name}
                        </strong>
                        .
                      </p>
                    </div>

                    <span className="badge">
                      {
                        group.options
                          .length
                      }{" "}
                      OPTIONS
                    </span>
                  </div>

                  {/* EXISTING OPTIONS */}

                  {group.options
                    .length ===
                  0 ? (
                    <div
                      style={{
                        marginTop: 14,
                        padding: 16,
                        background:
                          "#f8fafc",
                        borderRadius:
                          12,
                      }}
                    >
                      <p
                        className="subtle"
                        style={{
                          margin: 0,
                        }}
                      >
                        No options added
                        to {group.name} yet.
                      </p>
                    </div>
                  ) : (
                    <div
                      className="request-list"
                      style={{
                        marginTop: 14,
                      }}
                    >
                      {group.options.map(
                        (option) => (
                          <div
                            className="list-row"
                            key={
                              option.id
                            }
                            style={{
                              alignItems:
                                "center",
                              gap: 14,
                            }}
                          >
                            {/* OPTION SUMMARY */}

                            <div
                              style={{
                                minWidth:
                                  150,
                              }}
                            >
                              <strong>
                                {
                                  option.name
                                }
                              </strong>

                              <div className="subtle compact">
                                {Number(
                                  option.additionalPrice,
                                ) >
                                0
                                  ? `+$${Number(
                                      option.additionalPrice,
                                    ).toFixed(
                                      2,
                                    )}`
                                  : "Included"}

                                {" · "}

                                Sort{" "}
                                {
                                  option.sortOrder
                                }
                              </div>
                            </div>

                            {/* EDIT OPTION */}

                            <form
                              action={
                                saveProductOption
                              }
                              style={{
                                flex: 1,
                                display:
                                  "grid",
                                gridTemplateColumns:
                                  "minmax(180px, 1fr) 120px 100px auto auto",
                                gap: 8,
                                alignItems:
                                  "center",
                              }}
                            >
                              <input
                                type="hidden"
                                name="id"
                                value={
                                  option.id
                                }
                              />

                              <input
                                type="hidden"
                                name="groupId"
                                value={
                                  group.id
                                }
                              />

                              <input
                                className="input"
                                name="name"
                                required
                                defaultValue={
                                  option.name
                                }
                              />

                              <input
                                className="input"
                                name="additionalPrice"
                                type="number"
                                min="0"
                                step="0.01"
                                defaultValue={Number(
                                  option.additionalPrice,
                                ).toFixed(
                                  2,
                                )}
                              />

                              <input
                                className="input"
                                name="sortOrder"
                                type="number"
                                defaultValue={
                                  option.sortOrder
                                }
                              />

                              <label
                                style={{
                                  display:
                                    "flex",
                                  alignItems:
                                    "center",
                                  gap: 5,
                                  whiteSpace:
                                    "nowrap",
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

                            {/* DELETE OPTION */}

                            <form
                              action={
                                deleteProductOption
                              }
                            >
                              <input
                                type="hidden"
                                name="id"
                                value={
                                  option.id
                                }
                              />

                              <button
                                className="secondary"
                                type="submit"
                              >
                                Delete
                              </button>
                            </form>
                          </div>
                        ),
                      )}
                    </div>
                  )}

                  {/* ADD OPTION TO THIS GROUP */}

                  <div
                    style={{
                      marginTop: 18,
                      padding: 18,
                      border:
                        "1px solid #e5e7eb",
                      borderRadius: 14,
                      background:
                        "#f8fafc",
                    }}
                  >
                    <h3
                      style={{
                        marginTop: 0,
                        marginBottom: 4,
                      }}
                    >
                      Add Option to{" "}
                      {group.name}
                    </h3>

                    <p
                      className="subtle compact"
                      style={{
                        marginBottom: 14,
                      }}
                    >
                      Example for Sauce:
                      BBQ Sauce, Garlic
                      Sauce or Chilli
                      Sauce.
                    </p>

                    <form
                      action={
                        saveProductOption
                      }
                      className="form"
                    >
                      <input
                        type="hidden"
                        name="groupId"
                        value={
                          group.id
                        }
                      />

                      <label className="label">
                        Option name

                        <input
                          className="input"
                          name="name"
                          placeholder={`e.g. ${group.name} 1`}
                          required
                        />
                      </label>

                      <div
                        style={{
                          display:
                            "grid",
                          gridTemplateColumns:
                            "repeat(auto-fit, minmax(180px, 1fr))",
                          gap: 12,
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
                          display:
                            "flex",
                          alignItems:
                            "center",
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
                        Add Option to{" "}
                        {group.name}
                      </button>
                    </form>
                  </div>

                  {/* DELETE GROUP */}

                  <div
                    className="divider"
                    style={{
                      margin:
                        "20px 0 14px",
                    }}
                  />

                  <form
                    action={
                      deleteProductOptionGroup
                    }
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
                      Delete{" "}
                      {group.name} Group
                    </button>
                  </form>
                </section>
              ),
            )}
          </div>
        )}
      </section>
    </main>
  );
}