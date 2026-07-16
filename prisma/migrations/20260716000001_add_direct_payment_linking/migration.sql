-- CreateTable
CREATE TABLE "direct_payments" (
    "id" SERIAL NOT NULL,
    "deleted_at" TIMESTAMP(3),
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direct_payments_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "ledger_entries"
    ADD COLUMN "direct_payment_id" INTEGER;

-- AlterTable
ALTER TABLE "treasury_txns"
    ADD COLUMN "direct_payment_id" INTEGER;

-- CreateIndex
CREATE INDEX "ledger_entries_direct_payment_id_idx" ON "ledger_entries"("direct_payment_id");

-- CreateIndex
CREATE INDEX "treasury_txns_direct_payment_id_idx" ON "treasury_txns"("direct_payment_id");

-- AddForeignKey
ALTER TABLE "ledger_entries"
    ADD CONSTRAINT "ledger_entries_direct_payment_id_fkey"
    FOREIGN KEY ("direct_payment_id") REFERENCES "direct_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "treasury_txns"
    ADD CONSTRAINT "treasury_txns_direct_payment_id_fkey"
    FOREIGN KEY ("direct_payment_id") REFERENCES "direct_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
