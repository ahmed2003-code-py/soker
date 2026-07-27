-- دفعة موزّعة (Split Payment): قيد واحد على الطرف + حركات خزنة متعددة مربوطة
CREATE TABLE IF NOT EXISTS "split_payments" (
  "id"         SERIAL       NOT NULL,
  "deleted_at" TIMESTAMP(3),
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "split_payments_pkey" PRIMARY KEY ("id")
);

ALTER TABLE "ledger_entries" ADD COLUMN IF NOT EXISTS "split_payment_id" INTEGER;
ALTER TABLE "treasury_txns"  ADD COLUMN IF NOT EXISTS "split_payment_id" INTEGER;

CREATE INDEX IF NOT EXISTS "ledger_entries_split_payment_id_idx" ON "ledger_entries"("split_payment_id");
CREATE INDEX IF NOT EXISTS "treasury_txns_split_payment_id_idx"  ON "treasury_txns"("split_payment_id");

DO $$ BEGIN
  ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_split_payment_id_fkey"
    FOREIGN KEY ("split_payment_id") REFERENCES "split_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "treasury_txns" ADD CONSTRAINT "treasury_txns_split_payment_id_fkey"
    FOREIGN KEY ("split_payment_id") REFERENCES "split_payments"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
