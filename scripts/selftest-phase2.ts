/** اختبار ذاتي للمرحلة 2: الصلاحيات + كلمة المرور + سجل العمليات + طوابع المساءلة. */
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcryptjs";
import { يستطيع } from "../src/lib/authz";
import { تسجيل_عملية, سجل_الكيان } from "../src/lib/activity";

const prisma = new PrismaClient();
function تحقق(ش: boolean, ر: string) {
  if (!ش) throw new Error("فشل: " + ر);
  console.log("✓ " + ر);
}

async function main() {
  // 1) مصفوفة الصلاحيات
  تحقق(يستطيع("ADMIN", "إدارة_المستخدمين"), "المدير يستطيع إدارة المستخدمين");
  تحقق(يستطيع("ACCOUNTANT", "كتابة"), "المحاسب يستطيع الكتابة");
  تحقق(!يستطيع("ACCOUNTANT", "إدارة_المستخدمين"), "المحاسب لا يدير المستخدمين");
  تحقق(يستطيع("READONLY", "قراءة"), "قراءة-فقط يقرأ");
  تحقق(!يستطيع("READONLY", "كتابة"), "قراءة-فقط لا يكتب");
  تحقق(!يستطيع("READONLY", "حذف"), "قراءة-فقط لا يحذف");

  // 2) كلمة المرور المبذورة
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const mahmoud = await prisma.user.findUniqueOrThrow({ where: { username: "mahmoud" } });
  تحقق(await bcrypt.compare("Soker@2026", ahmed.passwordHash), "كلمة مرور أحمد صحيحة");
  تحقق(!(await bcrypt.compare("غلط", ahmed.passwordHash)), "كلمة مرور خاطئة تُرفض");

  // 3) طوابع المساءلة (created/updated by)
  const طرف = await prisma.party.create({
    data: {
      name: "طرف اختبار المساءلة",
      type: "CUSTOMER",
      createdById: ahmed.id,
      updatedById: mahmoud.id,
    },
    include: { createdBy: true, updatedBy: true },
  });
  تحقق(طرف.createdBy.name === "أحمد سكر", "أنشئ_بواسطة = أحمد سكر");
  تحقق(طرف.updatedBy?.name === "محمود سكر", "عُدّل_بواسطة = محمود سكر");

  // 4) سجل العمليات + التصفية حسب الشخص
  await prisma.$transaction(async (tx) => {
    await تسجيل_عملية(tx, {
      المستخدم: ahmed.id,
      العملية: "CREATE",
      نوع_الكيان: "الطرف",
      معرف_الكيان: طرف.id,
      التفاصيل: { الاسم: طرف.name },
    });
    await تسجيل_عملية(tx, {
      المستخدم: mahmoud.id,
      العملية: "UPDATE",
      نوع_الكيان: "الطرف",
      معرف_الكيان: طرف.id,
      التفاصيل: { تعديل: "اختبار" },
    });
  });
  const سجل = await سجل_الكيان("الطرف", طرف.id);
  تحقق(سجل.length === 2, `سجل الكيان فيه عمليتان (${سجل.length})`);

  const عمليات_أحمد = await prisma.activityLog.count({
    where: { userId: ahmed.id, entityType: "الطرف", entityId: طرف.id },
  });
  const عمليات_محمود = await prisma.activityLog.count({
    where: { userId: mahmoud.id, entityType: "الطرف", entityId: طرف.id },
  });
  تحقق(عمليات_أحمد === 1, "تصفية: عملية واحدة لأحمد");
  تحقق(عمليات_محمود === 1, "تصفية: عملية واحدة لمحمود");

  // تنظيف
  await prisma.activityLog.deleteMany({ where: { entityType: "الطرف", entityId: طرف.id } });
  await prisma.party.delete({ where: { id: طرف.id } });
  console.log("✓ تم التنظيف");
}

main()
  .then(() => {
    console.log("\n✅ نجح اختبار المرحلة 2");
    process.exit(0);
  })
  .catch((e) => {
    console.error("\n❌ فشل اختبار المرحلة 2:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
