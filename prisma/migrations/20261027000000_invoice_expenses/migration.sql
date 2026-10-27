-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "expenses_total" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- CreateTable
CREATE TABLE "invoice_expenses" (
    "id" SERIAL NOT NULL,
    "invoice_id" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "created_by_id" INTEGER,
    "updated_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "invoice_expenses_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "invoice_expenses_invoice_id_idx" ON "invoice_expenses"("invoice_id");

-- AddForeignKey
ALTER TABLE "invoice_expenses" ADD CONSTRAINT "invoice_expenses_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_expenses" ADD CONSTRAINT "invoice_expenses_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "invoice_expenses" ADD CONSTRAINT "invoice_expenses_updated_by_id_fkey" FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- مبلغ المصروف الإضافي موجب دائماً (حماية على مستوى القاعدة فوق تحقق Zod)
ALTER TABLE "invoice_expenses" ADD CONSTRAINT "invoice_expenses_amount_positive" CHECK ("amount" > 0);
