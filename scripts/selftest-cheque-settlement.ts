/** اختبار المرحلة 3ب: تسوية شيك صادر على دفعات (بدون بنك). */
import { PrismaClient } from "@prisma/client";
import { أضف_حركة_خزنة, احذف_حركة_خزنة_ناعم } from "../src/lib/treasury";
import { زامن_آثار_الشيك } from "../src/lib/cheques-accounting";
import { د } from "../src/lib/decimal";
const prisma = new PrismaClient();
const N = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }
const رطرف = async (id: number) => N((await prisma.party.findUniqueOrThrow({ where: { id } })).balance);
const رحساب = async (id: number) => N((await prisma.treasuryAccount.findUniqueOrThrow({ where: { id } })).balance);

// يحاكي أضف_دفعة_تسوية (منطق الأكشن)
async function دفعة(chequeId: number, amount: number, accountId: number, actor: number) {
  await prisma.$transaction(async (tx) => {
    const شيك = await tx.cheque.findUniqueOrThrow({ where: { id: chequeId } });
    const دفعات = await tx.treasuryTxn.findMany({ where: { chequeId, deletedAt: null }, select: { amount: true } });
    const مُسدَّد = دفعات.reduce((س, d) => س.plus(d.amount), د(0));
    const مكتمل = مُسدَّد.plus(amount).greaterThanOrEqualTo(د(شيك.amount).minus(0.005));
    const h = await أضف_حركة_خزنة(tx, { التاريخ: new Date(), النوع: "EXPENSE", المبلغ: amount, معرف_الحساب: accountId, البيان: "تسوية شيك", أنشأ: actor });
    await tx.treasuryTxn.update({ where: { id: h.id }, data: { chequeId } });
    if (مكتمل) await tx.cheque.update({ where: { id: chequeId }, data: { status: "SETTLED" } });
  });
}

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const cash = await prisma.treasuryAccount.findUniqueOrThrow({ where: { type: "CASH" } });
  const bank = await prisma.treasuryAccount.findUniqueOrThrow({ where: { type: "BANK" } });
  const cash0 = await رحساب(cash.id), bank0 = await رحساب(bank.id);
  const مورد = await prisma.party.create({ data: { name: "مورد تسوية", type: "SUPPLIER", openingBalance: 10000, balance: 10000, createdById: ahmed.id } });

  // شيك صادر 6000 → تسليم (مستحق المورد يقل 6000)
  const ش = await prisma.cheque.create({ data: { drawerName: "لأمر المورد", amount: 6000, direction: "OUTGOING", dueDate: new Date("2026-09-01"), status: "REGISTERED", partyId: مورد.id, createdById: ahmed.id } });
  await prisma.$transaction(async (tx) => { const c = await tx.cheque.findUniqueOrThrow({ where: { id: ش.id } }); await زامن_آثار_الشيك(tx, c as any, "PENDING", {}, ahmed.id); });
  تحقق(await رطرف(مورد.id) === 4000, "تسليم: مستحق المورد 10000 → 4000");

  // تسوية على دفعتين: 2000 نقدي + 4000 بنك (بدون بنك cashing)
  await دفعة(ش.id, 2000, cash.id, ahmed.id);
  { const c = await رحساب(cash.id); console.log("cash0=",cash0,"after=",c,"delta=",c-cash0); تحقق(c === cash0 - 2000, "دفعة 1: النقدي -2000"); }
  تحقق(N((await prisma.cheque.findUniqueOrThrow({ where: { id: ش.id } })).status === "SETTLED" ? 1 : 0) === 0, "بعد دفعة جزئية: لسه مش SETTLED");
  await دفعة(ش.id, 4000, bank.id, ahmed.id);
  { const b = await رحساب(bank.id); console.log("bank0=",bank0,"after=",b,"delta=",b-bank0); تحقق(b === bank0 - 4000, "دفعة 2: البنك -4000"); }
  const شب = await prisma.cheque.findUniqueOrThrow({ where: { id: ش.id } });
  تحقق(شب.status === "SETTLED", "اكتمال القيمة → SETTLED");
  تحقق(شب.collectedTxnId === null, "لا صرف من البنك (collectedTxnId فاضي)");
  تحقق(await رطرف(مورد.id) === 4000, "مستحق المورد ثابت (اتخصم عند الإصدار، الدفعات لا تخصم تاني)");

  // تنظيف
  await prisma.treasuryTxn.deleteMany({ where: { chequeId: ش.id } });
  await prisma.cheque.delete({ where: { id: ش.id } });
  await prisma.ledgerEntry.deleteMany({ where: { partyId: مورد.id } });
  await prisma.party.delete({ where: { id: مورد.id } });
  console.log("✓ تم التنظيف");
}
main().then(() => { console.log("\n✅ نجح اختبار التسوية على دفعات (3ب)"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
