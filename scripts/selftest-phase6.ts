/** اختبار ذاتي للمرحلة 6: الفواتير — التجميع، الترقيم، التسعير بالوزن، ربط دفتر الأستاذ، تعديل/حذف. */
import { PrismaClient } from "@prisma/client";
import {
  احصل_رقم_فاتورة_جديد,
  احسب_إجماليات,
  جمّع_حسب_التصنيف,
  رحّل_فاتورة_للعميل,
  اعكس_قيود_الفاتورة,
  type بند_إدخال,
} from "../src/lib/invoice";

const prisma = new PrismaClient();
const رقم = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) {
  if (!ش) throw new Error("فشل: " + ر);
  console.log("✓ " + ر);
}

async function أنشئ_فاتورة(عميلId: number, بنود: بند_إدخال[], ahmedId: number) {
  const { إجمالي_الكمية, إجمالي_الوزن, الإجمالي_المالي, بنود_محسوبة } = احسب_إجماليات(بنود);
  return prisma.$transaction(async (tx) => {
    const n = await احصل_رقم_فاتورة_جديد(tx);
    const f = await tx.invoice.create({
      data: {
        number: n,
        customerId: عميلId,
        date: new Date("2026-04-01"),
        totalQty: إجمالي_الكمية,
        totalWeight: إجمالي_الوزن,
        totalAmount: الإجمالي_المالي,
        createdById: ahmedId,
        lines: {
          create: بنود_محسوبة.map((x) => ({
            color: x.اللون, qty: x._كمية, weight: x._وزن, category: x.التصنيف,
            price: x._سعر, lineTotal: x._مجموع, createdById: ahmedId,
          })),
        },
      },
    });
    await رحّل_فاتورة_للعميل(tx, {
      معرف_الفاتورة: f.id, رقم_الفاتورة: n, معرف_العميل: عميلId,
      التاريخ: new Date("2026-04-01"), القيمة: الإجمالي_المالي, أنشأ: ahmedId,
    });
    return f;
  });
}

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const عميل = await prisma.party.create({
    data: { name: "أحمد (اختبار م6)", type: "CUSTOMER", createdById: ahmed.id },
  });

  const بنود: بند_إدخال[] = [
    { اللون: "أحمر", الكمية: 5, الوزن: 100, التصنيف: "14×1", السعر: 1000 },
    { اللون: "أزرق", الكمية: 3, الوزن: 50, التصنيف: "28×2", السعر: 1500 },
    { اللون: "أخضر", الكمية: 2, الوزن: 10, التصنيف: "برج", السعر: 1000 },
  ];

  // التجميع
  const تجميع = جمّع_حسب_التصنيف(بنود.map((b) => ({ التصنيف: b.التصنيف, الكمية: b.الكمية, الوزن: b.الوزن })));
  تحقق(تجميع.length === 3, "التجميع يعطي 3 تصنيفات (14×1, 28×2, برج)");
  const t14 = تجميع.find((g) => g.التصنيف === "14×1")!;
  تحقق(رقم(t14.الوزن) === 100 && رقم(t14.الكمية) === 5, "تجميع 14×1: وزن 100 وعدد 5");

  // إنشاء الفاتورة
  const f1 = await أنشئ_فاتورة(عميل.id, بنود, ahmed.id);
  تحقق(رقم(f1.totalAmount) === 185000, "الإجمالي المالي = 185,000 (التسعير بالوزن)");
  تحقق(رقم(f1.totalWeight) === 160, "إجمالي الوزن = 160");
  تحقق(رقم(f1.totalQty) === 10, "إجمالي العدد = 10");

  let p = await prisma.party.findUniqueOrThrow({ where: { id: عميل.id } });
  تحقق(رقم(p.balance) === 185000, "العميل حصل على قيد مدين = قيمة الفاتورة → الرصيد 185,000");

  // الترقيم التسلسلي
  const f2 = await أنشئ_فاتورة(عميل.id, [{ اللون: "ل", الكمية: 1, الوزن: 1, التصنيف: "برج", السعر: 100 }], ahmed.id);
  تحقق(f2.number === f1.number + 1, `الترقيم تسلسلي (${f1.number} → ${f2.number})`);

  // تعديل الفاتورة الأولى (عكس ثم إعادة ترحيل) — تخفيض القيمة إلى 100000
  await prisma.$transaction(async (tx) => {
    await اعكس_قيود_الفاتورة(tx, f1.id, عميل.id);
    await tx.invoiceLine.deleteMany({ where: { invoiceId: f1.id } });
    const { الإجمالي_المالي, بنود_محسوبة, إجمالي_الكمية, إجمالي_الوزن } = احسب_إجماليات([
      { اللون: "أحمر", الكمية: 5, الوزن: 100, التصنيف: "14×1", السعر: 1000 },
    ]);
    await tx.invoice.update({
      where: { id: f1.id },
      data: {
        totalAmount: الإجمالي_المالي, totalQty: إجمالي_الكمية, totalWeight: إجمالي_الوزن,
        lines: { create: بنود_محسوبة.map((x) => ({ color: x.اللون, qty: x._كمية, weight: x._وزن, category: x.التصنيف, price: x._سعر, lineTotal: x._مجموع, createdById: ahmed.id })) },
      },
    });
    await رحّل_فاتورة_للعميل(tx, { معرف_الفاتورة: f1.id, رقم_الفاتورة: f1.number, معرف_العميل: عميل.id, التاريخ: new Date("2026-04-01"), القيمة: الإجمالي_المالي, أنشأ: ahmed.id });
  });
  p = await prisma.party.findUniqueOrThrow({ where: { id: عميل.id } });
  // بعد التعديل: 100000 (f1) + 100 (f2) = 100100
  تحقق(رقم(p.balance) === 100100, "بعد تعديل الفاتورة → رصيد العميل يتحدّث (100,100)");

  // حذف الفاتورة الأولى → عكس قيدها
  await prisma.$transaction(async (tx) => {
    await اعكس_قيود_الفاتورة(tx, f1.id, عميل.id);
    await tx.invoice.delete({ where: { id: f1.id } });
  });
  p = await prisma.party.findUniqueOrThrow({ where: { id: عميل.id } });
  تحقق(رقم(p.balance) === 100, "بعد حذف الفاتورة → يبقى قيد f2 فقط (100)");

  // تنظيف
  await prisma.ledgerEntry.deleteMany({ where: { partyId: عميل.id } });
  await prisma.invoice.deleteMany({ where: { customerId: عميل.id } });
  await prisma.party.delete({ where: { id: عميل.id } });
  console.log("✓ تم التنظيف");
}

main()
  .then(() => { console.log("\n✅ نجح اختبار المرحلة 6"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل اختبار المرحلة 6:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
