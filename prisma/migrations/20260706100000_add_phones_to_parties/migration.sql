-- AlterTable: add phones JSON array to parties
ALTER TABLE "parties" ADD COLUMN "phones" JSONB NOT NULL DEFAULT '[]';

-- Migrate existing single phone value into the new array
UPDATE "parties"
SET "phones" = jsonb_build_array(jsonb_build_object('رقم', phone, 'تسمية', null))
WHERE phone IS NOT NULL AND phone != '';
