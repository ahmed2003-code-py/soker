-- الفاتورة المباشرة (مورد ← عميل): فاتورتان مربوطتان بنفس المجموعة

-- CreateTable
CREATE TABLE "direct_invoices" (
    "id" SERIAL NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "direct_invoices_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "direct_invoice_id" INTEGER;

-- CreateIndex
CREATE INDEX "invoices_direct_invoice_id_idx" ON "invoices"("direct_invoice_id");

-- AddForeignKey
ALTER TABLE "invoices"
    ADD CONSTRAINT "invoices_direct_invoice_id_fkey"
    FOREIGN KEY ("direct_invoice_id") REFERENCES "direct_invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
