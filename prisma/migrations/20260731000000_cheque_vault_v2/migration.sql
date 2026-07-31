-- نموذج خزنة الشيكات (النسخة 2) للشيكات الواردة — إضافي وآمن.
-- الشيكات الموجودة وقت الترحيل = النسخة القديمة (1)؛ أي شيك جديد = النسخة 2 (الافتراضي).

ALTER TABLE "cheques" ADD COLUMN IF NOT EXISTS "accounting_version" INTEGER NOT NULL DEFAULT 2;
ALTER TABLE "cheques" ADD COLUMN IF NOT EXISTS "cancel_reason" TEXT;
ALTER TABLE "cheques" ADD COLUMN IF NOT EXISTS "cancelled_at" TIMESTAMP(3);

-- كل الشيكات الحالية تبقى على النموذج القديم (لا تغيير في أثرها)
UPDATE "cheques" SET "accounting_version" = 1 WHERE "created_at" < NOW();
