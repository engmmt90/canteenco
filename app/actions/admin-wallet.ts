"use server";

import { Prisma } from "@/generated/prisma/client";
import { revalidatePath } from "next/cache";

import { prisma } from "@/lib/prisma";
import { requireAdmin } from "@/lib/authz";

function str(
  formData: FormData,
  key: string,
) {
  return String(
    formData.get(key) ?? "",
  ).trim();
}

export async function addAdminWalletCredit(
  formData: FormData,
): Promise<void> {
  const session =
    await requireAdmin();

  const walletId = str(
    formData,
    "walletId",
  );

  const amountRaw = str(
    formData,
    "amount",
  );

  const note =
    str(formData, "note") ||
    "Admin wallet credit";

  if (!walletId) {
    throw new Error(
      "Wallet is required.",
    );
  }

  if (!amountRaw) {
    throw new Error(
      "Amount is required.",
    );
  }

  let amount: Prisma.Decimal;

  try {
    amount =
      new Prisma.Decimal(
        amountRaw,
      );
  } catch {
    throw new Error(
      "Invalid amount.",
    );
  }

  if (!amount.isFinite()) {
    throw new Error(
      "Invalid amount.",
    );
  }

  if (amount.lte(0)) {
    throw new Error(
      "Amount must be greater than zero.",
    );
  }

  if (amount.gt(100000)) {
    throw new Error(
      "Amount is too large.",
    );
  }

  await prisma.$transaction(
    async (tx) => {
      const wallet =
        await tx.wallet.findUnique({
          where: {
            id: walletId,
          },

          select: {
            id: true,
            balance: true,
            status: true,
            parentId: true,
          },
        });

      if (!wallet) {
        throw new Error(
          "Wallet not found.",
        );
      }

      if (
        wallet.status !==
        "ACTIVE"
      ) {
        throw new Error(
          "Wallet is not active.",
        );
      }

      const oldBalance =
        new Prisma.Decimal(
          wallet.balance,
        );

      const newBalance =
        oldBalance.add(amount);

      /*
       * Update only if the balance
       * is still the same value that
       * we originally read.
       *
       * This protects against two
       * simultaneous wallet updates.
       */
      const updated =
        await tx.wallet.updateMany({
          where: {
            id: wallet.id,
            balance: oldBalance,
          },

          data: {
            balance:
              newBalance,
          },
        });

      if (
        updated.count !== 1
      ) {
        throw new Error(
          "Wallet balance changed. Please try again.",
        );
      }

      /*
       * Record the wallet transaction.
       */
      await tx.walletTransaction.create(
        {
          data: {
            walletId:
              wallet.id,

            studentId:
              null,

            type: "TOP_UP",

            amount,

            balanceAfter:
              newBalance,

            description:
              note,

            saleId:
              null,

            preOrderId:
              null,

            refundOfSaleId:
              null,

            topUpRequestId:
              null,
          },
        },
      );

      /*
       * Record the admin action
       * in the audit log.
       */
      await tx.auditLog.create({
        data: {
          actorUserId:
            session.user.id,

          action:
            "ADMIN_WALLET_CREDIT",

          entityType:
            "Wallet",

          entityId:
            wallet.id,

          metadata: {
            amount:
              amount.toString(),

            balanceBefore:
              oldBalance.toString(),

            balanceAfter:
              newBalance.toString(),

            parentId:
              wallet.parentId,

            note,
          },
        },
      });
    },

    {
      isolationLevel:
        Prisma.TransactionIsolationLevel.Serializable,
    },
  );

  revalidatePath(
    "/admin/wallets",
  );
}