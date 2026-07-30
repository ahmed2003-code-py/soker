-- أثر الطرف للشيك (المرحلة 2): مرجع قيد دفتر الأستاذ المُنشأ عند الاستلام/التسليم
ALTER TABLE "cheques" ADD COLUMN IF NOT EXISTS "party_ledger_entry_id" INTEGER;
CREATE INDEX IF NOT EXISTS "cheques_party_ledger_entry_id_idx" ON "cheques"("party_ledger_entry_id");
