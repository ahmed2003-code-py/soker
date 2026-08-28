-- المصروفات الشهرية: بنود متكررة + بند لكل شهر (مقرر + مرحَّل) + ربط حركات الخزنة بها

-- CreateTable
CREATE TABLE "monthly_expense_items" (
    "id" SERIAL NOT NULL,
    "name" TEXT NOT NULL,
    "default_amount" DECIMAL(18,4) NOT NULL,
    "active" BOOLEAN NOT NULL DEFAULT true,
    "notes" TEXT,
    "created_by_id" INTEGER NOT NULL,
    "updated_by_id" INTEGER,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_expense_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "monthly_expense_periods" (
    "id" SERIAL NOT NULL,
    "item_id" INTEGER NOT NULL,
    "year" INTEGER NOT NULL,
    "month" INTEGER NOT NULL,
    "amount" DECIMAL(18,4) NOT NULL,
    "carried_in" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "notes" TEXT,
    "created_by_id" INTEGER NOT NULL,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "monthly_expense_periods_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "treasury_txns" ADD COLUMN IF NOT EXISTS "monthly_expense_period_id" INTEGER;

-- CreateIndex
CREATE INDEX "monthly_expense_items_active_idx" ON "monthly_expense_items"("active");
CREATE UNIQUE INDEX "monthly_expense_periods_item_id_year_month_key" ON "monthly_expense_periods"("item_id", "year", "month");
CREATE INDEX "monthly_expense_periods_year_month_idx" ON "monthly_expense_periods"("year", "month");
CREATE INDEX "treasury_txns_monthly_expense_period_id_idx" ON "treasury_txns"("monthly_expense_period_id");

-- AddForeignKey
ALTER TABLE "monthly_expense_items"
    ADD CONSTRAINT "monthly_expense_items_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "monthly_expense_items"
    ADD CONSTRAINT "monthly_expense_items_updated_by_id_fkey"
    FOREIGN KEY ("updated_by_id") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
ALTER TABLE "monthly_expense_periods"
    ADD CONSTRAINT "monthly_expense_periods_item_id_fkey"
    FOREIGN KEY ("item_id") REFERENCES "monthly_expense_items"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "monthly_expense_periods"
    ADD CONSTRAINT "monthly_expense_periods_created_by_id_fkey"
    FOREIGN KEY ("created_by_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "treasury_txns"
    ADD CONSTRAINT "treasury_txns_monthly_expense_period_id_fkey"
    FOREIGN KEY ("monthly_expense_period_id") REFERENCES "monthly_expense_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;
