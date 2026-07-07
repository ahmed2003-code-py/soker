-- AddColumn shareToken to invoices
ALTER TABLE "invoices" ADD COLUMN "share_token" TEXT;

-- Generate UUID tokens for all existing invoices
UPDATE "invoices" SET "share_token" = gen_random_uuid()::text WHERE "share_token" IS NULL;

-- Make unique index
CREATE UNIQUE INDEX "invoices_share_token_key" ON "invoices"("share_token");
