/**
 * ملء تاريخ التظهير (endorsed_at) للشيكات المُظهَّرة القديمة (التي أُنشئت قبل إضافة العمود):
 *  - من تاريخ قيد التظهير في دفتر الأستاذ (endorse_ledger_entry_id.date) — وهو الأدق.
 *  - وإن لم يوجد (تسوية بشيك بلا قيد) → من updated_at.
 * حقل عرض فقط (لا أثر على الأرصدة). آمن ويشغَّل مرة واحدة.
 * تشغيل: DATABASE_URL=<prod> npx tsx scripts/backfill-endorsed-at.ts
 */
import { PrismaClient } from "@prisma/client";
const prisma = new PrismaClient();

async function main() {
  const قبل = await prisma.cheque.count({ where: { status: "ENDORSED", endorsedAt: null } });
  console.log(`شيكات مُظهَّرة بلا تاريخ تظهير: ${قبل}`);

  const عدد = await prisma.$executeRawUnsafe(
    `UPDATE cheques c
       SET endorsed_at = COALESCE(
         (SELECT le.date FROM ledger_entries le WHERE le.id = c.endorse_ledger_entry_id),
         c.updated_at
       )
     WHERE c.status = 'ENDORSED' AND c.endorsed_at IS NULL`
  );
  console.log(`✓ تم ضبط تاريخ التظهير على ${عدد} شيك`);

  const بعد = await prisma.cheque.count({ where: { status: "ENDORSED", endorsedAt: null } });
  console.log(بعد === 0 ? "✅ كل الشيكات المُظهَّرة أصبح لها تاريخ" : `⚠️ باقٍ بلا تاريخ: ${بعد}`);
}
main().then(() => process.exit(0)).catch((e) => { console.error("❌", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
