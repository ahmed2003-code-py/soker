-- AlterTable
ALTER TABLE "ledger_entries" ADD COLUMN     "cheque_settlement_id" INTEGER;

-- CreateIndex
CREATE INDEX "ledger_entries_cheque_settlement_id_idx" ON "ledger_entries"("cheque_settlement_id");

-- AddForeignKey
ALTER TABLE "ledger_entries" ADD CONSTRAINT "ledger_entries_cheque_settlement_id_fkey" FOREIGN KEY ("cheque_settlement_id") REFERENCES "cheques"("id") ON DELETE SET NULL ON UPDATE CASCADE;
