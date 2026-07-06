-- AlterTable: add opening_balance to parties
ALTER TABLE "parties" ADD COLUMN "opening_balance" DECIMAL(18,4) NOT NULL DEFAULT 0;
