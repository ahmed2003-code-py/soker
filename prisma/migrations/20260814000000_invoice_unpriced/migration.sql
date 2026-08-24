-- فاتورة غير مسعّرة (إضافي وآمن)
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "unpriced" BOOLEAN NOT NULL DEFAULT false;
