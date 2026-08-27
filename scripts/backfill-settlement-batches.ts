/**
 * ربط معاملات السداد المركّب القديمة (اللي اتعملت قبل ما نضيف «معاملة السداد»).
 *
 * المنطق: الجزء النقدي (دفعة موزّعة) والشيكات المُظهَّرة بيتعملوا في نفس المعاملة الواحدة
 * على قاعدة البيانات ⇒ وقت إنشائهم متطابق تقريباً. فبنربط الدفعة الموزّعة بالشيكات
 * المُظهَّرة لنفس المورد اللي قيد تظهيرها اتعمل في نفس اللحظة (± نافذة ثواني).
 *
 *   npx tsx scripts/backfill-settlement-batches.ts          # عرض فقط (بلا تعديل)
 *   npx tsx scripts/backfill-settlement-batches.ts --apply  # تنفيذ الربط
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const نفّذ = process.argv.includes("--apply");
const نافذة_ثواني = 20;
const نص = (v: unknown) => Number(v).toLocaleString("en-US", { minimumFractionDigits: 2 });

async function main() {
  const دفعات = await prisma.splitPayment.findMany({
    where: { settlementBatchId: null, deletedAt: null },
    select: { id: true, createdAt: true },
    orderBy: { id: "asc" },
  });

  let مربوطة = 0;
  for (const دفعة of دفعات) {
    const قيد = await prisma.ledgerEntry.findFirst({
      where: { splitPaymentId: دفعة.id, deletedAt: null },
      select: { partyId: true, date: true, description: true, debit: true, createdById: true, party: { select: { name: true, type: true } } },
    });
    // السداد المركّب للموردين فقط (قيد مدين على المورد)
    if (!قيد || قيد.party.type !== "SUPPLIER") continue;

    const من = new Date(دفعة.createdAt.getTime() - نافذة_ثواني * 1000);
    const إلى = new Date(دفعة.createdAt.getTime() + نافذة_ثواني * 1000);
    const شيكات = await prisma.cheque.findMany({
      where: {
        endorsedToId: قيد.partyId,
        settlementBatchId: null,
        endorseLedgerEntryId: { not: null },
        status: "ENDORSED",
        updatedAt: { gte: من, lte: إلى },
      },
      select: { id: true, chequeNumber: true, amount: true },
    });
    if (!شيكات.length) continue;

    const إجمالي_شيكات = شيكات.reduce((س, ش) => س + Number(ش.amount), 0);
    console.log(
      `• ${قيد.party.name}: دفعة موزّعة #${دفعة.id} (${نص(قيد.debit)}) + ${شيكات.length} شيك (${نص(إجمالي_شيكات)}) — ${قيد.date.toISOString().slice(0, 10)}`
    );
    for (const ش of شيكات) console.log(`    - شيك ${ش.chequeNumber ?? ش.id}: ${نص(ش.amount)}`);

    if (نفّذ) {
      await prisma.$transaction(async (tx) => {
        const معاملة = await tx.settlementBatch.create({
          data: {
            partyId: قيد.partyId,
            date: قيد.date,
            note: قيد.description,
            createdById: قيد.createdById,
          },
        });
        await tx.splitPayment.update({ where: { id: دفعة.id }, data: { settlementBatchId: معاملة.id } });
        await tx.cheque.updateMany({
          where: { id: { in: شيكات.map((ش) => ش.id) } },
          data: { settlementBatchId: معاملة.id },
        });
      });
    }
    مربوطة++;
  }

  console.log(
    مربوطة === 0
      ? "\nلا توجد معاملات سداد مركّب قديمة تحتاج ربطاً."
      : نفّذ
      ? `\n✅ تم ربط ${مربوطة} معاملة سداد مركّب.`
      : `\nℹ️  ${مربوطة} معاملة قابلة للربط — شغّل الأمر بـ --apply للتنفيذ.`
  );
}

main().catch((e) => { console.error("❌ فشل:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
