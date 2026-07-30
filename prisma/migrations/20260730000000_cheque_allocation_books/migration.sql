-- المرحلة 4-5: توزيع الشيك على فواتير + دفاتر/حافظات الشيكات (إضافي وآمن)

-- الأعمدة الجديدة على الشيك (دفتر/ورقة)
ALTER TABLE "cheques" ADD COLUMN IF NOT EXISTS "cheque_book_id" INTEGER;
ALTER TABLE "cheques" ADD COLUMN IF NOT EXISTS "book_leaf_no" INTEGER;
CREATE INDEX IF NOT EXISTS "cheques_cheque_book_id_idx" ON "cheques"("cheque_book_id");

-- جدول توزيع الشيك على الفواتير (المرحلة 4)
CREATE TABLE IF NOT EXISTS "cheque_invoice_allocations" (
  "id" SERIAL NOT NULL,
  "cheque_id" INTEGER NOT NULL,
  "invoice_id" INTEGER NOT NULL,
  "amount" DECIMAL(18,4) NOT NULL,
  "created_by_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cheque_invoice_allocations_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX IF NOT EXISTS "cheque_invoice_allocations_cheque_id_invoice_id_key" ON "cheque_invoice_allocations"("cheque_id", "invoice_id");
CREATE INDEX IF NOT EXISTS "cheque_invoice_allocations_invoice_id_idx" ON "cheque_invoice_allocations"("invoice_id");

-- جدول الدفاتر/الحافظات (المرحلة 5)
CREATE TABLE IF NOT EXISTS "cheque_books" (
  "id" SERIAL NOT NULL,
  "name" TEXT NOT NULL,
  "direction" "ChequeDirection" NOT NULL DEFAULT 'OUTGOING',
  "bank_name" TEXT,
  "start_no" INTEGER,
  "end_no" INTEGER,
  "notes" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_by_id" INTEGER NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cheque_books_pkey" PRIMARY KEY ("id")
);
CREATE INDEX IF NOT EXISTS "cheque_books_direction_idx" ON "cheque_books"("direction");
CREATE INDEX IF NOT EXISTS "cheque_books_is_active_idx" ON "cheque_books"("is_active");

-- المفاتيح الأجنبية (تُتجاهَل لو موجودة)
DO $$ BEGIN
  ALTER TABLE "cheques" ADD CONSTRAINT "cheques_cheque_book_id_fkey"
    FOREIGN KEY ("cheque_book_id") REFERENCES "cheque_books"("id") ON DELETE SET NULL ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cheque_invoice_allocations" ADD CONSTRAINT "cheque_invoice_allocations_cheque_id_fkey"
    FOREIGN KEY ("cheque_id") REFERENCES "cheques"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cheque_invoice_allocations" ADD CONSTRAINT "cheque_invoice_allocations_invoice_id_fkey"
    FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE CASCADE ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cheque_invoice_allocations" ADD CONSTRAINT "cheque_invoice_allocations_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  ALTER TABLE "cheque_books" ADD CONSTRAINT "cheque_books_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
