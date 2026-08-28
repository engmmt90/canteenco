import Link from "next/link";

import { requireParent } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import PreOrderForm from "./preorder-form";
import { cancelOwnPreOrderFromForm } from "@/app/actions/preorders";

export default async function ParentPreOrdersPage() {
  const session = await requireParent();

  const parent =
    await prisma.parentProfile.findUnique({
      where: {
        userId: session.user.id,
      },

      include: {
        wallet: {
          include: {
            preOrders: {
              orderBy: {
                createdAt: "desc",
              },

              take: 20,

              include: {
                student: true,
                pickupSlot: true,
                items: {
                  include: {
                    product: true,
                    options: true,
                  },
                },
              },
            },
          },
        },

        students: {
          where: {
            status: "ACTIVE",
            deletedAt: null,
          },

          include: {
            school: {
              include: {
                settings: true,

                pickupSlots: {
                  where: {
                    isActive: true,
                  },

                  orderBy: {
                    sortOrder: "asc",
                  },
                },
              },
            },
          },

          orderBy: [
            {
              firstName: "asc",
            },
            {
              lastName: "asc",
            },
          ],
        },
      },
    });

  const products =
    await prisma.product.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },

      include: {
        optionGroups: {
          where: {
            isActive: true,
          },

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
              where: {
                isActive: true,
              },

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

      orderBy: [
        {
          sortOrder: "asc",
        },
        {
          name: "asc",
        },
      ],
    });

  const data = {
    walletBalance: Number(
      parent?.wallet?.balance ?? 0,
    ),

    students: (
      parent?.students ?? []
    ).map((student) => ({
      id: student.id,

      firstName:
        student.firstName,

      lastName:
        student.lastName,

      displayCode:
        student.displayCode,

      schoolId:
        student.schoolId,

      schoolName:
        student.school.name,

      preOrderEnabled:
        student.school.settings
          ?.preOrderEnabled ??
        false,

      cutoffTime:
        student.school.settings
          ?.preOrderCutoffTime ??
        "07:00",

      pickupSlots:
        student.school.pickupSlots.map(
          (slot) => ({
            id: slot.id,
            label: slot.label,
          }),
        ),
    })),

    products: products.map(
      (product) => ({
        id: product.id,

        name: product.name,

        price: Number(
          product.price,
        ),

        category:
          product.category,

        optionGroups:
          product.optionGroups.map(
            (group) => ({
              id: group.id,

              name: group.name,

              minSelections:
                group.minSelections,

              maxSelections:
                group.maxSelections,

              isRequired:
                group.isRequired,

              options:
                group.options.map(
                  (option) => ({
                    id: option.id,

                    name: option.name,

                    additionalPrice:
                      Number(
                        option.additionalPrice,
                      ),
                  }),
                ),
            }),
          ),
      }),
    ),
  };

  return (
    <main className="content">
      <div className="page-heading">
        <div>
          <h1 className="brand">
            Pre-Orders
          </h1>

          <p className="subtle">
            Order ahead for your child
            and choose a pickup time.
          </p>
        </div>

        <Link
          className="secondary"
          href="/parent/dashboard"
        >
          Dashboard
        </Link>
      </div>

      <PreOrderForm data={data} />

      <section
        className="panel"
        style={{
          marginTop: 18,
        }}
      >
        <h2>Recent Orders</h2>

        <div className="request-list">
          {(
            parent?.wallet
              ?.preOrders ?? []
          ).length === 0 ? (
            <p className="subtle compact">
              No pre-orders yet.
            </p>
          ) : null}

          {(
            parent?.wallet
              ?.preOrders ?? []
          ).map((order) => (
            <div
              className="list-row"
              key={order.id}
            >
              <div>
                <strong>
                  {order.orderNumber}
                </strong>

                <div className="subtle compact">
                  {order.student.firstName}{" "}
                  {order.student.lastName}
                  {" · "}
                  {order.pickupSlot.label}
                  {" · "}
                  {order.status}
                </div>

                {order.items.length >
                  0 && (
                  <div
                    className="subtle compact"
                    style={{
                      marginTop: 6,
                    }}
                  >
                    {order.items.map(
                      (item) => (
                        <div
                          key={
                            item.id
                          }
                        >
                          {item.quantity} ×{" "}
                          {
                            item.product
                              .name
                          }

                          {item.options
                            .length >
                            0 && (
                            <span>
                              {" · "}
                              {item.options
                                .map(
                                  (
                                    option,
                                  ) =>
                                    option.optionName,
                                )
                                .join(
                                  ", ",
                                )}
                            </span>
                          )}
                        </div>
                      ),
                    )}
                  </div>
                )}
              </div>

              <div className="actions-row">
                <strong>
                  $
                  {Number(
                    order.total,
                  ).toFixed(2)}
                </strong>

                {order.status ===
                "CONFIRMED" ? (
                  <form
                    action={
                      cancelOwnPreOrderFromForm
                    }
                  >
                    <input
                      type="hidden"
                      name="orderId"
                      value={
                        order.id
                      }
                    />

                    <button
                      className="danger small-button"
                      type="submit"
                    >
                      Cancel & Refund
                    </button>
                  </form>
                ) : null}
              </div>
            </div>
          ))}
        </div>
      </section>
    </main>
  );
}
