-- تفعيل امتداد trigram اللازم لفهارس GIN على البحث النصّي (contains/ILIKE)
CREATE EXTENSION IF NOT EXISTS pg_trgm;

-- CreateIndex
CREATE INDEX "cheques_drawer_name_trgm_idx" ON "cheques" USING GIN ("drawer_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "cheques_bank_name_trgm_idx" ON "cheques" USING GIN ("bank_name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "cheques_beneficiary_trgm_idx" ON "cheques" USING GIN ("beneficiary" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "cheques_cheque_number_trgm_idx" ON "cheques" USING GIN ("cheque_number" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "parties_name_trgm_idx" ON "parties" USING GIN ("name" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "parties_phone_trgm_idx" ON "parties" USING GIN ("phone" gin_trgm_ops);

-- CreateIndex
CREATE INDEX "treasury_txns_description_trgm_idx" ON "treasury_txns" USING GIN ("description" gin_trgm_ops);
