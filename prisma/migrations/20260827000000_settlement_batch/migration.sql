-- معاملة السداد المركّب: تجمع الشيكات المُظهَّرة + الدفعة الموزّعة (نقدي/تحويلات) في معاملة واحدة

-- CreateTable
CREATE TABLE "settlement_batches" (
    "id" SERIAL NOT NULL,
    "party_id" INTEGER NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "note" TEXT,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "settlement_batches_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "cheques" ADD COLUMN IF NOT EXISTS "settlement_batch_id" INTEGER;
ALTER TABLE "split_payments" ADD COLUMN IF NOT EXISTS "settlement_batch_id" INTEGER;

-- CreateIndex
CREATE INDEX "settlement_batches_party_id_idx" ON "settlement_batches"("party_id");
CREATE INDEX "cheques_settlement_batch_id_idx" ON "cheques"("settlement_batch_id");
CREATE INDEX "split_payments_settlement_batch_id_idx" ON "split_payments"("settlement_batch_id");

-- AddForeignKey
ALTER TABLE "settlement_batches"
    ADD CONSTRAINT "settlement_batches_party_id_fkey"
    FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "settlement_batches"
    ADD CONSTRAINT "settlement_batches_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "cheques"
    ADD CONSTRAINT "cheques_settlement_batch_id_fkey"
    FOREIGN KEY ("settlement_batch_id") REFERENCES "settlement_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "split_payments"
    ADD CONSTRAINT "split_payments_settlement_batch_id_fkey"
    FOREIGN KEY ("settlement_batch_id") REFERENCES "settlement_batches"("id") ON DELETE SET NULL ON UPDATE CASCADE;
