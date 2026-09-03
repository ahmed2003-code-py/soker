/**
 * اختبار المخزن (اللطات + سجل الحركة):
 *  - جرد افتتاحي ⇒ لط برصيد.
 *  - وارد شراء ⇒ لط جديد/مزوّد + حركة وارد.
 *  - صادر بيع ⇒ خصم من لط محدد، ومنع الصرف بأكتر من المتاح.
 *  - مرتجع عميل ⇒ يرجع لنفس اللط.
 *  - مرتجع للمورد ⇒ يخرج من اللط.
 *  - كشف اللط: الرصيد بعد كل حركة صح، وإعادة الحساب بتطابق.
 *  - منع عكس الوارد بعد الصرف منه (حماية الحذف/التعديل).
 * ملاحظة: الاختبار بينادي دوال lib مباشرة (متغير التشغيل بيحكم الأكشنز مش الـ lib).
 */
import { PrismaClient } from "@prisma/client";
import {
  أضف_حركة_مخزن, أعد_حساب_رصيد_اللط, اللطات_المتاحة, اجلب_أرصدة_المخزن,
  افحص_إمكانية_عكس_الوارد, اعكس_حركات_الفاتورة, ولّد_رقم_لط, احذف_حركة_مخزن,
} from "../src/lib/stock";

const prisma = new PrismaClient();
const N = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }
const رصيد = async (id: number) => {
  const l = await prisma.lot.findUniqueOrThrow({ where: { id } });
  return { كمية: N(l.qty), وزن: N(l.weight), مقفول: l.closedAt !== null };
};

async function main() {
  const u = (await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } })).id;
  const مورد = await prisma.party.create({ data: { name: "مورد مخزن اختبار", type: "SUPPLIER", openingBalance: 0, balance: 0, createdById: u } });
  const تاريخ = new Date("2026-09-01");

  // ── 1) جرد افتتاحي ──
  const لط_أ = await prisma.lot.create({ data: { lotNo: "OPEN-1", category: "اختبار-14/1", color: "اختبار-سكري", receivedAt: تاريخ, createdById: u } });
  await prisma.$transaction(async (tx) => {
    await أضف_حركة_مخزن(tx, { معرف_اللط: لط_أ.id, النوع: "OPENING", التاريخ: تاريخ, الكمية: 20, الوزن: 480, البيان: "جرد افتتاحي", أنشأ: u });
  });
  تحقق((await رصيد(لط_أ.id)).كمية === 20, "الجرد الافتتاحي: رصيد اللط 20 شكارة");

  // ── 2) وارد شراء (لط تاني لنفس الصنف واللون) ──
  const لط_ب = await prisma.lot.create({ data: { lotNo: "P-100", category: "اختبار-14/1", color: "اختبار-سكري", receivedAt: new Date("2026-09-05"), supplierId: مورد.id, createdById: u } });
  await prisma.$transaction(async (tx) => {
    await أضف_حركة_مخزن(tx, { معرف_اللط: لط_ب.id, النوع: "PURCHASE_IN", التاريخ: new Date("2026-09-05"), الكمية: 30, الوزن: 720, البيان: "فاتورة مورد", أنشأ: u });
  });
  تحقق((await رصيد(لط_ب.id)).كمية === 30, "وارد الشراء: رصيد اللط الجديد 30");

  // ── 3) FIFO: الأقدم أولاً ──
  const متاحة = await اللطات_المتاحة("اختبار-14/1", "اختبار-سكري", null, prisma);
  تحقق(متاحة.length === 2 && متاحة[0].رقم_اللط === "OPEN-1", "اللطات المتاحة مرتبة FIFO (الأقدم أولاً)");
  تحقق(متاحة[0].الكمية === 20 && متاحة[1].الكمية === 30, "الكمية والوزن المتاح ظاهرين لكل لط");

  // ── 4) صادر بيع من لط محدد ──
  await prisma.$transaction(async (tx) => {
    await أضف_حركة_مخزن(tx, { معرف_اللط: لط_أ.id, النوع: "SALE_OUT", التاريخ: new Date("2026-09-10"), الكمية: 8, الوزن: 192, البيان: "فاتورة بيع", أنشأ: u });
  });
  تحقق((await رصيد(لط_أ.id)).كمية === 12, "بعد البيع: رصيد اللط 20 − 8 = 12");

  // ── 5) منع الصرف بأكتر من المتاح ──
  let منع = false;
  try {
    await prisma.$transaction(async (tx) => {
      await أضف_حركة_مخزن(tx, { معرف_اللط: لط_أ.id, النوع: "SALE_OUT", التاريخ: new Date("2026-09-11"), الكمية: 50, الوزن: 1200, أنشأ: u });
    });
  } catch (e) {
    منع = e instanceof Error && e.message.includes("الكمية غير كافية");
  }
  تحقق(منع, "منع الصرف بأكتر من المتاح مع رسالة «الكمية غير كافية»");
  تحقق((await رصيد(لط_أ.id)).كمية === 12, "الرصيد ما اتغيّرش بعد المحاولة الممنوعة");

  // ── 5ب) منع الوزن الزائد (تتبعي بسماح 2%) ──
  let منع_وزن = false;
  try {
    await prisma.$transaction(async (tx) => {
      await أضف_حركة_مخزن(tx, { معرف_اللط: لط_أ.id, النوع: "SALE_OUT", التاريخ: new Date("2026-09-11"), الكمية: 1, الوزن: 5000, أنشأ: u });
    });
  } catch (e) {
    منع_وزن = e instanceof Error && e.message.includes("الوزن أكبر من المتاح");
  }
  تحقق(منع_وزن, "منع الوزن الزائد عن رصيد اللط (خطأ إدخال)");
  // فرق بسيط داخل السماح (2%) بيعدّي — وزن الشكارة بيختلف
  const وزن_اللط = N((await prisma.lot.findUniqueOrThrow({ where: { id: لط_أ.id } })).weight);
  await prisma.$transaction(async (tx) => {
    await أضف_حركة_مخزن(tx, { معرف_اللط: لط_أ.id, النوع: "SALE_OUT", التاريخ: new Date("2026-09-11"), الكمية: 1, الوزن: +(وزن_اللط * 1.01).toFixed(2), أنشأ: u });
  });
  تحقق(true, "فرق وزن بسيط (≤ 2%) مسموح — وزن الشكارة الفعلي بيختلف");
  // نرجّع الوضع زي ما كان عشان باقي الاختبارات
  const آخر = await prisma.stockMovement.findFirstOrThrow({ where: { lotId: لط_أ.id, deletedAt: null }, orderBy: { id: "desc" } });
  await prisma.$transaction(async (tx) => { await احذف_حركة_مخزن(tx, آخر.id); });

  // ── 6) مرتجع عميل يرجع لنفس اللط ──
  await prisma.$transaction(async (tx) => {
    await أضف_حركة_مخزن(tx, { معرف_اللط: لط_أ.id, النوع: "CUSTOMER_RETURN_IN", التاريخ: new Date("2026-09-12"), الكمية: 3, الوزن: 72, البيان: "مرتجع عميل", أنشأ: u });
  });
  تحقق((await رصيد(لط_أ.id)).كمية === 15, "المرتجع رجع لنفس اللط: 12 + 3 = 15");

  // ── 7) مرتجع للمورد يخرج من اللط ──
  await prisma.$transaction(async (tx) => {
    await أضف_حركة_مخزن(tx, { معرف_اللط: لط_ب.id, النوع: "SUPPLIER_RETURN_OUT", التاريخ: new Date("2026-09-13"), الكمية: 5, الوزن: 120, البيان: "مرتجع للمورد", أنشأ: u });
  });
  تحقق((await رصيد(لط_ب.id)).كمية === 25, "مرتجع المورد: 30 − 5 = 25");

  // ── 8) كشف اللط: الرصيد بعد كل حركة ──
  const حركات = await prisma.stockMovement.findMany({ where: { lotId: لط_أ.id, deletedAt: null }, orderBy: [{ date: "asc" }, { id: "asc" }] });
  تحقق(حركات.map((h) => N(h.balanceAfterQty)).join(",") === "20,12,15", "كشف اللط: الرصيد بعد كل حركة 20 → 12 → 15");

  // ── 9) إعادة الحساب بتطابق ──
  await prisma.$transaction(async (tx) => { await أعد_حساب_رصيد_اللط(tx, لط_أ.id); });
  تحقق((await رصيد(لط_أ.id)).كمية === 15, "إعادة حساب اللط بتدّي نفس الرصيد");

  // ── 10) قفل اللط عند النفاد ──
  await prisma.$transaction(async (tx) => {
    await أضف_حركة_مخزن(tx, { معرف_اللط: لط_أ.id, النوع: "SALE_OUT", التاريخ: new Date("2026-09-14"), الكمية: 15, الوزن: 360, أنشأ: u });
  });
  تحقق((await رصيد(لط_أ.id)).مقفول, "اللط اتقفل تلقائياً لما رصيده خلص");
  تحقق((await اللطات_المتاحة("اختبار-14/1", "اختبار-سكري", null, prisma)).length === 1, "اللط المقفول مبقاش ظاهر في المتاح");

  // ── 11) حماية العكس: فاتورة وارد اتصرف منها ──
  const عميل = await prisma.party.create({ data: { name: "عميل مخزن اختبار", type: "CUSTOMER", openingBalance: 0, balance: 0, createdById: u } });
  const فاتورة_شراء = await prisma.invoice.create({ data: { number: null, invoiceType: "PURCHASE", customerId: مورد.id, date: تاريخ, createdById: u, stockPosted: true } });
  const لط_ج = await prisma.lot.create({ data: { lotNo: "P-200", category: "اختبار-28", color: "اختبار-أخضر", receivedAt: تاريخ, createdById: u } });
  await prisma.$transaction(async (tx) => {
    await أضف_حركة_مخزن(tx, { معرف_اللط: لط_ج.id, النوع: "PURCHASE_IN", التاريخ: تاريخ, الكمية: 10, الوزن: 240, معرف_الفاتورة: فاتورة_شراء.id, أنشأ: u });
  });
  const قبل_الصرف = await prisma.$transaction(async (tx) => افحص_إمكانية_عكس_الوارد(tx, فاتورة_شراء.id));
  تحقق(قبل_الصرف.مسموح, "قبل الصرف: مسموح بتعديل/حذف فاتورة الشراء");
  await prisma.$transaction(async (tx) => {
    await أضف_حركة_مخزن(tx, { معرف_اللط: لط_ج.id, النوع: "SALE_OUT", التاريخ: تاريخ, الكمية: 4, الوزن: 96, أنشأ: u });
  });
  const بعد_الصرف = await prisma.$transaction(async (tx) => افحص_إمكانية_عكس_الوارد(tx, فاتورة_شراء.id));
  تحقق(!بعد_الصرف.مسموح && !!بعد_الصرف.سبب, "بعد الصرف: ممنوع الحذف/التعديل مع سبب واضح");

  // ── 12) عكس حركات فاتورة (لما يكون مسموح) ──
  const فاتورة2 = await prisma.invoice.create({ data: { number: null, invoiceType: "PURCHASE", customerId: مورد.id, date: تاريخ, createdById: u, stockPosted: true } });
  const لط_د = await prisma.lot.create({ data: { lotNo: "P-300", category: "اختبار-28", color: "اختبار-أزرق", receivedAt: تاريخ, createdById: u } });
  await prisma.$transaction(async (tx) => {
    await أضف_حركة_مخزن(tx, { معرف_اللط: لط_د.id, النوع: "PURCHASE_IN", التاريخ: تاريخ, الكمية: 7, الوزن: 168, معرف_الفاتورة: فاتورة2.id, أنشأ: u });
  });
  تحقق((await رصيد(لط_د.id)).كمية === 7, "قبل العكس: رصيد 7");
  await prisma.$transaction(async (tx) => { await اعكس_حركات_الفاتورة(tx, فاتورة2.id); });
  تحقق((await رصيد(لط_د.id)).كمية === 0, "بعد عكس حركات الفاتورة: الرصيد رجع 0");

  // ── 13) شاشة الأرصدة والبحث ──
  await prisma.stockMinimum.create({ data: { category: "اختبار-28", color: null, minQty: 30, minWeight: 0, createdById: u } });
  const أرصدة = await اجلب_أرصدة_المخزن(null, prisma);
  const ألوان28 = أرصدة.flatMap((ش) => ش.الأصناف.filter((ص) => ص.التصنيف === "اختبار-28").flatMap((ص) => ص.الألوان));
  تحقق(ألوان28.length === 2, "الأرصدة مرتّبة هرمياً: شركة ← تصنيف ← لون");
  تحقق(ألوان28.every((ل) => ل.تحت_الحد_الأدنى), "تنبيه الحد الأدنى شغّال على مستوى الصنف");
  تحقق(
    أرصدة.every((ش) => ش.الكمية === ش.الأصناف.reduce((س, ص) => س + ص.الكمية, 0)),
    "إجمالي الشركة = مجموع أصنافها"
  );
  const بحث = await اجلب_أرصدة_المخزن("P-200", prisma);
  const ألوان_البحث = بحث.flatMap((ش) => ش.الأصناف.flatMap((ص) => ص.الألوان));
  تحقق(ألوان_البحث.length === 1 && ألوان_البحث[0].اللون === "اختبار-أخضر", "البحث برقم اللط بيرجّع الصنف الصح");

  // ── 14) توليد رقم لط تلقائي ──
  const رقم_تلقائي = await prisma.$transaction(async (tx) => ولّد_رقم_لط(tx, { التاريخ: new Date("2026-09-20") }));
  تحقق(/^L202609-\d{3}$/.test(رقم_تلقائي), `رقم اللط التلقائي بصيغة واضحة (${رقم_تلقائي})`);

  // تنظيف
  const لطات = [لط_أ.id, لط_ب.id, لط_ج.id, لط_د.id];
  await prisma.stockMovement.deleteMany({ where: { lotId: { in: لطات } } });
  await prisma.lot.deleteMany({ where: { id: { in: لطات } } });
  await prisma.invoice.deleteMany({ where: { id: { in: [فاتورة_شراء.id, فاتورة2.id] } } });
  await prisma.stockMinimum.deleteMany({ where: { category: "اختبار-28" } });
  await prisma.party.deleteMany({ where: { id: { in: [مورد.id, عميل.id] } } });
}

main().then(() => { console.log("\n✅ نجح اختبار المخزن (لطات + حركات + منع التجاوز + حماية العكس)"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
