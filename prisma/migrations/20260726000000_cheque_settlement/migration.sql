-- تسوية الشيك الصادر على دفعات (المرحلة 3ب)
ALTER TYPE "ChequeStatus" ADD VALUE IF NOT EXISTS 'SETTLED';

ALTER TABLE "treasury_txns" ADD COLUMN IF NOT EXISTS "cheque_id" INTEGER;
CREATE INDEX IF NOT EXISTS "treasury_txns_cheque_id_idx" ON "treasury_txns"("cheque_id");

DO $$ BEGIN
  ALTER TABLE "treasury_txns" ADD CONSTRAINT "treasury_txns_cheque_id_fkey"
    FOREIGN KEY ("cheque_id") REFERENCES "cheques"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
