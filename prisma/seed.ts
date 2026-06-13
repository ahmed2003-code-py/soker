/** بذر البيانات الأساسية: مالكان (مدير)، 4 حسابات خزنة، إعدادات أساسية. */
import { PrismaClient, TreasuryAccountType } from "@prisma/client";
import bcrypt from "bcryptjs";

const prisma = new PrismaClient();

const كلمة_المرور_المؤقتة = "Soker@2026";

async function main() {
  const hash = await bcrypt.hash(كلمة_المرور_المؤقتة, 10);

  // ===== المالكان (ADMIN) =====
  const أحمد = await prisma.user.upsert({
    where: { username: "ahmed" },
    update: {},
    create: {
      name: "أحمد سكر",
      username: "ahmed",
      passwordHash: hash,
      role: "ADMIN",
      active: true,
      mustChangePassword: true, // 🔴 كلمة مرور مؤقتة — يجب تغييرها
    },
  });

  const محمود = await prisma.user.upsert({
    where: { username: "mahmoud" },
    update: {},
    create: {
      name: "محمود سكر",
      username: "mahmoud",
      passwordHash: hash,
      role: "ADMIN",
      active: true,
      mustChangePassword: true,
    },
  });

  console.log(`✓ المستخدمون: ${أحمد.name} (ahmed), ${محمود.name} (mahmoud) — مدير`);
  console.log(`  🔴 كلمة المرور المؤقتة للاثنين: ${كلمة_المرور_المؤقتة} (غيّرها بعد الدخول)`);

  // ===== حسابات الخزنة الأربعة =====
  const أنواع: TreasuryAccountType[] = ["INSTAPAY", "CASH", "BANK", "VODAFONE"];
  for (const نوع of أنواع) {
    await prisma.treasuryAccount.upsert({
      where: { type: نوع },
      update: {},
      create: { type: نوع, balance: 0, minThreshold: 0 },
    });
  }
  console.log("✓ حسابات الخزنة: إنستا باي / نقدي / بنك / فودافون كاش");

  // ===== الإعدادات الأساسية =====
  const إعدادات: Record<string, string> = {
    "اسم_الشركة": "مؤسسة سكر للتجارة",
    "شعار_الشركة": "", // base64 لاحقاً من صفحة الإعدادات
    "حد_الائتمان_الافتراضي": "0",
    "طرق_الدفع": JSON.stringify(["نقدي", "إنستا باي", "بنك", "فودافون كاش"]),
    "عملة": "ج.م",
    // عدّاد ترقيم الفواتير: آمن للتزامن عبر تحديث ذرّي داخل $transaction.
    // يبدأ من 5650 ليكون أول رقم فاتورة 5651 (مطابقاً للمثال المرجعي).
    "عداد_الفواتير": "5650",
  };
  for (const [key, value] of Object.entries(إعدادات)) {
    await prisma.setting.upsert({
      where: { key },
      update: {},
      create: { key, value },
    });
  }
  console.log("✓ الإعدادات الأساسية");
}

main()
  .then(() => {
    console.log("\n✅ تم البذر بنجاح");
    process.exit(0);
  })
  .catch((e) => {
    console.error("\n❌ فشل البذر:", e);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
