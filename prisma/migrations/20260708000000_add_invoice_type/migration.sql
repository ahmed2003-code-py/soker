-- Add invoice type (SALE | PURCHASE | SUPPLIER_RETURN) and external supplier reference
ALTER TABLE "invoices" ADD COLUMN "invoice_type" TEXT NOT NULL DEFAULT 'SALE';
ALTER TABLE "invoices" ADD COLUMN "external_ref" TEXT;
