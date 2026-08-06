/**
 * ترحيل لمرة واحدة: ختم وقت الإدخال الفعلي على حركات الخزنة المؤرّخة عند منتصف الليل
 * (المختارة من التقويم) بحيث يصبح ترتيب الخزنة زمنياً دقيقاً كسجل العمليات.
 * - يأخذ وقت created_at ويضعه في نفس اليوم (بحدّ أقصى 20:59:59 UTC حتى لا ينزاح اليوم بتوقيت القاهرة).
 * - يعيد حساب سلاسل الأرصدة لكل الحسابات (balanceAfter + أرصدة المحافظ).
 * - الأرصدة النهائية لا تتغيّر — فقط ترتيب العرض والرصيد-بعد-كل-حركة.
 * تشغيل: DATABASE_URL=<prod> npx tsx scripts/migrate-treasury-entry-time.ts
 */
import { PrismaClient } from "@prisma/client";
import { أعد_حساب_حساب_الخزنة } from "../src/lib/treasury";
const prisma = new PrismaClient();
const N = (v: unknown) => Number(v);

async function main() {
  const قبل_خزنة = (await prisma.treasuryAccount.findMany()).reduce((س, h) => س + N(h.balance), 0);
  const قبل_محافظ = (await prisma.subAccount.findMany()).reduce((س, s) => س + N(s.balance), 0);
  console.log(`قبل: إجمالي الخزنة=${قبل_خزنة}  إجمالي المحافظ=${قبل_محافظ}`);

  const عدد_منتصف_ليل = await prisma.$executeRawUnsafe(
    `UPDATE treasury_txns
       SET date = (date::date) + LEAST(created_at::time, time '20:59:59')
     WHERE date::time = time '00:00:00'`
  );
  console.log(`✓ تم ختم الوقت على ${عدد_منتصف_ليل} حركة`);

  const حسابات = await prisma.treasuryAccount.findMany({ select: { id: true } });
  await prisma.$transaction(async (tx) => {
    for (const h of حسابات) await أعد_حساب_حساب_الخزنة(tx, h.id);
  });
  console.log(`✓ أُعيد حساب ${حسابات.length} حسابات (balanceAfter + المحافظ)`);

  const بعد_خزنة = (await prisma.treasuryAccount.findMany()).reduce((س, h) => س + N(h.balance), 0);
  const بعد_محافظ = (await prisma.subAccount.findMany()).reduce((س, s) => س + N(s.balance), 0);
  console.log(`بعد: إجمالي الخزنة=${بعد_خزنة}  إجمالي المحافظ=${بعد_محافظ}`);

  const ثابت = Math.abs(بعد_خزنة - قبل_خزنة) < 0.005 && Math.abs(بعد_محافظ - قبل_محافظ) < 0.005;
  console.log(ثابت ? "✅ الأرصدة النهائية ثابتة (تغيّر الترتيب فقط)" : "❌ تحذير: الأرصدة اختلفت!");
  if (!ثابت) throw new Error("balance mismatch — راجع قبل الاعتماد");
}
main().then(() => process.exit(0)).catch((e) => { console.error("❌", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
