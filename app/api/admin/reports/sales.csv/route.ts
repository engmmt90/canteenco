import {
  NextRequest,
  NextResponse,
} from "next/server";

import { auth } from "@/auth";
import {
  SalePaymentMethod,
} from "@/generated/prisma/client";
import { prisma } from "@/lib/prisma";

function csv(value: unknown) {
  const text = String(
    value ?? "",
  );

  return `"${text.replaceAll(
    '"',
    '""',
  )}"`;
}

function parsePaymentMethod(
  value: string | null,
): SalePaymentMethod | undefined {
  if (
    value ===
      SalePaymentMethod.WALLET ||
    value ===
      SalePaymentMethod.CASH ||
    value ===
      SalePaymentMethod.CARD
  ) {
    return value;
  }

  return undefined;
}

export async function GET(
  req: NextRequest,
) {
  const session = await auth();

  if (
    !session?.user ||
    ![
      "SUPER_ADMIN",
      "SCHOOL_ADMIN",
    ].includes(session.user.role)
  ) {
    return NextResponse.json(
      {
        error: "Unauthorized",
      },
      {
        status: 401,
      },
    );
  }

  const requestedSchool =
    req.nextUrl.searchParams.get(
      "school",
    ) || undefined;

  const paymentMethod =
    parsePaymentMethod(
      req.nextUrl.searchParams.get(
        "paymentMethod",
      ),
    );

  const schoolId =
    session.user.role ===
    "SCHOOL_ADMIN"
      ? session.user.schoolId
      : requestedSchool;

  const sales =
    await prisma.sale.findMany({
      where: {
        ...(schoolId
          ? {
              schoolId,
            }
          : {}),

        ...(paymentMethod
          ? {
              paymentMethod,
            }
          : {}),

        status: "COMPLETED",
      },

      include: {
        student: true,
        school: true,
        cashier: true,
      },

      orderBy: {
        createdAt: "desc",
      },

      take: 10000,
    });

  const rows = [
    [
      "Sale Number",
      "Date",
      "School",
      "Customer Type",
      "Customer",
      "Student Code",
      "Payment Method",
      "Cashier",
      "Total",
    ],

    ...sales.map(
      (sale) => [
        sale.saleNumber,
        sale.createdAt.toISOString(),
        sale.school.name,
        sale.customerType,
        sale.student
          ? `${sale.student.firstName} ${sale.student.lastName}`
          : "Guest / Walk-in",
        sale.student?.displayCode ??
          "GUEST",
        sale.paymentMethod,
        sale.cashier.fullName,
        sale.total.toFixed(2),
      ],
    ),
  ];

  const body = rows
    .map((row) =>
      row.map(csv).join(","),
    )
    .join("\n");

  return new NextResponse(body, {
    headers: {
      "Content-Type":
        "text/csv; charset=utf-8",
      "Content-Disposition":
        'attachment; filename="canteenco-sales.csv"',
    },
  });
}
