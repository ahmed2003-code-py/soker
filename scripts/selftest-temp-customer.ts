/** اختبار ذاتي: الحساب المؤقت (إنشاء، تصفية/أرشفة تلقائية، شفاء ذاتي، تحويل لدائم). */
import { PrismaClient } from "@prisma/client";
import { أضف_قيد } from "../src/lib/ledger";
import { أنشئ_عملية_مرتبطة, اعكس_عملية_مرتبطة } from "../src/lib/integration";

const prisma = new PrismaClient();
const رقم = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) {
  if (!ش) throw new Error("فشل: " + ر);
  console.log("✓ " + ر);
}
const اجلب = async (id: number) => prisma.party.findUniqueOrThrow({ where: { id } });

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const bank = await prisma.treasuryAccount.findUniqueOrThrow({ where: { type: "BANK" } });

  // ── 1) إنشاء عميل مؤقت + فاتورة مدين 100,000 → نشط برصيد 100,000 (غير مؤرشف)
  const مؤقت = await prisma.party.create({
    data: { name: "عميل مؤقت اختبار", type: "CUSTOMER", isTemporary: true, createdById: ahmed.id },
  });
  await prisma.$transaction(async (tx) => {
    await أضف_قيد(tx, { معرف_الطرف: مؤقت.id, التاريخ: new Date("2026-06-01"), البيان: "بيع نقدي", مدين: 100000, أنشأ: ahmed.id });
  });
  let ح = await اجلب(مؤقت.id);
  تحقق(رقم(ح.balance) === 100000, "مدين 100,000 → رصيد المؤقت 100,000");
  تحقق(ح.archivedAt === null, "المؤقت غير مؤرشف طالما عليه رصيد");

  // ── 2) دفعة جزئية 40,000 → يبقى نشطاً برصيد 60,000
  let معرف_حركة = 0;
  await prisma.$transaction(async (tx) => {
    const r = await أنشئ_عملية_مرتبطة(tx, { الاتجاه: "تحصيل", معرف_الطرف: مؤقت.id, اسم_الطرف: مؤقت.name, المبلغ: 40000, التاريخ: new Date("2026-06-02"), معرف_الحساب: bank.id, أنشأ: ahmed.id });
    معرف_حركة = r.معرف_حركة_الخزنة;
  });
  ح = await اجلب(مؤقت.id);
  تحقق(رقم(ح.balance) === 60000, "دفعة جزئية 40,000 → رصيد 60,000");
  تحقق(ح.archivedAt === null, "لا يزال نشطاً (لم يُسدّد بالكامل)");

  // ── 3) سداد المتبقي 60,000 → رصيد 0 → أرشفة تلقائية
  let معرف_حركة2 = 0;
  await prisma.$transaction(async (tx) => {
    const r = await أنشئ_عملية_مرتبطة(tx, { الاتجاه: "تحصيل", معرف_الطرف: مؤقت.id, اسم_الطرف: مؤقت.name, المبلغ: 60000, التاريخ: new Date("2026-06-03"), معرف_الحساب: bank.id, أنشأ: ahmed.id });
    معرف_حركة2 = r.معرف_حركة_الخزنة;
  });
  ح = await اجلب(مؤقت.id);
  تحقق(رقم(ح.balance) === 0, "سداد كامل → رصيد 0");
  تحقق(ح.archivedAt !== null, "أُرشف تلقائياً عند تصفية الرصيد ✅");

  // ── 4) شفاء ذاتي: حذف دفعة → يعود له رصيد → إلغاء الأرشفة تلقائياً
  await prisma.$transaction(async (tx) => { await اعكس_عملية_مرتبطة(tx, معرف_حركة2); });
  ح = await اجلب(مؤقت.id);
  تحقق(رقم(ح.balance) === 60000, "عكس السداد → رصيد 60,000");
  تحقق(ح.archivedAt === null, "أُلغيت الأرشفة تلقائياً (عاد له رصيد) ✅");

  // ── 5) تحويل لعميل دائم يحفظ الرصيد والقيود
  const عدد_قيود_قبل = await prisma.ledgerEntry.count({ where: { partyId: مؤقت.id, deletedAt: null } });
  await prisma.party.update({ where: { id: مؤقت.id }, data: { isTemporary: false, archivedAt: null, name: "عميل دائم محوّل" } });
  ح = await اجلب(مؤقت.id);
  const عدد_قيود_بعد = await prisma.ledgerEntry.count({ where: { partyId: مؤقت.id, deletedAt: null } });
  تحقق(!ح.isTemporary, "تحوّل لدائم");
  تحقق(رقم(ح.balance) === 60000, "الرصيد محفوظ بعد التحويل (60,000)");
  تحقق(عدد_قيود_قبل === عدد_قيود_بعد, "كل القيود محفوظة بعد التحويل");

  // ── 6) عميل دائم عادي لا يتأثر بمنطق الأرشفة
  const دائم = await prisma.party.create({ data: { name: "دائم عادي اختبار", type: "CUSTOMER", createdById: ahmed.id } });
  await prisma.$transaction(async (tx) => {
    await أضف_قيد(tx, { معرف_الطرف: دائم.id, التاريخ: new Date("2026-06-01"), البيان: "تسوية", مدين: 500, دائن: 500, أنشأ: ahmed.id });
  });
  const حد = await اجلب(دائم.id);
  تحقق(رقم(حد.balance) === 0 && حد.archivedAt === null, "عميل دائم برصيد 0 لا يُؤرشف أبداً ✅");

  // تنظيف
  await prisma.ledgerEntry.deleteMany({ where: { partyId: { in: [مؤقت.id, دائم.id] } } });
  await prisma.treasuryTxn.deleteMany({ where: { partyId: مؤقت.id } });
  await prisma.party.deleteMany({ where: { id: { in: [مؤقت.id, دائم.id] } } });
  console.log("✓ تم التنظيف");
}

main()
  .then(() => { console.log("\n✅ نجح اختبار الحساب المؤقت"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
