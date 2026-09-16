BEGIN;

CREATE TYPE "SaleCustomerType" AS ENUM ('STUDENT', 'GUEST');

CREATE TYPE "SalePaymentMethod" AS ENUM ('WALLET', 'CASH', 'CARD');

ALTER TABLE "Sale"
DROP CONSTRAINT "Sale_studentId_fkey";

ALTER TABLE "Sale"
DROP CONSTRAINT "Sale_walletId_fkey";

ALTER TABLE "Sale"
ADD COLUMN "customerType" "SaleCustomerType" NOT NULL DEFAULT 'STUDENT',
ADD COLUMN "paymentMethod" "SalePaymentMethod" NOT NULL DEFAULT 'WALLET',
ALTER COLUMN "studentId" DROP NOT NULL,
ALTER COLUMN "walletId" DROP NOT NULL;

CREATE INDEX "Sale_customerType_createdAt_idx"
ON "Sale"("customerType", "createdAt");

CREATE INDEX "Sale_paymentMethod_createdAt_idx"
ON "Sale"("paymentMethod", "createdAt");

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_studentId_fkey"
FOREIGN KEY ("studentId")
REFERENCES "Student"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

ALTER TABLE "Sale"
ADD CONSTRAINT "Sale_walletId_fkey"
FOREIGN KEY ("walletId")
REFERENCES "Wallet"("id")
ON DELETE SET NULL
ON UPDATE CASCADE;

COMMIT;
