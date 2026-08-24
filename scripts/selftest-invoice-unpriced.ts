/**
 * اختبار الفاتورة غير المسعّرة:
 *  - تجريد الأسعار ⇒ كل الإجماليات = صفر ⇒ لا قيد على حساب العميل (رصيده لا يتغيّر).
 *  - عند التسعير لاحقاً ⇒ القيد يُرحَّل ودين العميل يزيد بالقيمة.
 * يحاكي منطق الأكشن (تجريد الأسعار قبل احسب_إجماليات + الترحيل المشروط بـ > 0).
 */
import { PrismaClient } from "@prisma/client";
import { احسب_إجماليات, رحّل_فاتورة_للعميل, اعكس_قيود_الفاتورة } from "../src/lib/invoice";
const prisma = new PrismaClient();
const N = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }
const رطرف = async (id: number) => N((await prisma.party.findUniqueOrThrow({ where: { id } })).balance);

const بنود = [
  { نوع_البند: "SALE" as const, اللون: "أحمر", الشركة: null, الكمية: "10", الوزن: "100", التصنيف: "14×1", السعر: "50", ملاحظات: null },
  { نوع_البند: "SALE" as const, اللون: "أزرق", الشركة: null, الكمية: "5", الوزن: "50", التصنيف: "28×2", السعر: "40", ملاحظات: null },
];

async function main() {
  const ahmed = (await prisma.user.findFirstOrThrow()).id;
  const عميل = await prisma.party.create({ data: { name: "عميل فاتورة غير مسعّرة", type: "CUSTOMER", openingBalance: 0, balance: 0, createdById: ahmed } });

  // ── إنشاء غير مسعّرة (أسعار مجرّدة) ──
  const بنود_مجرّدة = بنود.map((x) => ({ ...x, السعر: null }));
  const غ = احسب_إجماليات(بنود_مجرّدة);
  تحقق(N(غ.الإجمالي_المالي) === 0 && N(غ.إجمالي_المبيعات) === 0, "غير مسعّرة: الإجمالي المالي = 0");
  تحقق(N(غ.إجمالي_الوزن) === 150 && N(غ.إجمالي_الكمية) === 15, "غير مسعّرة: الكمية/الوزن محفوظة (15 / 150)");

  const inv = await prisma.invoice.create({ data: { number: 900001, invoiceType: "SALE", unpriced: true, customerId: عميل.id, date: new Date(), totalQty: غ.إجمالي_الكمية, totalWeight: غ.إجمالي_الوزن, totalAmount: غ.الإجمالي_المالي, createdById: ahmed, lines: { create: غ.بنود_محسوبة.map((x) => ({ lineType: x.نوع_البند, color: x.اللون, qty: x._كمية, weight: x._وزن, category: x.التصنيف, price: null, lineTotal: x._مجموع, createdById: ahmed })) } } });
  // لا ترحيل (الإجمالي = 0)
  تحقق(await رطرف(عميل.id) === 0, "غير مسعّرة: رصيد العميل لم يتغيّر (0) — بلا أثر مالي");
  تحقق((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).unpriced === true, "الفاتورة محفوظة بعلامة غير مسعّرة");

  // ── التسعير لاحقاً (عكس ثم إعادة بالقيمة) ──
  const م = احسب_إجماليات(بنود); // بالأسعار
  تحقق(N(م.إجمالي_المبيعات) === 7000, "التسعير: الإجمالي = 50×100 + 40×50 = 7000");
  await prisma.$transaction(async (tx) => {
    await اعكس_قيود_الفاتورة(tx, inv.id, عميل.id);
    await tx.invoiceLine.deleteMany({ where: { invoiceId: inv.id } });
    await tx.invoice.update({ where: { id: inv.id }, data: { unpriced: false, totalAmount: م.الإجمالي_المالي, totalQty: م.إجمالي_الكمية, totalWeight: م.إجمالي_الوزن, lines: { create: م.بنود_محسوبة.map((x) => ({ lineType: x.نوع_البند, color: x.اللون, qty: x._كمية, weight: x._وزن, category: x.التصنيف, price: x._سعر, lineTotal: x._مجموع, createdById: ahmed })) } } });
    await رحّل_فاتورة_للعميل(tx, { معرف_الفاتورة: inv.id, رقم_الفاتورة: 900001, معرف_العميل: عميل.id, التاريخ: new Date(), القيمة: م.إجمالي_المبيعات, أنشأ: ahmed });
  });
  تحقق(await رطرف(عميل.id) === 7000, "بعد التسعير: دين العميل +7000 (اتسجّل الأثر)");
  تحقق((await prisma.invoice.findUniqueOrThrow({ where: { id: inv.id } })).unpriced === false, "بعد التسعير: الفاتورة بقت مسعّرة");

  // تنظيف
  await prisma.ledgerEntry.deleteMany({ where: { partyId: عميل.id } });
  await prisma.invoiceLine.deleteMany({ where: { invoiceId: inv.id } });
  await prisma.invoice.delete({ where: { id: inv.id } });
  await prisma.party.delete({ where: { id: عميل.id } });
}
main().then(() => { console.log("\n✅ نجح اختبار الفاتورة غير المسعّرة (بلا أثر → التسعير يُسجّل الأثر)"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
