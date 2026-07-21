-- عميل مؤقت (Temporary Customer): علم مؤقت + وقت أرشفة تلقائية عند تصفية الرصيد
ALTER TABLE "parties" ADD COLUMN IF NOT EXISTS "is_temporary" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "parties" ADD COLUMN IF NOT EXISTS "archived_at" TIMESTAMP(3);

CREATE INDEX IF NOT EXISTS "parties_is_temporary_archived_at_idx" ON "parties"("is_temporary", "archived_at");
