/** اختبار: فاتورة + دفعة — التعديل والحذف يعكسان الجانبين (خزنة + قيد الدفعة) بلا يتامى. */
import { PrismaClient } from "@prisma/client";
import { رحّل_فاتورة_للعميل, احصل_رقم_فاتورة_جديد, اعكس_قيود_الفاتورة } from "../src/lib/invoice";
import { أنشئ_عملية_مرتبطة, اعكس_عملية_مرتبطة } from "../src/lib/integration";
const prisma = new PrismaClient();
const N = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }
const رصيد_حساب = async (id: number) => N((await prisma.treasuryAccount.findUniqueOrThrow({ where: { id } })).balance);
const رصيد_عميل = async (id: number) => N((await prisma.party.findUniqueOrThrow({ where: { id } })).balance);

async function أنشئ_فاتورة_بدفعة(عميلId: number, حسابId: number, ahmedId: number, قيمة: number) {
  let id = 0;
  await prisma.$transaction(async (tx) => {
    const n = await احصل_رقم_فاتورة_جديد(tx);
    const f = await tx.invoice.create({ data: { number: n, customerId: عميلId, date: new Date("2026-06-01"), totalQty: 1, totalWeight: 1, totalAmount: قيمة, createdById: ahmedId } });
    id = f.id;
    await رحّل_فاتورة_للعميل(tx, { معرف_الفاتورة: f.id, رقم_الفاتورة: n, معرف_العميل: عميلId, التاريخ: new Date("2026-06-01"), القيمة: قيمة, أنشأ: ahmedId });
    await أنشئ_عملية_مرتبطة(tx, { الاتجاه: "تحصيل", معرف_الطرف: عميلId, اسم_الطرف: "x", المبلغ: قيمة, التاريخ: new Date("2026-06-01"), معرف_الحساب: حسابId, معرف_الفاتورة: f.id, البيان: "تحصيل", أنشأ: ahmedId });
  });
  return id;
}
async function اعكس_فاتورة(id: number, عميلId: number) {
  await prisma.$transaction(async (tx) => {
    const حركات = await tx.treasuryTxn.findMany({ where: { invoiceId: id, deletedAt: null }, select: { id: true } });
    for (const ح of حركات) await اعكس_عملية_مرتبطة(tx, ح.id);
    await اعكس_قيود_الفاتورة(tx, id, عميلId);
  });
}

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const cash = await prisma.treasuryAccount.findUniqueOrThrow({ where: { type: "CASH" } });
  const c0 = await رصيد_حساب(cash.id);
  const عميل = await prisma.party.create({ data: { name: "فاتورة+دفعة اختبار", type: "CUSTOMER", createdById: ahmed.id } });

  // إنشاء
  const id = await أنشئ_فاتورة_بدفعة(عميل.id, cash.id, ahmed.id, 1000);
  تحقق(await رصيد_حساب(cash.id) === c0 + 1000, "الإنشاء: الخزنة +1000 (الدفعة)");
  تحقق(await رصيد_عميل(عميل.id) === 0, "الإنشاء: العميل 0 (مدين 1000 − دائن 1000)");

  // تعديل (عكس ثم إعادة تطبيق بنفس القيمة والدفعة)
  await اعكس_فاتورة(id, عميل.id);
  await prisma.invoice.delete({ where: { id } });
  const id2 = await أنشئ_فاتورة_بدفعة(عميل.id, cash.id, ahmed.id, 1500);
  تحقق(await رصيد_حساب(cash.id) === c0 + 1500, "التعديل لـ1500: الخزنة +1500 (الدفعة محفوظة)");
  تحقق(await رصيد_عميل(عميل.id) === 0, "التعديل: العميل 0 (لا قيد دفعة يتيم)");

  // حذف
  await اعكس_فاتورة(id2, عميل.id);
  await prisma.invoice.delete({ where: { id: id2 } });
  تحقق(await رصيد_حساب(cash.id) === c0, "الحذف: الخزنة ترجع لأصلها");
  تحقق(await رصيد_عميل(عميل.id) === 0, "الحذف: العميل 0");
  const باقي = await prisma.ledgerEntry.count({ where: { partyId: عميل.id, deletedAt: null } });
  تحقق(باقي === 0, "لا قيود نشطة متبقية على العميل بعد الحذف");

  await prisma.ledgerEntry.deleteMany({ where: { partyId: عميل.id } });
  await prisma.treasuryTxn.deleteMany({ where: { partyId: عميل.id } });
  await prisma.party.delete({ where: { id: عميل.id } });
  console.log("✓ تم التنظيف");
}
main().then(() => { console.log("\n✅ نجح اختبار فاتورة+دفعة"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
