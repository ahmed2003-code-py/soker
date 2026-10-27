-- AlterTable
ALTER TABLE "invoices" ADD COLUMN     "payment_tracked" BOOLEAN NOT NULL DEFAULT false,
ADD COLUMN     "settled_at" TIMESTAMP(3),
ADD COLUMN     "settled_by_id" INTEGER,
ADD COLUMN     "write_off_amount" DECIMAL(18,4) NOT NULL DEFAULT 0;

-- AddForeignKey
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_settled_by_id_fkey" FOREIGN KEY ("settled_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;


-- مبلغ المسامحة لا يكون سالباً
ALTER TABLE "invoices" ADD CONSTRAINT "invoices_write_off_non_negative" CHECK ("write_off_amount" >= 0);

-- متابعة التحصيل للفواتير الجديدة فقط: فواتير الزائر (بيع بلا حساب، غير مباشرة) التي أُنشئت بعد
-- تشغيل ميزة «الفواتير المعلّقة» (وقت انتهاء migration 20261027000000_invoice_expenses).
-- الفواتير الأقدم محصّلة بالفعل خارج النظام ⇒ تبقى خارج المتابعة (payment_tracked = false).
-- created_at مخزّن UTC بلا منطقة زمنية؛ finished_at بمنطقة زمنية ⇒ نحوّله لـ UTC للمقارنة.
UPDATE "invoices" SET "payment_tracked" = true
WHERE "customer_id" IS NULL
  AND "invoice_type" = 'SALE'
  AND "direct_invoice_id" IS NULL
  AND "created_at" >= (
    SELECT "finished_at" AT TIME ZONE 'UTC' FROM "_prisma_migrations"
    WHERE "migration_name" = '20261027000000_invoice_expenses' AND "finished_at" IS NOT NULL
    ORDER BY "finished_at" ASC LIMIT 1
  );
