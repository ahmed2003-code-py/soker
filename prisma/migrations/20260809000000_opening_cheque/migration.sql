-- شيك افتتاحي (محسوب ضمن الرصيد الافتتاحي) — إضافي وآمن
ALTER TABLE "cheques" ADD COLUMN IF NOT EXISTS "is_opening" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "cheques" ADD COLUMN IF NOT EXISTS "opening_baseline" "ChequeStatus";
ALTER TABLE "cheques" ADD COLUMN IF NOT EXISTS "opening_account_id" INTEGER;
ALTER TABLE "cheques" ADD COLUMN IF NOT EXISTS "opening_sub_account_id" INTEGER;
CREATE INDEX IF NOT EXISTS "cheques_is_opening_idx" ON "cheques"("is_opening");
DO $$ BEGIN
  ALTER TABLE "cheques" ADD CONSTRAINT "cheques_opening_account_id_fkey"
    FOREIGN KEY ("opening_account_id") REFERENCES "treasury_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "cheques" ADD CONSTRAINT "cheques_opening_sub_account_id_fkey"
    FOREIGN KEY ("opening_sub_account_id") REFERENCES "sub_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
