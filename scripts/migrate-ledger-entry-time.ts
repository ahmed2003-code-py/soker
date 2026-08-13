/**
 * ترحيل لمرة واحدة: ختم وقت الإدخال الفعلي على قيود دفتر الأستاذ المؤرّخة عند منتصف الليل
 * (المختارة من التقويم — كالفواتير) بحيث يصبح ترتيب كشف الحساب زمنياً دقيقاً (آخر ما أُدخِل يظهر أولاً)
 * كقيود التظهير/الدفعات المختومة بوقت فعلي.
 * - يأخذ وقت created_at ويضعه في نفس اليوم (بحدّ أقصى 20:59:59 UTC حتى لا ينزاح اليوم بتوقيت القاهرة).
 * - يعيد حساب سلاسل الأرصدة لكل الأطراف (balanceAfter + Party.balance).
 * - الأرصدة النهائية لا تتغيّر — فقط ترتيب العرض والرصيد-بعد-كل-حركة.
 * تشغيل: DATABASE_URL=<prod> npx tsx scripts/migrate-ledger-entry-time.ts
 */
import { PrismaClient } from "@prisma/client";
import { أعد_حساب_سلسلة_الطرف } from "../src/lib/ledger";
const prisma = new PrismaClient();
const N = (v: unknown) => Number(v);

async function main() {
  const قبل = (await prisma.party.findMany({ select: { balance: true } })).reduce((س, p) => س + N(p.balance), 0);
  console.log(`قبل: إجمالي أرصدة الأطراف = ${قبل.toFixed(2)}`);

  const عدد = await prisma.$executeRawUnsafe(
    `UPDATE ledger_entries
       SET date = (date::date) + LEAST(created_at::time, time '20:59:59')
     WHERE date::time = time '00:00:00' AND deleted_at IS NULL`
  );
  console.log(`✓ تم ختم الوقت على ${عدد} قيد (كان بمنتصف الليل)`);

  const أطراف = await prisma.party.findMany({ select: { id: true } });
  // إعادة حساب كل طرف في معاملة مستقلة (تفادي مهلة المعاملة على البروكسي البعيد)
  let ن = 0;
  for (const p of أطراف) {
    await prisma.$transaction(async (tx) => { await أعد_حساب_سلسلة_الطرف(tx, p.id); }, { timeout: 120000 });
    ن++;
  }
  console.log(`✓ أُعيد حساب ${ن} طرف (balanceAfter + Party.balance)`);

  const بعد = (await prisma.party.findMany({ select: { balance: true } })).reduce((س, p) => س + N(p.balance), 0);
  console.log(`بعد: إجمالي أرصدة الأطراف = ${بعد.toFixed(2)}`);

  const ثابت = Math.abs(بعد - قبل) < 0.01;
  console.log(ثابت ? "✅ الأرصدة النهائية ثابتة (تغيّر الترتيب فقط)" : "❌ تحذير: الأرصدة اختلفت!");
  if (!ثابت) throw new Error("balance mismatch — راجع قبل الاعتماد");
}
main().then(() => process.exit(0)).catch((e) => { console.error("❌", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
