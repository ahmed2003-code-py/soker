-- المخزن: اللطات + سجل حركات المخزون + الحد الأدنى (كلها معطّلة حتى تفعيل متغير التشغيل)

-- CreateEnum
CREATE TYPE "StockMoveKind" AS ENUM ('OPENING', 'PURCHASE_IN', 'SALE_OUT', 'CUSTOMER_RETURN_IN', 'SUPPLIER_RETURN_OUT', 'ADJUST');
CREATE TYPE "GoodsDestination" AS ENUM ('WAREHOUSE', 'DIRECT');

-- CreateTable
CREATE TABLE "lots" (
    "id" SERIAL NOT NULL,
    "lot_no" TEXT NOT NULL,
    "category" TEXT NOT NULL,
    "color" TEXT NOT NULL,
    "company" TEXT,
    "qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "weight" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "received_at" TIMESTAMP(3) NOT NULL,
    "closed_at" TIMESTAMP(3),
    "notes" TEXT,
    "supplier_id" INTEGER,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lots_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_movements" (
    "id" SERIAL NOT NULL,
    "lot_id" INTEGER NOT NULL,
    "kind" "StockMoveKind" NOT NULL,
    "date" TIMESTAMP(3) NOT NULL,
    "qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "weight" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "balance_after_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "balance_after_weight" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "description" TEXT,
    "invoice_id" INTEGER,
    "invoice_line_id" INTEGER,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "deleted_at" TIMESTAMP(3),

    CONSTRAINT "stock_movements_pkey" PRIMARY KEY ("id")
);

CREATE TABLE "stock_minimums" (
    "id" SERIAL NOT NULL,
    "category" TEXT NOT NULL,
    "color" TEXT,
    "min_qty" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "min_weight" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "stock_minimums_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "goods_destination" "GoodsDestination";
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "stock_posted" BOOLEAN NOT NULL DEFAULT false;
ALTER TABLE "invoice_lines" ADD COLUMN IF NOT EXISTS "lot_id" INTEGER;

-- CreateIndex
CREATE UNIQUE INDEX "lots_category_color_lot_no_key" ON "lots"("category", "color", "lot_no");
CREATE INDEX "lots_category_color_idx" ON "lots"("category", "color");
CREATE INDEX "lots_received_at_idx" ON "lots"("received_at");
CREATE INDEX "lots_closed_at_idx" ON "lots"("closed_at");
CREATE INDEX "stock_movements_lot_id_date_idx" ON "stock_movements"("lot_id", "date");
CREATE INDEX "stock_movements_invoice_id_idx" ON "stock_movements"("invoice_id");
CREATE INDEX "stock_movements_kind_idx" ON "stock_movements"("kind");
CREATE UNIQUE INDEX "stock_minimums_category_color_key" ON "stock_minimums"("category", "color");
CREATE INDEX "invoice_lines_lot_id_idx" ON "invoice_lines"("lot_id");

-- AddForeignKey
ALTER TABLE "lots" ADD CONSTRAINT "lots_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "parties"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "lots" ADD CONSTRAINT "lots_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_invoice_id_fkey" FOREIGN KEY ("invoice_id") REFERENCES "invoices"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_invoice_line_id_fkey" FOREIGN KEY ("invoice_line_id") REFERENCES "invoice_lines"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "stock_movements" ADD CONSTRAINT "stock_movements_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_minimums" ADD CONSTRAINT "stock_minimums_created_by_id_fkey" FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "invoice_lines" ADD CONSTRAINT "invoice_lines_lot_id_fkey" FOREIGN KEY ("lot_id") REFERENCES "lots"("id") ON DELETE SET NULL ON UPDATE CASCADE;
