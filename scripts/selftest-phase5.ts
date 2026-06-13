/** اختبار ذاتي للمرحلة 5: أرصدة الخزنة + الإجمالي + التعديل/الحذف. */
import { PrismaClient } from "@prisma/client";
import { أضف_حركة_خزنة, أعد_حساب_حساب_الخزنة, إجمالي_الخزنة } from "../src/lib/treasury";

const prisma = new PrismaClient();
const رقم = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) {
  if (!ش) throw new Error("فشل: " + ر);
  console.log("✓ " + ر);
}
const رصيد = async (id: number) =>
  رقم((await prisma.treasuryAccount.findUniqueOrThrow({ where: { id } })).balance);
const الإجمالي = async () => رقم(await إجمالي_الخزنة(prisma));

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const bank = await prisma.treasuryAccount.findUniqueOrThrow({ where: { type: "BANK" } });
  const cash = await prisma.treasuryAccount.findUniqueOrThrow({ where: { type: "CASH" } });

  const بنك0 = await رصيد(bank.id);
  const نقدي0 = await رصيد(cash.id);
  const إجمالي0 = await الإجمالي();

  // إيراد 50,000 للبنك
  const ح_بنك = await prisma.$transaction((tx) =>
    أضف_حركة_خزنة(tx, { التاريخ: new Date("2026-03-01"), النوع: "INCOME", المبلغ: 50000, معرف_الحساب: bank.id, البيان: "إيراد اختبار", أنشأ: ahmed.id })
  );
  تحقق(await رصيد(bank.id) === بنك0 + 50000, "إيراد 50,000 → رصيد البنك +50,000");
  تحقق(await الإجمالي() === إجمالي0 + 50000, "الإجمالي +50,000");

  // مصروف 12,000 من النقدي
  const ح_نقدي = await prisma.$transaction((tx) =>
    أضف_حركة_خزنة(tx, { التاريخ: new Date("2026-03-02"), النوع: "EXPENSE", المبلغ: 12000, معرف_الحساب: cash.id, البيان: "مصروف اختبار", أنشأ: ahmed.id })
  );
  تحقق(await رصيد(cash.id) === نقدي0 - 12000, "مصروف 12,000 → النقدي −12,000");
  تحقق(await الإجمالي() === إجمالي0 + 50000 - 12000, "الإجمالي يعكس الحركتين");

  // تعديل الإيراد إلى 60,000
  await prisma.$transaction(async (tx) => {
    await tx.treasuryTxn.update({ where: { id: ح_بنك.id }, data: { amount: 60000 } });
    await أعد_حساب_حساب_الخزنة(tx, bank.id);
  });
  تحقق(await رصيد(bank.id) === بنك0 + 60000, "تعديل الإيراد إلى 60,000 → البنك +60,000");
  تحقق(await الإجمالي() === إجمالي0 + 60000 - 12000, "الإجمالي بعد التعديل صحيح");

  // نقل حركة بين حسابين (البنك → النقدي): إعادة حساب الحسابين
  await prisma.$transaction(async (tx) => {
    await tx.treasuryTxn.update({ where: { id: ح_بنك.id }, data: { accountId: cash.id } });
    await أعد_حساب_حساب_الخزنة(tx, bank.id);
    await أعد_حساب_حساب_الخزنة(tx, cash.id);
  });
  تحقق(await رصيد(bank.id) === بنك0, "بعد نقل الحركة → البنك يعود لرصيده الأصلي");
  تحقق(await رصيد(cash.id) === نقدي0 - 12000 + 60000, "النقدي استلم الـ 60,000");

  // حذف الحركتين → العودة للأصل
  await prisma.$transaction(async (tx) => {
    await tx.treasuryTxn.delete({ where: { id: ح_بنك.id } });
    await tx.treasuryTxn.delete({ where: { id: ح_نقدي.id } });
    await أعد_حساب_حساب_الخزنة(tx, bank.id);
    await أعد_حساب_حساب_الخزنة(tx, cash.id);
  });
  تحقق(await رصيد(bank.id) === بنك0 && await رصيد(cash.id) === نقدي0, "حذف الحركات → الأرصدة تعود للأصل");
  تحقق(await الإجمالي() === إجمالي0, "الإجمالي يعود للأصل");
  console.log("✓ تم التنظيف");
}

main()
  .then(() => {
    console.log("\n✅ نجح اختبار المرحلة 5");
    process.exit(0);
  })
  .catch((e) => {
    console.error("\n❌ فشل اختبار المرحلة 5:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
