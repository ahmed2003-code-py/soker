/** اختبار ذاتي للمرحلة 10: تطابق أرقام اللوحة مع الوحدات. */
import { PrismaClient } from "@prisma/client";
import { بيانات_اللوحة } from "../src/lib/dashboard";

const prisma = new PrismaClient();
const رقم = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) {
  if (!ش) throw new Error("فشل: " + ر);
  console.log("✓ " + ر);
}

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  // عملاء بأرصدة
  const ع1 = await prisma.party.create({ data: { name: "ع لوحة 1", type: "CUSTOMER", balance: "100000", createdById: ahmed.id } });
  const ع2 = await prisma.party.create({ data: { name: "ع لوحة 2", type: "CUSTOMER", balance: "50000", createdById: ahmed.id } });
  await prisma.party.create({ data: { name: "ع لوحة 3 (مسدّد)", type: "CUSTOMER", balance: "0", createdById: ahmed.id } });
  const م1 = await prisma.party.create({ data: { name: "مورد لوحة 1", type: "SUPPLIER", balance: "30000", createdById: ahmed.id } });

  const د = await بيانات_اللوحة();

  // تطابق مديونية العملاء = مجموع أرصدة العملاء الموجبة
  const مجموع_العملاء = await prisma.party.aggregate({ where: { type: "CUSTOMER", balance: { gt: 0 } }, _sum: { balance: true } });
  تحقق(د.العملاء.إجمالي_المديونية === رقم(مجموع_العملاء._sum.balance), "إجمالي مديونية اللوحة = مجموع أرصدة العملاء الموجبة");

  // تطابق مستحقات الموردين
  const مجموع_الموردين = await prisma.party.aggregate({ where: { type: "SUPPLIER", balance: { gt: 0 } }, _sum: { balance: true } });
  تحقق(د.الموردون.إجمالي_المستحقات === رقم(مجموع_الموردين._sum.balance), "إجمالي مستحقات اللوحة = مجموع أرصدة الموردين الموجبة");

  // تطابق إجمالي الخزنة
  const حسابات = await prisma.treasuryAccount.findMany();
  const مجموع_الخزنة = حسابات.reduce((س, h) => س + رقم(h.balance), 0);
  تحقق(د.الخزنة.الإجمالي === مجموع_الخزنة, "إجمالي الخزنة في اللوحة = مجموع الحسابات");

  // السلسلة 12 شهراً
  تحقق(د.السلسلة.length === 12, "سلسلة الرسوم تغطي 12 شهراً");

  // أعلى المدينين مرتّبة تنازلياً
  تحقق(
    د.العملاء.الأعلى[0]?.الرصيد >= (د.العملاء.الأعلى[1]?.الرصيد ?? 0),
    "أعلى العملاء مرتّبون تنازلياً"
  );

  // تنظيف
  await prisma.party.deleteMany({ where: { id: { in: [ع1.id, ع2.id, م1.id] } } });
  await prisma.party.deleteMany({ where: { name: "ع لوحة 3 (مسدّد)" } });
  console.log("✓ تم التنظيف");
}

main()
  .then(() => { console.log("\n✅ نجح اختبار المرحلة 10"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل اختبار المرحلة 10:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
