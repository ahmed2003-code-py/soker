/** اختبار ذاتي للمرحلة 0: اتصال قاعدة البيانات + ذهاب/إياب نص عربي (UTF8) عبر استعلام خام. */
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  const عبارة = "اختبار العربية ✓ 1,250,475.00 ج.م";
  const نتيجة = await prisma.$queryRaw<{ val: string }[]>`SELECT ${عبارة}::text AS val`;
  if (!نتيجة[0] || نتيجة[0].val !== عبارة) {
    throw new Error(`تلف الترميز! متوقع "${عبارة}" — مقروء "${نتيجة[0]?.val}"`);
  }
  console.log("✓ اتصال قاعدة البيانات سليم");
  console.log(`✓ ذهاب/إياب النص العربي سليم (UTF8): "${نتيجة[0].val}"`);
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
