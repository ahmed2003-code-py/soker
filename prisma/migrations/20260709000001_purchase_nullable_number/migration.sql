-- فواتير الشراء لا تأخذ ترقيم السيستم — رقمها يدخله المستخدم من فاتورة المورد
ALTER TABLE "invoices" ALTER COLUMN "number" DROP NOT NULL;
UPDATE "invoices" SET "number" = NULL WHERE "invoice_type" = 'PURCHASE';
