/** اختبار المرحلة 6: تقارير الشيكات + أعمار الاستحقاق. */
import { PrismaClient } from "@prisma/client";
import { تقرير_الشيكات, شريحة_العمر } from "../src/lib/cheque-reports";
const prisma = new PrismaClient();
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }
const يوم = (فرق: number) => { const d = new Date(); d.setHours(12, 0, 0, 0); d.setDate(d.getDate() + فرق); return d; };

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });

  // اختبار الدالة الصرفة أولاً
  const الآن = new Date(); الآن.setHours(0, 0, 0, 0);
  تحقق(شريحة_العمر(يوم(20), الآن) === "قادمة", "شريحة: +20 يوم = قادمة");
  تحقق(شريحة_العمر(يوم(3), الآن) === "خلال_7", "شريحة: +3 يوم = خلال 7");
  تحقق(شريحة_العمر(يوم(0), الآن) === "خلال_7", "شريحة: اليوم = خلال 7");
  تحقق(شريحة_العمر(يوم(-10), الآن) === "متأخر_1_30", "شريحة: -10 = متأخر 1-30");
  تحقق(شريحة_العمر(يوم(-45), الآن) === "متأخر_31_60", "شريحة: -45 = متأخر 31-60");
  تحقق(شريحة_العمر(يوم(-75), الآن) === "متأخر_61_90", "شريحة: -75 = متأخر 61-90");
  تحقق(شريحة_العمر(يوم(-120), الآن) === "متأخر_90", "شريحة: -120 = متأخر +90");

  const BANK = "بنك اختبار التقرير الفريد";
  // شيكات واردة PENDING بمبالغ/أعمار مختلفة
  await prisma.cheque.createMany({ data: [
    { drawerName: "أ", amount: 1000, direction: "INCOMING", bankName: BANK, dueDate: يوم(20), status: "PENDING", createdById: ahmed.id },
    { drawerName: "ب", amount: 2000, direction: "INCOMING", bankName: BANK, dueDate: يوم(3), status: "PENDING", createdById: ahmed.id },
    { drawerName: "ج", amount: 3000, direction: "INCOMING", bankName: BANK, dueDate: يوم(-10), status: "PENDING", createdById: ahmed.id },
    { drawerName: "د", amount: 4000, direction: "INCOMING", bankName: BANK, dueDate: يوم(-45), status: "PENDING", createdById: ahmed.id },
    // شيك محصّل (لا يدخل الأعمار) وشيك صادر
    { drawerName: "هـ", amount: 5000, direction: "INCOMING", bankName: BANK, dueDate: يوم(-5), status: "COLLECTED", createdById: ahmed.id },
    { drawerName: "و", amount: 6000, direction: "OUTGOING", bankName: BANK, dueDate: يوم(2), status: "PENDING", createdById: ahmed.id },
  ]});

  const ت = await تقرير_الشيكات({ اسم_البنك: BANK });
  تحقق(ت.العدد === 6, "التقرير: 6 شيكات");
  تحقق(ت.الإجمالي === 21000, "التقرير: إجمالي 21000");

  const عمر = (k: string) => ت.الأعمار.find((a) => a.المفتاح === k)!;
  تحقق(عمر("قادمة").عدد === 1 && عمر("قادمة").إجمالي === 1000, "أعمار: قادمة = 1×1000");
  // خلال 7: الوارد +3 (2000) + الصادر +2 (6000) = 2 شيك / 8000
  تحقق(عمر("خلال_7").عدد === 2 && عمر("خلال_7").إجمالي === 8000, "أعمار: خلال 7 = 2×(2000+6000)");
  تحقق(عمر("متأخر_1_30").عدد === 1 && عمر("متأخر_1_30").إجمالي === 3000, "أعمار: متأخر 1-30 = 3000");
  تحقق(عمر("متأخر_31_60").عدد === 1 && عمر("متأخر_31_60").إجمالي === 4000, "أعمار: متأخر 31-60 = 4000");
  const مجموع_أعمار = ت.الأعمار.reduce((س, a) => س + a.عدد, 0);
  تحقق(مجموع_أعمار === 5, "الأعمار تشمل الـ5 المنتظرة فقط (المحصّل مستثنى)");

  const بنك = ت.حسب_البنك.find((b) => b.الاسم === BANK)!;
  تحقق(بنك.عدد === 6 && بنك.إجمالي === 21000, "حسب البنك: كامل تحت البنك الفريد");

  const محصّل = ت.الملخص_بالحالة.find((s) => s.الحالة === "COLLECTED")!;
  تحقق(محصّل.عدد === 1 && محصّل.إجمالي === 5000, "حسب الحالة: محصّل 1×5000");

  // فلتر الاتجاه: الصادر فقط
  const صادر = await تقرير_الشيكات({ اسم_البنك: BANK, الاتجاه: "OUTGOING" });
  تحقق(صادر.العدد === 1 && صادر.الإجمالي === 6000, "فلتر الاتجاه صادر: 1×6000");

  // تنظيف
  await prisma.cheque.deleteMany({ where: { bankName: BANK } });
  console.log("✓ تم التنظيف");
}
main().then(() => { console.log("\n✅ نجح اختبار تقارير الشيكات (المرحلة 6)"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
