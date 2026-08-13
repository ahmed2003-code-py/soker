-- معرّف معاملة الاستلام من العميل — لتجميع الشيكات الواردة في نفس المعاملة (إضافي وآمن)
ALTER TABLE "cheques" ADD COLUMN IF NOT EXISTS "receipt_batch_id" INTEGER;
CREATE INDEX IF NOT EXISTS "cheques_receipt_batch_id_idx" ON "cheques"("receipt_batch_id");
