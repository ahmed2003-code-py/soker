-- تظهير الشيك الوارد لمورد (المرحلة 3أ)
ALTER TABLE "cheques" ADD COLUMN IF NOT EXISTS "endorse_ledger_entry_id" INTEGER;
ALTER TABLE "cheques" ADD COLUMN IF NOT EXISTS "endorsed_to_id" INTEGER;

CREATE INDEX IF NOT EXISTS "cheques_endorsed_to_id_idx" ON "cheques"("endorsed_to_id");

DO $$ BEGIN
  ALTER TABLE "cheques" ADD CONSTRAINT "cheques_endorsed_to_id_fkey"
    FOREIGN KEY ("endorsed_to_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
