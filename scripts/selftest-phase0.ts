/** اختبار ذاتي للمرحلة 0: اتصال قاعدة البيانات + ذهاب/إياب نص عربي (UTF8). */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const عبارة = "اختبار العربية ✓ 1,250,475.00 ج.م";
  const سجل = await prisma.healthCheck.create({ data: { note: عبارة } });
  const مقروء = await prisma.healthCheck.findUnique({ where: { id: سجل.id } });

  if (!مقروء) throw new Error("فشل قراءة السجل");
  if (مقروء.note !== عبارة) {
    throw new Error(
      `تلف الترميز! متوقع: "${عبارة}" — مقروء: "${مقروء.note}"`
    );
  }
  const عدد = await prisma.healthCheck.count();
  console.log("✓ اتصال قاعدة البيانات سليم");
  console.log(`✓ ذهاب/إياب النص العربي سليم (UTF8): "${مقروء.note}"`);
  console.log(`✓ عدد سجلات الفحص: ${عدد}`);

  // تنظيف
  await prisma.healthCheck.deleteMany();
  console.log("✓ تم تنظيف بيانات الفحص");
}

main()
  .then(() => {
    console.log("\n✅ نجح اختبار المرحلة 0");
    process.exit(0);
  })
  .catch((e) => {
    console.error("\n❌ فشل اختبار المرحلة 0:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
