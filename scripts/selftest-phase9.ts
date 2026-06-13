/** اختبار ذاتي للمرحلة 9: التكامل الكامل (السيناريو المرجعي بالكامل). */
import { PrismaClient } from "@prisma/client";
import { احسب_إجماليات, رحّل_فاتورة_للعميل, احصل_رقم_فاتورة_جديد } from "../src/lib/invoice";
import { أنشئ_عملية_مرتبطة, اعكس_عملية_مرتبطة } from "../src/lib/integration";
import { إجمالي_الخزنة } from "../src/lib/treasury";

const prisma = new PrismaClient();
const رقم = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) {
  if (!ش) throw new Error("فشل: " + ر);
  console.log("✓ " + ر);
}
const رصيد_عميل = async (id: number) => رقم((await prisma.party.findUniqueOrThrow({ where: { id } })).balance);
const رصيد_حساب = async (id: number) => رقم((await prisma.treasuryAccount.findUniqueOrThrow({ where: { id } })).balance);
const الإجمالي = async () => رقم(await إجمالي_الخزنة(prisma));

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const bank = await prisma.treasuryAccount.findUniqueOrThrow({ where: { type: "BANK" } });
  const عميل = await prisma.party.create({ data: { name: "أحمد (اختبار م9)", type: "CUSTOMER", createdById: ahmed.id } });

  const بنك0 = await رصيد_حساب(bank.id);
  const إجمالي0 = await الإجمالي();

  // 1) فاتورة 185,000 → رصيد العميل 185,000
  const { إجمالي_الكمية, إجمالي_الوزن, الإجمالي_المالي, بنود_محسوبة } = احسب_إجماليات([
    { اللون: "أحمر", الكمية: 1, الوزن: 185, التصنيف: "14×1", السعر: 1000 },
  ]);
  await prisma.$transaction(async (tx) => {
    const n = await احصل_رقم_فاتورة_جديد(tx);
    const f = await tx.invoice.create({
      data: { number: n, customerId: عميل.id, date: new Date("2026-05-01"), totalQty: إجمالي_الكمية, totalWeight: إجمالي_الوزن, totalAmount: الإجمالي_المالي, createdById: ahmed.id,
        lines: { create: بنود_محسوبة.map((x) => ({ color: x.اللون, qty: x._كمية, weight: x._وزن, category: x.التصنيف, price: x._سعر, lineTotal: x._مجموع, createdById: ahmed.id })) } },
    });
    await رحّل_فاتورة_للعميل(tx, { معرف_الفاتورة: f.id, رقم_الفاتورة: n, معرف_العميل: عميل.id, التاريخ: new Date("2026-05-01"), القيمة: الإجمالي_المالي, أنشأ: ahmed.id });
  });
  تحقق(await رصيد_عميل(عميل.id) === 185000, "فاتورة 185,000 → رصيد أحمد 185,000");

  // 2) تحصيل 50,000 عبر البنك
  let معرف_حركة = 0;
  await prisma.$transaction(async (tx) => {
    const r = await أنشئ_عملية_مرتبطة(tx, { الاتجاه: "تحصيل", معرف_الطرف: عميل.id, اسم_الطرف: عميل.name, المبلغ: 50000, التاريخ: new Date("2026-05-05"), معرف_الحساب: bank.id, طريقة_الدفع: "بنك", أنشأ: ahmed.id });
    معرف_حركة = r.معرف_حركة_الخزنة;
  });
  تحقق(await رصيد_حساب(bank.id) === بنك0 + 50000, "تحصيل 50,000 → البنك +50,000");
  تحقق(await الإجمالي() === إجمالي0 + 50000, "إجمالي الخزنة +50,000");
  تحقق(await رصيد_عميل(عميل.id) === 135000, "رصيد أحمد → 135,000 (185,000 − 50,000)");

  // 3) تعديل التحصيل إلى 60,000 (عكس وإعادة تطبيق)
  await prisma.$transaction(async (tx) => {
    await اعكس_عملية_مرتبطة(tx, معرف_حركة);
    const r = await أنشئ_عملية_مرتبطة(tx, { الاتجاه: "تحصيل", معرف_الطرف: عميل.id, اسم_الطرف: عميل.name, المبلغ: 60000, التاريخ: new Date("2026-05-05"), معرف_الحساب: bank.id, طريقة_الدفع: "بنك", أنشأ: ahmed.id });
    معرف_حركة = r.معرف_حركة_الخزنة;
  });
  تحقق(await رصيد_حساب(bank.id) === بنك0 + 60000, "تعديل التحصيل إلى 60,000 → البنك +60,000");
  تحقق(await رصيد_عميل(عميل.id) === 125000, "رصيد أحمد → 125,000 (185,000 − 60,000)");

  // 4) حذف التحصيل → عكس كامل
  await prisma.$transaction(async (tx) => { await اعكس_عملية_مرتبطة(tx, معرف_حركة); });
  تحقق(await رصيد_حساب(bank.id) === بنك0, "حذف التحصيل → البنك يعود لأصله");
  تحقق(await الإجمالي() === إجمالي0, "إجمالي الخزنة يعود لأصله");
  تحقق(await رصيد_عميل(عميل.id) === 185000, "رصيد أحمد يعود إلى 185,000");

  // لا صفوف يتيمة
  const يتيم = await prisma.ledgerEntry.count({ where: { treasuryTxnId: معرف_حركة } });
  تحقق(يتيم === 0, "لا توجد قيود يتيمة مرتبطة بحركة محذوفة");

  // تنظيف
  await prisma.ledgerEntry.deleteMany({ where: { partyId: عميل.id } });
  await prisma.invoice.deleteMany({ where: { customerId: عميل.id } });
  await prisma.party.delete({ where: { id: عميل.id } });
  console.log("✓ تم التنظيف");
}

main()
  .then(() => { console.log("\n✅ نجح اختبار المرحلة 9"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل اختبار المرحلة 9:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
