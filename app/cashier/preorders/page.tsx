import { requireCashier } from "@/lib/authz";
import { prisma } from "@/lib/prisma";
import PreOrderQueue from "./preorder-queue";

export default async function CashierPreOrdersPage() {
  const session = await requireCashier();

  const where: any = {
    status: {
      in: [
        "CONFIRMED",
        "PREPARING",
        "READY",
      ],
    },
  };

  if (
    session.user.role !== "SUPER_ADMIN" &&
    session.user.schoolId
  ) {
    where.schoolId = session.user.schoolId;
  }

  const orders =
    await prisma.preOrder.findMany({
      where,

      include: {
        student: true,
        school: true,
        pickupSlot: true,

        items: {
          include: {
            product: true,
          },
        },
      },

      orderBy: [
        {
          pickupDate: "asc",
        },
        {
          pickupSlot: {
            sortOrder: "asc",
          },
        },
        {
          createdAt: "asc",
        },
      ],
    });

  const plain = orders.map((order) => ({
    id: order.id,

    orderNumber: order.orderNumber,

    status: order.status,

    pickupDate:
      order.pickupDate.toISOString(),

    total: Number(order.total),

    labelPrintedAt:
      order.labelPrintedAt
        ? order.labelPrintedAt.toISOString()
        : null,

    student: {
      id: order.student.id,

      firstName:
        order.student.firstName,

      lastName:
        order.student.lastName,

      displayCode:
        order.student.displayCode,

      classCode:
        order.student.classCode,

      nfcCardNumber:
        order.student.nfcCardNumber,
    },

    schoolName:
      order.school.name,

    pickupSlot: {
      label:
        order.pickupSlot.label,
    },

    items: order.items.map((item) => ({
      id: item.id,

      name: item.product.name,

      quantity: item.quantity,
    })),
  }));

  return (
    <PreOrderQueue
      initialOrders={plain}
    />
  );
}