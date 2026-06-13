/** اختبار ذاتي للمرحلة 7: الشيكات — التجميع الشهري، المتأخر، التنبيهات. */
import { PrismaClient } from "@prisma/client";
import { متأخر, جمّع_الشيكات_شهرياً, تنبيهات_الشيكات } from "../src/lib/cheques";

const prisma = new PrismaClient();
function تحقق(ش: boolean, ر: string) {
  if (!ش) throw new Error("فشل: " + ر);
  console.log("✓ " + ر);
}
const بعد_أيام = (n: number) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return d;
};

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });

  // شيكات عبر 3 أشهر + واحد متأخر
  const مدخلات = [
    { drawerName: "عميل أ", amount: 10000, dueDate: بعد_أيام(3), status: "PENDING" as const }, // خلال 7 أيام
    { drawerName: "عميل ب", amount: 20000, dueDate: بعد_أيام(40), status: "PENDING" as const },
    { drawerName: "عميل ج", amount: 30000, dueDate: بعد_أيام(70), status: "PENDING" as const },
    { drawerName: "عميل د", amount: 5000, dueDate: بعد_أيام(-10), status: "PENDING" as const }, // متأخر
    { drawerName: "عميل هـ", amount: 7000, dueDate: بعد_أيام(-5), status: "COLLECTED" as const }, // محصّل (ليس متأخراً)
  ];
  const مُنشأة = [];
  for (const م of مدخلات) {
    مُنشأة.push(
      await prisma.cheque.create({ data: { ...م, createdById: ahmed.id } })
    );
  }

  // المتأخر
  تحقق(متأخر(بعد_أيام(-10), "PENDING"), "شيك منتظر تجاوز استحقاقه = متأخر");
  تحقق(!متأخر(بعد_أيام(-5), "COLLECTED"), "شيك محصّل ليس متأخراً ولو فات تاريخه");
  تحقق(!متأخر(بعد_أيام(5), "PENDING"), "شيك مستقبلي ليس متأخراً");

  // التجميع الشهري
  const تجميع = جمّع_الشيكات_شهرياً(
    مُنشأة.map((c) => ({ تاريخ_الاستحقاق: c.dueDate.toISOString(), المبلغ: Number(c.amount) }))
  );
  تحقق(تجميع.length >= 3, `التجميع الشهري ينتج ${تجميع.length} مجموعات (≥3)`);
  const مجموع_كلي = تجميع.reduce((س, g) => س + g.إجمالي, 0);
  تحقق(مجموع_كلي === 72000, "مجموع كل المجموعات = 72,000");

  // التنبيهات
  const ت = await تنبيهات_الشيكات();
  تحقق(ت.عدد_خلال_7 >= 1, "تنبيه: شيك واحد على الأقل يستحق خلال 7 أيام");
  تحقق(ت.عدد_متأخر >= 1, "تنبيه: شيك متأخر واحد على الأقل");
  تحقق(
    ت.قائمة_متأخرة.some((c) => c.اسم_المدين === "عميل د"),
    "قائمة المتأخرة تتضمن عميل د"
  );

  // تنظيف
  await prisma.cheque.deleteMany({ where: { id: { in: مُنشأة.map((c) => c.id) } } });
  console.log("✓ تم التنظيف");
}

main()
  .then(() => { console.log("\n✅ نجح اختبار المرحلة 7"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل اختبار المرحلة 7:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
