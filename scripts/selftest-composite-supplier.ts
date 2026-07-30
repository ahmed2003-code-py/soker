/** اختبار 3ج: سداد مركب لمورد (كاش + بنك + شيك وارد مُظهَّر). */
import { PrismaClient } from "@prisma/client";
import { أنشئ_دفعة_موزعة } from "../src/lib/integration";
import { زامن_آثار_الشيك } from "../src/lib/cheques-accounting";
import { د } from "../src/lib/decimal";
const prisma = new PrismaClient();
const N = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }
const رطرف = async (id: number) => N((await prisma.party.findUniqueOrThrow({ where: { id } })).balance);
const رحساب = async (id: number) => N((await prisma.treasuryAccount.findUniqueOrThrow({ where: { id } })).balance);
async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const cash = await prisma.treasuryAccount.findUniqueOrThrow({ where: { type: "CASH" } });
  const bank = await prisma.treasuryAccount.findUniqueOrThrow({ where: { type: "BANK" } });
  const c0 = await رحساب(cash.id), b0 = await رحساب(bank.id);
  const مورد = await prisma.party.create({ data: { name: "مورد سداد مركب اختبار", type: "SUPPLIER", openingBalance: 20000, balance: 20000, createdById: ahmed.id } });
  const عميل = await prisma.party.create({ data: { name: "عميل شيك سداد اختبار", type: "CUSTOMER", openingBalance: 10000, balance: 10000, createdById: ahmed.id } });
  // شيك وارد 4000 من العميل، مستلم (PENDING) → دين العميل قل 4000
  const ش = await prisma.cheque.create({ data: { drawerName: "عميل", amount: 4000, direction: "INCOMING", dueDate: new Date("2026-09-01"), status: "PENDING", partyId: عميل.id, partyLedgerEntryId: null, createdById: ahmed.id } });
  await prisma.$transaction(async (tx) => { const c = await tx.cheque.findUniqueOrThrow({ where: { id: ش.id } }); await زامن_آثار_الشيك(tx, c as any, "PENDING", {}, ahmed.id); });
  تحقق(await رطرف(عميل.id) === 6000, "استلام الشيك: دين العميل 10000 → 6000");

  // سداد مركب: 5000 نقدي + 3000 بنك + شيك 4000 = 12000
  await prisma.$transaction(async (tx) => {
    await أنشئ_دفعة_موزعة(tx, { الاتجاه: "صرف", معرف_الطرف: مورد.id, اسم_الطرف: مورد.name, الإجمالي: د(8000), التاريخ: new Date(),
      بنود: [ { معرف_الحساب: cash.id, المبلغ: د(5000), طريقة_الدفع: "نقدي" }, { معرف_الحساب: bank.id, المبلغ: د(3000), طريقة_الدفع: "بنك" } ], أنشأ: ahmed.id });
    const c = await tx.cheque.findUniqueOrThrow({ where: { id: ش.id } });
    await زامن_آثار_الشيك(tx, c as any, "ENDORSED", { معرف_المورد_للتظهير: مورد.id }, ahmed.id);
  });
  تحقق(await رحساب(cash.id) === c0 - 5000, "النقدي -5000");
  تحقق(await رحساب(bank.id) === b0 - 3000, "البنك -3000");
  تحقق(await رطرف(مورد.id) === 8000, "مستحق المورد 20000 → 8000 (خُصم 12000: 8000 خزنة + 4000 شيك)");
  const شب = await prisma.cheque.findUniqueOrThrow({ where: { id: ش.id } });
  تحقق(شب.status === "ENDORSED" && شب.endorsedToId === مورد.id, "الشيك مُظهَّر للمورد");
  تحقق(await رطرف(عميل.id) === 6000, "دين العميل ثابت (الشيك مستلَم قبل كده)");

  // تنظيف
  await prisma.treasuryTxn.deleteMany({ where: { OR: [{ partyId: مورد.id }, { chequeId: ش.id } ] } });
  await prisma.cheque.delete({ where: { id: ش.id } });
  for (const p of [مورد.id, عميل.id]) { await prisma.ledgerEntry.deleteMany({ where: { partyId: p } }); await prisma.treasuryTxn.deleteMany({ where: { partyId: p } }); await prisma.party.delete({ where: { id: p } }); }
  await prisma.$transaction(async (tx) => { const { أعد_حساب_حساب_الخزنة } = await import("../src/lib/treasury"); for (const h of [cash.id, bank.id]) await أعد_حساب_حساب_الخزنة(tx, h); });
  console.log("✓ تم التنظيف");
}
main().then(() => { console.log("\n✅ نجح اختبار السداد المركب (3ج)"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
