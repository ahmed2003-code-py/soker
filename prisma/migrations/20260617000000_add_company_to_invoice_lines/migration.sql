-- AlterTable: add optional company column to invoice_lines
ALTER TABLE "invoice_lines" ADD COLUMN "company" TEXT;
