"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

function str(f: FormData, k: string) {
  return String(f.get(k) ?? "").trim();
}

function bool(f: FormData, k: string) {
  return f.get(k) === "on";
}

export async function saveSchool(f: FormData) {
  const s = await requireAdmin();

  if (s.user.role !== "SUPER_ADMIN") {
    throw new Error("Super Admin only");
  }

  const id = str(f, "id");
  const name = str(f, "name");
  const code = str(f, "code").toUpperCase();
  const timezone =
    str(f, "timezone") || "Australia/Brisbane";

  if (!name || !code) {
    throw new Error(
      "School name and code are required",
    );
  }

  const data = {
    name,
    code,
    address: str(f, "address") || null,
    phone: str(f, "phone") || null,
    email: str(f, "email") || null,
    isActive: bool(f, "isActive"),
  };

  if (id) {
    await prisma.school.update({
      where: { id },
      data: {
        ...data,
        settings: {
          upsert: {
            create: { timezone },
            update: { timezone },
          },
        },
      },
    });
  } else {
    await prisma.school.create({
      data: {
        ...data,
        settings: {
          create: { timezone },
        },
      },
    });
  }

  revalidatePath("/admin/schools");
  revalidatePath("/admin");
}

export async function saveProduct(f: FormData) {
  await requireAdmin();

  const id = str(f, "id");
  const name = str(f, "name");
  const sku = str(f, "sku").toUpperCase();
  const price = Number(str(f, "price"));
  const sortOrder = Number(
    str(f, "sortOrder") || 0,
  );
  const imageUrl =
    str(f, "imageUrl") || null;

  if (
    !name ||
    !sku ||
    !Number.isFinite(price) ||
    price < 0
  ) {
    throw new Error(
      "Valid SKU, name and price are required",
    );
  }

  const data = {
    sku,
    name,
    description:
      str(f, "description") || null,
    category:
      str(f, "category") || null,
    price,
    imageUrl,
    sortOrder: Number.isFinite(sortOrder)
      ? sortOrder
      : 0,
    isActive: bool(f, "isActive"),
  };

  if (id) {
    await prisma.product.update({
      where: { id },
      data,
    });
  } else {
    await prisma.product.create({
      data,
    });
  }

  revalidatePath("/admin/products");
  revalidatePath("/cashier");
  redirect("/admin/products");
}

export async function saveStaff(f: FormData) {
  const session = await requireAdmin();

  const id = str(f, "id");

  const role = str(f, "role") as
    | "CASHIER"
    | "SCHOOL_ADMIN"
    | "STAFF";

  const schoolId = str(f, "schoolId");
  const nfcCardNumber =
    str(f, "nfcCardNumber") || null;

  if (
    ![
      "CASHIER",
      "SCHOOL_ADMIN",
      "STAFF",
    ].includes(role)
  ) {
    throw new Error("Invalid role");
  }

  if (
    session.user.role === "SCHOOL_ADMIN" &&
    session.user.schoolId !== schoolId
  ) {
    throw new Error(
      "You can manage only your school",
    );
  }

  if (!schoolId) {
    throw new Error("School is required");
  }

  const fullName = str(f, "fullName");
  const email = str(f, "email").toLowerCase();
  const phone = str(f, "phone") || null;
  const password = str(f, "password");

  if (!fullName || !email) {
    throw new Error(
      "Name and email are required",
    );
  }

  /*
   * Attendance school access is separate from
   * cashier login permission.
   *
   * SUPER_ADMIN can allow all schools or choose
   * specific schools.
   *
   * SCHOOL_ADMIN can only allow the staff member
   * to clock in at their own school.
   */
  const canWorkAllSchools =
    session.user.role === "SUPER_ADMIN"
      ? bool(f, "canWorkAllSchools")
      : false;

  const requestedSchoolIds =
    session.user.role === "SUPER_ADMIN"
      ? f
          .getAll("allowedSchoolIds")
          .map((value) =>
            String(value).trim(),
          )
          .filter(Boolean)
      : [schoolId];

  const allowedSchoolIds = [
    ...new Set([
      schoolId,
      ...requestedSchoolIds,
    ]),
  ];

  if (
    session.user.role === "SUPER_ADMIN" &&
    !canWorkAllSchools
  ) {
    const validSchools =
      await prisma.school.findMany({
        where: {
          id: {
            in: allowedSchoolIds,
          },
          deletedAt: null,
          isActive: true,
        },
        select: {
          id: true,
        },
      });

    if (
      validSchools.length !==
      allowedSchoolIds.length
    ) {
      throw new Error(
        "One or more attendance schools are invalid or inactive.",
      );
    }
  }

  if (nfcCardNumber) {
    const [staffWithCard, studentWithCard] =
      await Promise.all([
        prisma.user.findUnique({
          where: {
            nfcCardNumber,
          },
          select: {
            id: true,
          },
        }),

        prisma.student.findUnique({
          where: {
            nfcCardNumber,
          },
          select: {
            id: true,
          },
        }),
      ]);

    if (
      (staffWithCard &&
        staffWithCard.id !== id) ||
      studentWithCard
    ) {
      throw new Error(
        "This NFC card is already assigned to another user.",
      );
    }
  }

  if (id) {
    const existing =
      await prisma.user.findUnique({
        where: { id },
      });

    if (
      !existing ||
      ![
        "CASHIER",
        "SCHOOL_ADMIN",
        "STAFF",
      ].includes(existing.role)
    ) {
      throw new Error(
        "Staff member not found",
      );
    }

    if (
      session.user.role === "SCHOOL_ADMIN" &&
      existing.schoolId !==
        session.user.schoolId
    ) {
      throw new Error("Unauthorized");
    }

    await prisma.$transaction(
      async (tx) => {
        await tx.user.update({
          where: { id },
          data: {
            fullName,
            email,
            phone,
            nfcCardNumber,
            canWorkAllSchools,
            role,
            schoolId,
            status: bool(f, "isActive")
              ? "ACTIVE"
              : "DISABLED",
            ...(password
              ? {
                  passwordHash:
                    await bcrypt.hash(
                      password,
                      12,
                    ),
                }
              : {}),
          },
        });

        await tx.staffSchoolAccess.deleteMany({
          where: {
            userId: id,
          },
        });

        if (!canWorkAllSchools) {
          await tx.staffSchoolAccess.createMany({
            data: allowedSchoolIds.map(
              (allowedSchoolId) => ({
                userId: id,
                schoolId:
                  allowedSchoolId,
              }),
            ),
            skipDuplicates: true,
          });
        }
      },
    );
  } else {
    if (password.length < 8) {
      throw new Error(
        "Password must be at least 8 characters",
      );
    }

    await prisma.$transaction(
      async (tx) => {
        const created =
          await tx.user.create({
            data: {
              fullName,
              email,
              phone,
              nfcCardNumber,
              canWorkAllSchools,
              role,
              schoolId,
              status: bool(f, "isActive")
                ? "ACTIVE"
                : "DISABLED",
              passwordHash:
                await bcrypt.hash(
                  password,
                  12,
                ),
            },
          });

        if (!canWorkAllSchools) {
          await tx.staffSchoolAccess.createMany({
            data: allowedSchoolIds.map(
              (allowedSchoolId) => ({
                userId: created.id,
                schoolId:
                  allowedSchoolId,
              }),
            ),
            skipDuplicates: true,
          });
        }
      },
    );
  }

  revalidatePath("/admin/staff");
}
