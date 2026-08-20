-- تاريخ التظهير للمورد (إضافي وآمن)
ALTER TABLE "cheques" ADD COLUMN IF NOT EXISTS "endorsed_at" TIMESTAMP(3);
