/** اختبار ذاتي: الدفعة الموزّعة (إنشاء، تعديل، حذف) — قيد واحد + حركات خزنة متعددة. */
import { PrismaClient } from "@prisma/client";
import { أضف_قيد } from "../src/lib/ledger";
import { أنشئ_دفعة_موزعة, حذف_دفعة_موزعة } from "../src/lib/integration";

const prisma = new PrismaClient();
const رقم = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) {
  if (!ش) throw new Error("فشل: " + ر);
  console.log("✓ " + ر);
}
const رصيد_عميل = async (id: number) => رقم((await prisma.party.findUniqueOrThrow({ where: { id } })).balance);
const رصيد_حساب = async (id: number) => رقم((await prisma.treasuryAccount.findUniqueOrThrow({ where: { id } })).balance);

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const cash = await prisma.treasuryAccount.findUniqueOrThrow({ where: { type: "CASH" } });
  const bank = await prisma.treasuryAccount.findUniqueOrThrow({ where: { type: "BANK" } });
  const insta = await prisma.treasuryAccount.findUniqueOrThrow({ where: { type: "INSTAPAY" } });
  const cash0 = await رصيد_حساب(cash.id), bank0 = await رصيد_حساب(bank.id), insta0 = await رصيد_حساب(insta.id);

  const عميل = await prisma.party.create({ data: { name: "عميل دفعة موزّعة اختبار", type: "CUSTOMER", createdById: ahmed.id } });
  // مديونية 100,000
  await prisma.$transaction(async (tx) => {
    await أضف_قيد(tx, { معرف_الطرف: عميل.id, التاريخ: new Date("2026-06-01"), البيان: "فاتورة", مدين: 100000, أنشأ: ahmed.id });
  });
  تحقق(await رصيد_عميل(عميل.id) === 100000, "مديونية العميل 100,000");

  // ── دفعة موزّعة: 40k نقدي + 35k بنك + 25k إنستا = 100,000
  let مجموعة = 0;
  await prisma.$transaction(async (tx) => {
    const r = await أنشئ_دفعة_موزعة(tx, {
      الاتجاه: "تحصيل", معرف_الطرف: عميل.id, اسم_الطرف: عميل.name, الإجمالي: 100000, التاريخ: new Date("2026-06-05"),
      بنود: [
        { معرف_الحساب: cash.id, المبلغ: 40000, طريقة_الدفع: "نقدي" },
        { معرف_الحساب: bank.id, المبلغ: 35000, طريقة_الدفع: "بنك" },
        { معرف_الحساب: insta.id, المبلغ: 25000, طريقة_الدفع: "إنستا باي" },
      ],
      أنشأ: ahmed.id,
    });
    مجموعة = r.معرف_المجموعة;
  });
  تحقق(await رصيد_عميل(عميل.id) === 0, "بعد الدفعة الموزّعة → مديونية العميل 0 (خُصمت مرة واحدة)");
  تحقق(await رصيد_حساب(cash.id) === cash0 + 40000, "النقدي +40,000");
  تحقق(await رصيد_حساب(bank.id) === bank0 + 35000, "البنك +35,000");
  تحقق(await رصيد_حساب(insta.id) === insta0 + 25000, "إنستا باي +25,000");
  const قيود = await prisma.ledgerEntry.count({ where: { splitPaymentId: مجموعة, deletedAt: null } });
  const حركات = await prisma.treasuryTxn.count({ where: { splitPaymentId: مجموعة, deletedAt: null } });
  تحقق(قيود === 1, "قيد واحد فقط على العميل (بالإجمالي)");
  تحقق(حركات === 3, "3 حركات خزنة مستقلة");

  // ── تعديل: 60,000 = 30k نقدي + 30k بنك
  await prisma.$transaction(async (tx) => {
    await حذف_دفعة_موزعة(tx, مجموعة);
    const r = await أنشئ_دفعة_موزعة(tx, {
      الاتجاه: "تحصيل", معرف_الطرف: عميل.id, اسم_الطرف: عميل.name, الإجمالي: 60000, التاريخ: new Date("2026-06-05"),
      بنود: [
        { معرف_الحساب: cash.id, المبلغ: 30000, طريقة_الدفع: "نقدي" },
        { معرف_الحساب: bank.id, المبلغ: 30000, طريقة_الدفع: "بنك" },
      ],
      أنشأ: ahmed.id,
    });
    مجموعة = r.معرف_المجموعة;
  });
  تحقق(await رصيد_عميل(عميل.id) === 40000, "بعد التعديل لـ60,000 → مديونية العميل 40,000");
  تحقق(await رصيد_حساب(cash.id) === cash0 + 30000, "النقدي +30,000 بعد التعديل");
  تحقق(await رصيد_حساب(bank.id) === bank0 + 30000, "البنك +30,000 بعد التعديل");
  تحقق(await رصيد_حساب(insta.id) === insta0, "إنستا باي رجع لأصله (أُزيل من التوزيع)");

  // ── حذف كامل
  await prisma.$transaction(async (tx) => { await حذف_دفعة_موزعة(tx, مجموعة); });
  تحقق(await رصيد_عميل(عميل.id) === 100000, "بعد الحذف → مديونية العميل ترجع 100,000");
  تحقق(await رصيد_حساب(cash.id) === cash0, "النقدي رجع لأصله");
  تحقق(await رصيد_حساب(bank.id) === bank0, "البنك رجع لأصله");

  // تنظيف
  await prisma.ledgerEntry.deleteMany({ where: { partyId: عميل.id } });
  await prisma.treasuryTxn.deleteMany({ where: { partyId: عميل.id } });
  await prisma.party.delete({ where: { id: عميل.id } });
  console.log("✓ تم التنظيف");
}

main()
  .then(() => { console.log("\n✅ نجح اختبار الدفعة الموزّعة"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
