-- AlterTable
ALTER TABLE "treasury_txns" ADD COLUMN     "sub_account_id" INTEGER;

-- CreateTable
CREATE TABLE "sub_accounts" (
    "id" SERIAL NOT NULL,
    "type" "TreasuryAccountType" NOT NULL,
    "name" TEXT NOT NULL,
    "balance" DECIMAL(18,4) NOT NULL DEFAULT 0,
    "is_active" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "sub_accounts_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "sub_accounts_type_idx" ON "sub_accounts"("type");

-- CreateIndex
CREATE UNIQUE INDEX "sub_accounts_type_name_key" ON "sub_accounts"("type", "name");

-- AddForeignKey
ALTER TABLE "treasury_txns" ADD CONSTRAINT "treasury_txns_sub_account_id_fkey" FOREIGN KEY ("sub_account_id") REFERENCES "sub_accounts"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- Seed default sub-accounts
INSERT INTO "sub_accounts" ("type", "name") VALUES
  ('INSTAPAY', 'أحمد سكر'),
  ('VODAFONE', 'أحمد سكر'),
  ('BANK',     'التجاري الدولي'),
  ('BANK',     'قطر الوطني'),
  ('BANK',     'مصر')
ON CONFLICT ("type", "name") DO NOTHING;

-- Assign existing INSTAPAY transactions to أحمد سكر
UPDATE "treasury_txns" tt
SET "sub_account_id" = sa."id"
FROM "sub_accounts" sa, "treasury_accounts" ta
WHERE tt."account_id" = ta."id"
  AND ta."type" = 'INSTAPAY'
  AND sa."type" = 'INSTAPAY'
  AND sa."name" = 'أحمد سكر'
  AND tt."sub_account_id" IS NULL;

-- Assign existing VODAFONE transactions to أحمد سكر
UPDATE "treasury_txns" tt
SET "sub_account_id" = sa."id"
FROM "sub_accounts" sa, "treasury_accounts" ta
WHERE tt."account_id" = ta."id"
  AND ta."type" = 'VODAFONE'
  AND sa."type" = 'VODAFONE'
  AND sa."name" = 'أحمد سكر'
  AND tt."sub_account_id" IS NULL;

-- Recompute sub-account balances from existing transactions
UPDATE "sub_accounts" sa
SET "balance" = COALESCE((
  SELECT SUM(CASE WHEN tt."kind" = 'INCOME' THEN tt."amount" ELSE -tt."amount" END)
  FROM "treasury_txns" tt
  WHERE tt."sub_account_id" = sa."id"
), 0);
