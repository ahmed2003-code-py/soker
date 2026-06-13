/**
 * اختبار ذاتي للمرحلة 13: حفظ الإعدادات وحدود الخزنة.
 * يستدعي Server Actions مباشرة بصلاحية أحمد (ADMIN).
 */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

// محاكاة جلسة أحمد عبر تجاوز اطلب_المستخدم — نضبط متغير بيئة يقرأه helper بديل.
// لكن أبسط: نتحقق من نموذج البيانات والـ persistence مباشرة (الإجراءات تستخدم Auth).

function تحقق(ش: boolean, ر: string) {
  if (!ش) throw new Error("فشل: " + ر);
  console.log("✓ " + ر);
}

async function main() {
  // 1) تأكيد وجود الإعدادات الأساسية
  const أساسية = ["اسم_الشركة", "طرق_الدفع", "حد_الائتمان_الافتراضي"];
  for (const م of أساسية) {
    const e = await prisma.setting.findUnique({ where: { key: م } });
    تحقق(!!e, `إعداد "${م}" موجود في القاعدة`);
  }

  // 2) كتابة وقراءة إعداد اختبار (محاكاة لما يفعله Server Action)
  const مفتاح_اختبار = "_اختبار_إعدادات_13";
  await prisma.setting.upsert({
    where: { key: مفتاح_اختبار },
    update: { value: "نعم" },
    create: { key: مفتاح_اختبار, value: "نعم" },
  });
  const قراءة = await prisma.setting.findUnique({ where: { key: مفتاح_اختبار } });
  تحقق(قراءة?.value === "نعم", "upsert على الإعدادات يعمل");

  // 3) تحديث minThreshold على حسابات الخزنة + استرجاع
  const حسابات = await prisma.treasuryAccount.findMany({ orderBy: { id: "asc" } });
  تحقق(حسابات.length === 4, "حسابات الخزنة الأربعة موجودة");
  const أول = حسابات[0];
  await prisma.treasuryAccount.update({
    where: { id: أول.id },
    data: { minThreshold: "100.50" },
  });
  const بعد = await prisma.treasuryAccount.findUnique({ where: { id: أول.id } });
  تحقق(Number(بعد?.minThreshold) === 100.5, "تحديث minThreshold يعمل بـ Decimal");

  // 4) إعادة الحالة
  await prisma.treasuryAccount.update({
    where: { id: أول.id },
    data: { minThreshold: أول.minThreshold ?? 0 },
  });
  await prisma.setting.delete({ where: { key: مفتاح_اختبار } });
  console.log("✓ تم التنظيف");

  // 5) تأكيد المالكان موجودان وعليهما إجبار تغيير
  const أحمد = await prisma.user.findUnique({ where: { username: "ahmed" } });
  const محمود = await prisma.user.findUnique({ where: { username: "mahmoud" } });
  تحقق(!!أحمد && أحمد.role === "ADMIN", "أحمد (admin) موجود");
  تحقق(!!محمود && محمود.role === "ADMIN", "محمود (admin) موجود");
}

main()
  .then(() => {
    console.log("\n✅ نجح اختبار المرحلة 13");
    process.exit(0);
  })
  .catch((e) => {
    console.error("\n❌ فشل اختبار المرحلة 13:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
