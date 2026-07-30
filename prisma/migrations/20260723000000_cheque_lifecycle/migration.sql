-- دورة حياة الشيك (المرحلة 1): حالات جديدة + ربط اختياري بالطرف
ALTER TYPE "ChequeStatus" ADD VALUE IF NOT EXISTS 'REGISTERED';
ALTER TYPE "ChequeStatus" ADD VALUE IF NOT EXISTS 'DEPOSITED';
ALTER TYPE "ChequeStatus" ADD VALUE IF NOT EXISTS 'ENDORSED';
ALTER TYPE "ChequeStatus" ADD VALUE IF NOT EXISTS 'CANCELLED';

ALTER TABLE "cheques" ADD COLUMN IF NOT EXISTS "party_id" INTEGER;
CREATE INDEX IF NOT EXISTS "cheques_party_id_idx" ON "cheques"("party_id");

DO $$ BEGIN
  ALTER TABLE "cheques" ADD CONSTRAINT "cheques_party_id_fkey"
    FOREIGN KEY ("party_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
