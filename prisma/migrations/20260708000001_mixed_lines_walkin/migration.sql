-- Add line_type to invoice_lines (SALE | RETURN, default SALE)
ALTER TABLE "invoice_lines" ADD COLUMN "line_type" TEXT NOT NULL DEFAULT 'SALE';

-- Data migration: mark all lines of CUSTOMER_RETURN invoices as RETURN
UPDATE "invoice_lines" il
SET "line_type" = 'RETURN'
FROM "invoices" i
WHERE il."invoice_id" = i."id" AND i."invoice_type" = 'CUSTOMER_RETURN';

-- Convert CUSTOMER_RETURN invoices to SALE type (returnness is now at line level)
UPDATE "invoices" SET "invoice_type" = 'SALE' WHERE "invoice_type" = 'CUSTOMER_RETURN';

-- Make customer_id nullable to support walk-in (one-time) customers
ALTER TABLE "invoices" ALTER COLUMN "customer_id" DROP NOT NULL;

-- Guest name for walk-in display on invoice printout
ALTER TABLE "invoices" ADD COLUMN "guest_name" TEXT;
