-- Soft delete: add deleted_at to treasury_txns and ledger_entries
-- Records are never physically removed; queries filter WHERE deleted_at IS NULL.

ALTER TABLE "treasury_txns"  ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);
ALTER TABLE "ledger_entries" ADD COLUMN IF NOT EXISTS "deleted_at" TIMESTAMP(3);

-- Index to speed up the common filter (IS NULL fast-path via partial index)
CREATE INDEX IF NOT EXISTS "treasury_txns_deleted_at_idx"  ON "treasury_txns"  ("deleted_at") WHERE "deleted_at" IS NULL;
CREATE INDEX IF NOT EXISTS "ledger_entries_deleted_at_idx" ON "ledger_entries" ("deleted_at") WHERE "deleted_at" IS NULL;
