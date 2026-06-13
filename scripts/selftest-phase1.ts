/** اختبار ذاتي للمرحلة 1: نجاح الهجرة والبذر + سلامة المخطط ونموذج الرصيد. */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

function تحقق(شرط: boolean, رسالة: string) {
  if (!شرط) throw new Error("فشل: " + رسالة);
  console.log("✓ " + رسالة);
}

async function main() {
  // المالكان مديران
  const مديرون = await prisma.user.findMany({ where: { role: "ADMIN" } });
  تحقق(مديرون.length >= 2, `يوجد مالكان مديران (${مديرون.length})`);
  تحقق(
    مديرون.some((u) => u.username === "ahmed") &&
      مديرون.some((u) => u.username === "mahmoud"),
    "المستخدمان ahmed و mahmoud موجودان"
  );
  تحقق(
    مديرون.every((u) => u.mustChangePassword),
    "كلمة المرور المؤقتة مُعلَّمة للتغيير (mustChangePassword)"
  );

  // 4 حسابات خزنة
  const حسابات = await prisma.treasuryAccount.count();
  تحقق(حسابات === 4, `حسابات الخزنة الأربعة موجودة (${حسابات})`);

  // الإعدادات
  const عداد = await prisma.setting.findUnique({ where: { key: "عداد_الفواتير" } });
  تحقق(عداد?.value === "5650", "عدّاد الفواتير = 5650 (أول رقم سيكون 5651)");

  // نموذج الرصيد: حقول Decimal تعمل
  const عميل = await prisma.party.create({
    data: {
      name: "عميل اختبار المخطط",
      type: "CUSTOMER",
      balance: "185000.5000",
      createdById: مديرون[0].id,
    },
  });
  تحقق(عميل.balance.toString() === "185000.5", "حقل الرصيد Decimal يخزّن بدقة");

  // قيد دفتر أستاذ مرتبط بالطرف (مدين/دائن/الرصيد بعد الحركة)
  const قيد = await prisma.ledgerEntry.create({
    data: {
      partyId: عميل.id,
      date: new Date(),
      description: "قيد اختبار",
      debit: "185000",
      credit: "0",
      balanceAfter: "185000",
      createdById: مديرون[0].id,
    },
  });
  تحقق(قيد.debit.toString() === "185000", "قيد دفتر الأستاذ (مدين) يُنشأ ومرتبط بالطرف");

  // منع حذف طرف له حركات (onDelete: Restrict)
  let مُنع = false;
  try {
    await prisma.party.delete({ where: { id: عميل.id } });
  } catch {
    مُنع = true;
  }
  تحقق(مُنع, "لا يمكن حذف طرف له حركات حساب (Restrict)");

  // تنظيف
  await prisma.ledgerEntry.delete({ where: { id: قيد.id } });
  await prisma.party.delete({ where: { id: عميل.id } });
  console.log("✓ تم التنظيف");
}

main()
  .then(() => {
    console.log("\n✅ نجح اختبار المرحلة 1");
    process.exit(0);
  })
  .catch((e) => {
    console.error("\n❌ فشل اختبار المرحلة 1:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
