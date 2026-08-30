/**
 * اختبار الفاتورة المباشرة (مورد ← عميل):
 *  - إدخال واحد ⇒ فاتورتان مربوطتان بمجموعة واحدة (شراء على المورد + بيع على العميل).
 *  - لكل جهة سعرها: المورد دائن بسعر الشراء، العميل مدين بسعر البيع، والفرق = الربح.
 *  - دفعتان مستقلتان: تحصيل من العميل (إيراد) + دفع للمورد (مصروف).
 *  - الحذف يعكس الجهتين معاً فلا يبقى أثر على أي حساب.
 * يحاكي مسار الأكشن (نفس دوال lib المستخدمة في src/app/(app)/invoices/direct-actions.ts).
 */
import { PrismaClient } from "@prisma/client";
import { احسب_إجماليات, رحّل_فاتورة_مباشرة, اعكس_قيود_الفاتورة } from "../src/lib/invoice";
import { أنشئ_عملية_مرتبطة, اعكس_عملية_مرتبطة } from "../src/lib/integration";
import { د } from "../src/lib/decimal";

const prisma = new PrismaClient();
const N = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }
const رطرف = async (id: number) => N((await prisma.party.findUniqueOrThrow({ where: { id } })).balance);
const رحساب = async (id: number) => N((await prisma.treasuryAccount.findUniqueOrThrow({ where: { id } })).balance);

// نفس البضاعة بسعرين: سعر شراء من المورد وسعر بيع للعميل
const بنود = [
  { نوع_البند: "SALE" as const, اللون: "أحمر", الشركة: "النصر", الكمية: "10", الوزن: "250", التصنيف: "14×1", السعر: "90", سعر_المورد: "80", ملاحظات: null },
  { نوع_البند: "SALE" as const, اللون: "أزرق", الشركة: "النصر", الكمية: "5", الوزن: "100", التصنيف: "28×2", السعر: "80", سعر_المورد: "72", ملاحظات: null },
];
const قيمة_العميل_المتوقعة = 90 * 250 + 80 * 100; // 30,500
const قيمة_المورد_المتوقعة = 80 * 250 + 72 * 100; //  27,200
const الربح_المتوقع = قيمة_العميل_المتوقعة - قيمة_المورد_المتوقعة; // 3,300

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const bank = await prisma.treasuryAccount.findUniqueOrThrow({ where: { type: "BANK" } });
  const cash = await prisma.treasuryAccount.findUniqueOrThrow({ where: { type: "CASH" } });
  const b0 = await رحساب(bank.id), c0 = await رحساب(cash.id);

  const مورد = await prisma.party.create({ data: { name: "مورد فاتورة مباشرة اختبار", type: "SUPPLIER", openingBalance: 0, balance: 0, createdById: ahmed.id } });
  const عميل = await prisma.party.create({ data: { name: "عميل فاتورة مباشرة اختبار", type: "CUSTOMER", openingBalance: 0, balance: 0, createdById: ahmed.id } });

  const إج_عميل = احسب_إجماليات(بنود);
  const إج_مورد = احسب_إجماليات(بنود.map((x) => ({ ...x, السعر: x.سعر_المورد })));
  تحقق(N(إج_عميل.الإجمالي_المالي) === قيمة_العميل_المتوقعة, `قيمة العميل = 90×250 + 80×100 = ${قيمة_العميل_المتوقعة}`);
  تحقق(N(إج_مورد.الإجمالي_المالي) === قيمة_المورد_المتوقعة, `قيمة المورد = 80×250 + 72×100 = ${قيمة_المورد_المتوقعة}`);
  تحقق(N(إج_عميل.إجمالي_الوزن) === N(إج_مورد.إجمالي_الوزن), "الوزن واحد للجهتين (نفس البضاعة)");

  const بنود_إنشاء = (م: typeof إج_عميل) => ({
    create: م.بنود_محسوبة.map((x) => ({
      lineType: "SALE", color: x.اللون, company: x.الشركة, qty: x._كمية, weight: x._وزن,
      category: x.التصنيف, price: د(x.السعر!), lineTotal: x._مجموع, createdById: ahmed.id,
    })),
  });
  const تاريخ = new Date();
  const رقم = 990001;

  // ── الإنشاء: مجموعة واحدة + فاتورتان + قيدان ──
  const { ف_مورد, ف_عميل } = await prisma.$transaction(async (tx) => {
    const مجموعة = await tx.directInvoice.create({ data: {} });
    const ف_مورد = await tx.invoice.create({ data: {
      number: null, invoiceType: "PURCHASE", externalRef: "S-77", customerId: مورد.id, date: تاريخ,
      totalQty: إج_مورد.إجمالي_الكمية, totalWeight: إج_مورد.إجمالي_الوزن, totalAmount: إج_مورد.الإجمالي_المالي,
      directInvoiceId: مجموعة.id, createdById: ahmed.id, lines: بنود_إنشاء(إج_مورد),
    } });
    const ف_عميل = await tx.invoice.create({ data: {
      number: رقم, invoiceType: "SALE", customerId: عميل.id, date: تاريخ,
      totalQty: إج_عميل.إجمالي_الكمية, totalWeight: إج_عميل.إجمالي_الوزن, totalAmount: إج_عميل.الإجمالي_المالي,
      directInvoiceId: مجموعة.id, createdById: ahmed.id, lines: بنود_إنشاء(إج_عميل),
    } });
    await رحّل_فاتورة_مباشرة(tx, {
      معرف_فاتورة_المورد: ف_مورد.id, معرف_فاتورة_العميل: ف_عميل.id,
      معرف_المورد: مورد.id, معرف_العميل: عميل.id,
      اسم_المورد: مورد.name, اسم_العميل: عميل.name,
      رقم_الفاتورة: رقم, مرجع_المورد: "S-77", التاريخ: تاريخ,
      قيمة_المورد: إج_مورد.الإجمالي_المالي, قيمة_العميل: إج_عميل.الإجمالي_المالي, أنشأ: ahmed.id,
    });
    return { ف_مورد, ف_عميل };
  });

  تحقق(ف_مورد.directInvoiceId !== null && ف_مورد.directInvoiceId === ف_عميل.directInvoiceId, "الفاتورتان مربوطتان بنفس المجموعة");
  تحقق(await رطرف(مورد.id) === قيمة_المورد_المتوقعة, `المورد: مستحق له ${قيمة_المورد_المتوقعة} بسعر الشراء (قيد دائن)`);
  تحقق(await رطرف(عميل.id) === قيمة_العميل_المتوقعة, `العميل: مديونية ${قيمة_العميل_المتوقعة} بسعر البيع (قيد مدين)`);
  تحقق(قيمة_العميل_المتوقعة - قيمة_المورد_المتوقعة === الربح_المتوقع, `ربح المعاملة = ${الربح_المتوقع}`);
  const ف_م = await prisma.invoice.findUniqueOrThrow({ where: { id: ف_مورد.id }, include: { lines: true } });
  const ف_ع = await prisma.invoice.findUniqueOrThrow({ where: { id: ف_عميل.id }, include: { lines: true } });
  تحقق(N(ف_م.totalAmount) === قيمة_المورد_المتوقعة && N(ف_ع.totalAmount) === قيمة_العميل_المتوقعة,
    "كل فاتورة محفوظة بإجمالي جهتها");
  تحقق(ف_م.lines.every((l) => [80, 72].includes(N(l.price))) && ف_ع.lines.every((l) => [90, 80].includes(N(l.price))),
    "بنود كل فاتورة محفوظة بسعر جهتها");

  const قيد_المورد = await prisma.ledgerEntry.findFirstOrThrow({ where: { invoiceId: ف_مورد.id } });
  const قيد_العميل = await prisma.ledgerEntry.findFirstOrThrow({ where: { invoiceId: ف_عميل.id } });
  تحقق(N(قيد_المورد.credit) === قيمة_المورد_المتوقعة && N(قيد_المورد.debit) === 0, "قيد المورد: دائن بقيمة الشراء");
  تحقق(N(قيد_العميل.debit) === قيمة_العميل_المتوقعة && N(قيد_العميل.credit) === 0, "قيد العميل: مدين بقيمة البيع");
  تحقق(قيد_المورد.description.includes(عميل.name), "بيان المورد يذكر أن البضاعة راحت للعميل مباشرة");
  تحقق(قيد_العميل.description.includes(مورد.name), "بيان العميل يذكر أن البضاعة جت من المورد مباشرة");

  // ── الدفعتان المستقلتان: تحصيل 20,000 من العميل (بنك) + دفع 12,000 للمورد (نقدي) ──
  await prisma.$transaction(async (tx) => {
    await أنشئ_عملية_مرتبطة(tx, {
      الاتجاه: "تحصيل", معرف_الطرف: عميل.id, اسم_الطرف: عميل.name, المبلغ: د(20000), التاريخ: تاريخ,
      معرف_الحساب: bank.id, رقم_الفاتورة: String(رقم), معرف_الفاتورة: ف_عميل.id, أنشأ: ahmed.id,
    });
    await أنشئ_عملية_مرتبطة(tx, {
      الاتجاه: "صرف", معرف_الطرف: مورد.id, اسم_الطرف: مورد.name, المبلغ: د(12000), التاريخ: تاريخ,
      معرف_الحساب: cash.id, رقم_الفاتورة: "S-77", معرف_الفاتورة: ف_مورد.id, أنشأ: ahmed.id,
    });
  });
  تحقق(await رطرف(عميل.id) === قيمة_العميل_المتوقعة - 20000, "بعد التحصيل: مديونية العميل قلّت 20,000");
  تحقق(await رطرف(مورد.id) === قيمة_المورد_المتوقعة - 12000, "بعد الدفع: مستحق المورد قلّ 12,000");
  تحقق(await رحساب(bank.id) === b0 + 20000, "الخزنة (بنك): +20,000 من تحصيل العميل");
  تحقق(await رحساب(cash.id) === c0 - 12000, "الخزنة (نقدي): −12,000 دفعاً للمورد");

  // ── الحذف: عكس الجهتين معاً (نفس منطق حذف_فاتورة للمجموعة) ──
  await prisma.$transaction(async (tx) => {
    for (const ف of [ف_مورد, ف_عميل]) {
      const حركات = await tx.treasuryTxn.findMany({ where: { invoiceId: ف.id, deletedAt: null }, select: { id: true } });
      for (const ح of حركات) await اعكس_عملية_مرتبطة(tx, ح.id);
      await اعكس_قيود_الفاتورة(tx, ف.id, ف.customerId);
      await tx.invoice.delete({ where: { id: ف.id } });
    }
    await tx.directInvoice.delete({ where: { id: ف_مورد.directInvoiceId! } });
  });
  تحقق(await رطرف(مورد.id) === 0, "بعد الحذف: رصيد المورد رجع 0");
  تحقق(await رطرف(عميل.id) === 0, "بعد الحذف: رصيد العميل رجع 0");
  تحقق(await رحساب(bank.id) === b0 && await رحساب(cash.id) === c0, "بعد الحذف: أرصدة الخزنة رجعت زي ما كانت");
  تحقق((await prisma.invoice.count({ where: { id: { in: [ف_مورد.id, ف_عميل.id] } } })) === 0, "الفاتورتان اتحذفتا معاً");

  // تنظيف
  await prisma.ledgerEntry.deleteMany({ where: { partyId: { in: [مورد.id, عميل.id] } } });
  await prisma.party.deleteMany({ where: { id: { in: [مورد.id, عميل.id] } } });
}

main().then(() => { console.log("\n✅ نجح اختبار الفاتورة المباشرة (مورد ← عميل)"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
