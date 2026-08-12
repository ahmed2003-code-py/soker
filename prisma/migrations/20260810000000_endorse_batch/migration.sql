-- معرّف معاملة التظهير — لتجميع الشيكات المُظهَّرة في نفس المعاملة (إضافي وآمن)
ALTER TABLE "cheques" ADD COLUMN IF NOT EXISTS "endorse_batch_id" INTEGER;
CREATE INDEX IF NOT EXISTS "cheques_endorse_batch_id_idx" ON "cheques"("endorse_batch_id");
