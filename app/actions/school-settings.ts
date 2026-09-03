"use server";

import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

function str(
  f: FormData,
  k: string,
) {
  return String(
    f.get(k) ?? "",
  ).trim();
}

function bool(
  f: FormData,
  k: string,
) {
  return f.get(k) === "on";
}

async function assertSchoolAccess(
  schoolId: string,
) {
  const session =
    await requireAdmin();

  if (
    session.user.role ===
      "SCHOOL_ADMIN" &&
    session.user.schoolId !==
      schoolId
  ) {
    throw new Error(
      "Unauthorized",
    );
  }

  return session;
}

export async function saveSchoolSettings(
  f: FormData,
) {
  const schoolId =
    str(f, "schoolId");

  if (!schoolId) {
    throw new Error(
      "School is required",
    );
  }

  await assertSchoolAccess(
    schoolId,
  );

  const minimum =
    Number(
      str(
        f,
        "minimumAllowedBalance",
      ) || "0",
    );

  if (
    !Number.isFinite(minimum) ||
    minimum > 0 ||
    minimum < -1000
  ) {
    throw new Error(
      "Minimum balance must be between -1000 and 0",
    );
  }

  const cutoff =
    str(
      f,
      "preOrderCutoffTime",
    ) || "07:00";

  if (
    !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(
      cutoff,
    )
  ) {
    throw new Error(
      "Invalid cutoff time",
    );
  }

  await prisma.schoolSettings.upsert({
    where: {
      schoolId,
    },

    create: {
      schoolId,

      timezone:
        str(f, "timezone") ||
        "Australia/Brisbane",

      currency:
        str(f, "currency") ||
        "AUD",

      preOrderEnabled:
        bool(
          f,
          "preOrderEnabled",
        ),

      preOrderCutoffTime:
        cutoff,

      allowNegativeBalance:
        bool(
          f,
          "allowNegativeBalance",
        ),

      minimumAllowedBalance:
        minimum,

      emailNotificationsEnabled:
        bool(
          f,
          "emailNotificationsEnabled",
        ),

      smsNotificationsEnabled:
        bool(
          f,
          "smsNotificationsEnabled",
        ),
    },

    update: {
      timezone:
        str(f, "timezone") ||
        "Australia/Brisbane",

      currency:
        str(f, "currency") ||
        "AUD",

      preOrderEnabled:
        bool(
          f,
          "preOrderEnabled",
        ),

      preOrderCutoffTime:
        cutoff,

      allowNegativeBalance:
        bool(
          f,
          "allowNegativeBalance",
        ),

      minimumAllowedBalance:
        minimum,

      emailNotificationsEnabled:
        bool(
          f,
          "emailNotificationsEnabled",
        ),

      smsNotificationsEnabled:
        bool(
          f,
          "smsNotificationsEnabled",
        ),
    },
  });

  revalidatePath(
    `/admin/schools/${schoolId}/settings`,
  );

  revalidatePath(
    "/admin/schools",
  );
}

export async function saveSchoolLogo(
  f: FormData,
) {
  const schoolId =
    str(f, "schoolId");

  if (!schoolId) {
    throw new Error(
      "School is required",
    );
  }

  await assertSchoolAccess(
    schoolId,
  );

  const value =
    f.get("logo");

  if (
    !(value instanceof File) ||
    value.size === 0
  ) {
    throw new Error(
      "Please choose a logo file.",
    );
  }

  const allowedTypes =
    new Set([
      "image/png",
      "image/jpeg",
    ]);

  if (
    !allowedTypes.has(
      value.type,
    )
  ) {
    throw new Error(
      "Logo must be a PNG or JPG image.",
    );
  }

  const maxBytes =
    500 * 1024;

  if (
    value.size > maxBytes
  ) {
    throw new Error(
      "Logo must be 500 KB or smaller.",
    );
  }

  const bytes =
    Buffer.from(
      await value.arrayBuffer(),
    );

  await prisma.schoolSettings.upsert({
    where: {
      schoolId,
    },

    create: {
      schoolId,
      logoData: bytes,
      logoMimeType:
        value.type,
    },

    update: {
      logoData: bytes,
      logoMimeType:
        value.type,
    },
  });

  revalidatePath(
    `/admin/schools/${schoolId}/settings`,
  );

  revalidatePath(
    `/api/schools/${schoolId}/logo`,
  );

  revalidatePath(
    "/admin/wallets",
  );
}

export async function removeSchoolLogo(
  f: FormData,
) {
  const schoolId =
    str(f, "schoolId");

  if (!schoolId) {
    throw new Error(
      "School is required",
    );
  }

  await assertSchoolAccess(
    schoolId,
  );

  await prisma.schoolSettings.upsert({
    where: {
      schoolId,
    },

    create: {
      schoolId,
      logoData: null,
      logoMimeType: null,
    },

    update: {
      logoData: null,
      logoMimeType: null,
    },
  });

  revalidatePath(
    `/admin/schools/${schoolId}/settings`,
  );

  revalidatePath(
    `/api/schools/${schoolId}/logo`,
  );

  revalidatePath(
    "/admin/wallets",
  );
}

export async function addPickupSlot(
  f: FormData,
) {
  const schoolId =
    str(f, "schoolId");

  await assertSchoolAccess(
    schoolId,
  );

  const label =
    str(f, "label");

  const startTime =
    str(f, "startTime");

  const endTime =
    str(f, "endTime");

  const sortOrder =
    Number(
      str(f, "sortOrder") ||
        0,
    );

  if (!label) {
    throw new Error(
      "Label is required",
    );
  }

  for (const t of [
    startTime,
    endTime,
  ]) {
    if (
      !/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(
        t,
      )
    ) {
      throw new Error(
        "Invalid pickup time",
      );
    }
  }

  if (
    startTime >= endTime
  ) {
    throw new Error(
      "End time must be after start time",
    );
  }

  await prisma.pickupSlot.create({
    data: {
      schoolId,
      label,
      startTime,
      endTime,

      sortOrder:
        Number.isFinite(
          sortOrder,
        )
          ? sortOrder
          : 0,

      isActive: true,
    },
  });

  revalidatePath(
    `/admin/schools/${schoolId}/settings`,
  );
}

export async function togglePickupSlot(
  f: FormData,
) {
  const id =
    str(f, "id");

  const slot =
    await prisma.pickupSlot.findUnique({
      where: {
        id,
      },
    });

  if (!slot) {
    throw new Error(
      "Pickup slot not found",
    );
  }

  await assertSchoolAccess(
    slot.schoolId,
  );

  await prisma.pickupSlot.update({
    where: {
      id,
    },

    data: {
      isActive:
        !slot.isActive,
    },
  });

  revalidatePath(
    `/admin/schools/${slot.schoolId}/settings`,
  );
}

export async function deletePickupSlot(
  f: FormData,
) {
  const id =
    str(f, "id");

  const slot =
    await prisma.pickupSlot.findUnique({
      where: {
        id,
      },

      include: {
        _count: {
          select: {
            preOrders: true,
          },
        },
      },
    });

  if (!slot) {
    throw new Error(
      "Pickup slot not found",
    );
  }

  await assertSchoolAccess(
    slot.schoolId,
  );

  if (
    slot._count.preOrders >
    0
  ) {
    await prisma.pickupSlot.update({
      where: {
        id,
      },

      data: {
        isActive: false,
      },
    });
  } else {
    await prisma.pickupSlot.delete({
      where: {
        id,
      },
    });
  }

  revalidatePath(
    `/admin/schools/${slot.schoolId}/settings`,
  );
}