import Link from "next/link";

import { requireParent } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import { getBlockedSchoolIdsByProduct } from "@/lib/product-availability";
import { getProductOptionQuantitySettings } from "@/lib/product-option-quantity";
import { getBlockedSchoolIdsByProductOption } from "@/lib/product-option-availability";
import {
  getSchoolPreOrderDaySettings,
  weekdayFromDateString,
} from "@/lib/school-preorder-days";
import PreOrderForm from "./preorder-form";
import { cancelOwnPreOrderFromForm } from "@/app/actions/preorders";

function getPickupDayOptions(
  timeZone: string,
  cutoffTime: string,
) {
  const parts =
    new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hour12: false,
    }).formatToParts(new Date());

  const get = (type: string) =>
    parts.find((part) => part.type === type)
      ?.value ?? "";

  const today =
    `${get("year")}-${get("month")}-${get("day")}`;
  const time =
    `${get("hour")}:${get("minute")}`;

  const [year, month, day] =
    today.split("-").map(Number);

  const tomorrowDate =
    new Date(
      Date.UTC(year, month - 1, day + 1),
    );

  const tomorrow =
    `${tomorrowDate.getUTCFullYear()}-${String(
      tomorrowDate.getUTCMonth() + 1,
    ).padStart(2, "0")}-${String(
      tomorrowDate.getUTCDate(),
    ).padStart(2, "0")}`;

  return {
    today,
    tomorrow,
    todayAvailable: time < cutoffTime,
  };
}

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
            school: {
              isActive: true,
              deletedAt: null,
            },
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
                    startTime: "asc",
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

  const [
    products,
    blockedRows,
    blockedOptionRows,
    quantitySettings,
  ] = await Promise.all([
      prisma.product.findMany({
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
      }),
      getBlockedSchoolIdsByProduct(),
      getBlockedSchoolIdsByProductOption(),
      getProductOptionQuantitySettings(),
    ]);

  const blockedSchoolIdsByProduct =
    new Map<string, string[]>();

  for (const row of blockedRows) {
    const current =
      blockedSchoolIdsByProduct.get(
        row.productId,
      ) ?? [];

    current.push(row.schoolId);
    blockedSchoolIdsByProduct.set(
      row.productId,
      current,
    );
  }

  const blockedSchoolIdsByOption =
    new Map<string, string[]>();

  for (const row of blockedOptionRows) {
    const current =
      blockedSchoolIdsByOption.get(
        row.optionId,
      ) ?? [];

    current.push(row.schoolId);

    blockedSchoolIdsByOption.set(
      row.optionId,
      current,
    );
  }

  const schoolIds = [
    ...new Set(
      (parent?.students ?? []).map(
        (student) => student.schoolId,
      ),
    ),
  ];

  const preOrderDaysBySchool =
    new Map<
      string,
      Map<number, boolean>
    >();

  await Promise.all(
    schoolIds.map(async (schoolId) => {
      preOrderDaysBySchool.set(
        schoolId,
        await getSchoolPreOrderDaySettings(
          schoolId,
        ),
      );
    }),
  );

  const data = {
    walletBalance: Number(
      parent?.wallet?.balance ?? 0,
    ),

    students: (
      parent?.students ?? []
    ).map((student) => {
      const cutoffTime =
        student.school.settings
          ?.preOrderCutoffTime ??
        "07:00";

      const pickupDays =
        getPickupDayOptions(
          student.school.settings
            ?.timezone ??
            "Australia/Brisbane",
          cutoffTime,
        );

      const availableDays =
        preOrderDaysBySchool.get(
          student.schoolId,
        );

      const todayEnabled =
        availableDays?.get(
          weekdayFromDateString(
            pickupDays.today,
          ),
        ) ?? true;

      const tomorrowEnabled =
        availableDays?.get(
          weekdayFromDateString(
            pickupDays.tomorrow,
          ),
        ) ?? true;

      return {
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

      pickupToday:
        pickupDays.today,

      pickupTomorrow:
        pickupDays.tomorrow,

      todayAvailable:
        pickupDays.todayAvailable &&
        todayEnabled,

      tomorrowAvailable:
        tomorrowEnabled,

      pickupSlots:
        student.school.pickupSlots.map(
          (slot) => ({
            id: slot.id,
            label: slot.label,
          }),
        ),
      };
    }),

    products: products.map(
      (product) => ({
        id: product.id,

        name: product.name,

        price: Number(
          product.price,
        ),

        category:
          product.category,

        imageUrl:
          product.imageUrl,

        blockedSchoolIds:
          blockedSchoolIdsByProduct.get(
            product.id,
          ) ?? [],

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

                    quantityEnabled:
                      quantitySettings.get(
                        option.id,
                      ) ?? true,

                    blockedSchoolIds:
                      blockedSchoolIdsByOption.get(
                        option.id,
                      ) ?? [],
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
