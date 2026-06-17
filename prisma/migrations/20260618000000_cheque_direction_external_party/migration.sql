-- CreateEnum: cheque direction
CREATE TYPE "ChequeDirection" AS ENUM ('INCOMING', 'OUTGOING');

-- AlterTable cheques: add direction and collected_txn_id
ALTER TABLE "cheques"
  ADD COLUMN "direction" "ChequeDirection" NOT NULL DEFAULT 'INCOMING',
  ADD COLUMN "collected_txn_id" INTEGER;

-- Unique constraint for collected_txn_id
ALTER TABLE "cheques" ADD CONSTRAINT "cheques_collected_txn_id_key" UNIQUE ("collected_txn_id");

-- Index on direction
CREATE INDEX "cheques_direction_idx" ON "cheques"("direction");

-- AlterTable treasury_txns: add external_party_name
ALTER TABLE "treasury_txns" ADD COLUMN "external_party_name" TEXT;
