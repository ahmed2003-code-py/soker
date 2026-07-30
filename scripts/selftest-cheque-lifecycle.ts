/** اختبار: الحالات الجديدة للشيك + الربط بالطرف (schema المرحلة 1). */
import { PrismaClient, ChequeStatus } from "@prisma/client";
const prisma = new PrismaClient();
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const عميل = await prisma.party.create({ data: { name: "عميل شيك اختبار", type: "CUSTOMER", createdById: ahmed.id } });

  // إنشاء شيك مسجّل مربوط بعميل
  const شيك = await prisma.cheque.create({
    data: { drawerName: "x", amount: 5000, direction: "INCOMING", dueDate: new Date("2026-08-01"),
      status: "REGISTERED", partyId: عميل.id, createdById: ahmed.id },
  });
  تحقق(شيك.status === "REGISTERED", "أُنشئ الشيك بحالة مسجّل (REGISTERED)");
  تحقق(شيك.partyId === عميل.id, "الشيك مربوط بالعميل");

  // انتقال عبر الحالات الجديدة
  for (const s of ["PENDING", "DEPOSITED", "ENDORSED", "COLLECTED", "BOUNCED", "CANCELLED"] as ChequeStatus[]) {
    const u = await prisma.cheque.update({ where: { id: شيك.id }, data: { status: s } });
    تحقق(u.status === s, `قبلت القاعدة الحالة: ${s}`);
  }

  // العلاقة تُحمَّل، والطرف يعرف شيكاته
  const مع_الطرف = await prisma.cheque.findUniqueOrThrow({ where: { id: شيك.id }, include: { party: true } });
  تحقق(مع_الطرف.party?.name === "عميل شيك اختبار", "علاقة الشيك ← الطرف تعمل");
  const شيكات_العميل = await prisma.cheque.count({ where: { partyId: عميل.id } });
  تحقق(شيكات_العميل === 1, "العميل يعرف شيكاته (back-relation)");

  // تنظيف
  await prisma.cheque.delete({ where: { id: شيك.id } });
  await prisma.party.delete({ where: { id: عميل.id } });
  console.log("✓ تم التنظيف");
}
main().then(() => { console.log("\n✅ نجح اختبار دورة حياة الشيك (مرحلة 1)"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
