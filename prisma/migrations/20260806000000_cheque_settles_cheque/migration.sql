-- شيك وارد يُستخدم لتمويل تسوية شيك صادر (بلا أثر على دفتر الأستاذ)
ALTER TABLE "cheques" ADD COLUMN IF NOT EXISTS "settles_cheque_id" INTEGER;
CREATE INDEX IF NOT EXISTS "cheques_settles_cheque_id_idx" ON "cheques"("settles_cheque_id");
DO $$ BEGIN
  ALTER TABLE "cheques" ADD CONSTRAINT "cheques_settles_cheque_id_fkey"
    FOREIGN KEY ("settles_cheque_id") REFERENCES "cheques"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
