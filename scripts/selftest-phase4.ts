/** اختبار ذاتي للمرحلة 4: دفتر الأستاذ واتفاقيات الرصيد + إعادة الحساب. */
import { PrismaClient } from "@prisma/client";
import { أضف_قيد, أعد_حساب_سلسلة_الطرف } from "../src/lib/ledger";

const prisma = new PrismaClient();
function تحقق(ش: boolean, ر: string) {
  if (!ش) throw new Error("فشل: " + ر);
  console.log("✓ " + ر);
}
const رقم = (v: unknown) => Number(v);

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });

  // ===== سيناريو العميل المرجعي =====
  const عميل = await prisma.party.create({
    data: { name: "أحمد (اختبار م4)", type: "CUSTOMER", createdById: ahmed.id },
  });
  تحقق(رقم((await prisma.party.findUniqueOrThrow({ where: { id: عميل.id } })).balance) === 0, "رصيد العميل يبدأ 0");

  // فاتورة يدوية: مدين 185000
  await prisma.$transaction((tx) =>
    أضف_قيد(tx, { معرف_الطرف: عميل.id, التاريخ: new Date("2026-01-01"), البيان: "فاتورة #5651", مدين: 185000, أنشأ: ahmed.id })
  );
  let p = await prisma.party.findUniqueOrThrow({ where: { id: عميل.id } });
  تحقق(رقم(p.balance) === 185000, "بعد مدين 185,000 → الرصيد 185,000 (مديونية)");

  // دفعة: دائن 50000
  const قيد_دفعة = await prisma.$transaction((tx) =>
    أضف_قيد(tx, { معرف_الطرف: عميل.id, التاريخ: new Date("2026-01-05"), البيان: "تحصيل دفعة — بنك", دائن: 50000, أنشأ: ahmed.id })
  );
  p = await prisma.party.findUniqueOrThrow({ where: { id: عميل.id } });
  تحقق(رقم(p.balance) === 135000, "بعد دائن 50,000 → الرصيد 135,000");

  // التحقق من الرصيد الجاري في الحركات
  const حركات = await prisma.ledgerEntry.findMany({
    where: { partyId: عميل.id },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });
  تحقق(رقم(حركات[0].balanceAfter) === 185000, "الرصيد بعد الحركة الأولى = 185,000");
  تحقق(رقم(حركات[1].balanceAfter) === 135000, "الرصيد بعد الحركة الثانية = 135,000");

  // حذف الدفعة → إعادة الحساب → الرصيد يعود 185000
  await prisma.$transaction(async (tx) => {
    await tx.ledgerEntry.delete({ where: { id: قيد_دفعة.id } });
    await أعد_حساب_سلسلة_الطرف(tx, عميل.id);
  });
  p = await prisma.party.findUniqueOrThrow({ where: { id: عميل.id } });
  تحقق(رقم(p.balance) === 185000, "بعد حذف الدفعة → الرصيد يعود 185,000 (إعادة حساب صحيحة)");

  // ===== سيناريو المورد (المرآة) =====
  const مورد = await prisma.party.create({
    data: { name: "مورد (اختبار م4)", type: "SUPPLIER", createdById: ahmed.id },
  });
  await prisma.$transaction((tx) =>
    أضف_قيد(tx, { معرف_الطرف: مورد.id, التاريخ: new Date("2026-02-01"), البيان: "مشتريات", دائن: 100000, أنشأ: ahmed.id })
  );
  let s = await prisma.party.findUniqueOrThrow({ where: { id: مورد.id } });
  تحقق(رقم(s.balance) === 100000, "مورد: بعد دائن 100,000 → المستحق 100,000");
  await prisma.$transaction((tx) =>
    أضف_قيد(tx, { معرف_الطرف: مورد.id, التاريخ: new Date("2026-02-03"), البيان: "صرف للمورد", مدين: 30000, أنشأ: ahmed.id })
  );
  s = await prisma.party.findUniqueOrThrow({ where: { id: مورد.id } });
  تحقق(رقم(s.balance) === 70000, "مورد: بعد مدين 30,000 → المستحق 70,000");

  // تنظيف
  await prisma.ledgerEntry.deleteMany({ where: { partyId: { in: [عميل.id, مورد.id] } } });
  await prisma.party.deleteMany({ where: { id: { in: [عميل.id, مورد.id] } } });
  console.log("✓ تم التنظيف");
}

main()
  .then(() => {
    console.log("\n✅ نجح اختبار المرحلة 4");
    process.exit(0);
  })
  .catch((e) => {
    console.error("\n❌ فشل اختبار المرحلة 4:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
