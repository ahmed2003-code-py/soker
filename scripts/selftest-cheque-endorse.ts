/** اختبار المرحلة 3أ: تظهير شيك وارد لمورد + التحصيل النقدي/البنكي. */
import { PrismaClient } from "@prisma/client";
import { زامن_آثار_الشيك } from "../src/lib/cheques-accounting";
const prisma = new PrismaClient();
const N = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }
const رطرف = async (id: number) => N((await prisma.party.findUniqueOrThrow({ where: { id } })).balance);
const رحساب = async (id: number) => N((await prisma.treasuryAccount.findUniqueOrThrow({ where: { id } })).balance);
async function حالة(id: number, s: any, خيارات: any, actor: number) {
  await prisma.$transaction(async (tx) => {
    const c = await tx.cheque.findUniqueOrThrow({ where: { id } });
    await زامن_آثار_الشيك(tx, c as any, s, خيارات, actor);
  });
}
async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const cash = await prisma.treasuryAccount.findUniqueOrThrow({ where: { type: "CASH" } });
  const bank = await prisma.treasuryAccount.findUniqueOrThrow({ where: { type: "BANK" } });
  const cash0 = await رحساب(cash.id), bank0 = await رحساب(bank.id);
  const عميل = await prisma.party.create({ data: { name: "عميل تظهير", type: "CUSTOMER", openingBalance: 20000, balance: 20000, createdById: ahmed.id } });
  const مورد = await prisma.party.create({ data: { name: "مورد تظهير", type: "SUPPLIER", openingBalance: 15000, balance: 15000, createdById: ahmed.id } });

  // شيك وارد 5000 مربوط بالعميل، استلام
  const ش = await prisma.cheque.create({ data: { drawerName: "عميل", amount: 5000, direction: "INCOMING", dueDate: new Date("2026-09-01"), status: "REGISTERED", partyId: عميل.id, createdById: ahmed.id } });
  await حالة(ش.id, "PENDING", {}, ahmed.id);
  تحقق(await رطرف(عميل.id) === 15000, "استلام: دين العميل 20000 → 15000");

  // تظهير للمورد → مستحق المورد يقل 5000، لا خزنة، دين العميل ثابت
  await حالة(ش.id, "ENDORSED", { معرف_المورد_للتظهير: مورد.id }, ahmed.id);
  تحقق(await رطرف(مورد.id) === 10000, "تظهير: مستحق المورد 15000 → 10000 (مدين 5000)");
  تحقق(await رطرف(عميل.id) === 15000, "تظهير: دين العميل ثابت (اتخصم عند الاستلام)");
  تحقق(await رحساب(bank.id) === bank0 && await رحساب(cash.id) === cash0, "تظهير: لا حركة خزنة");
  const شم = await prisma.cheque.findUniqueOrThrow({ where: { id: ش.id } });
  تحقق(شم.endorsedToId === مورد.id && شم.endorseLedgerEntryId != null, "الشيك مُسجّل مُظهَّراً للمورد");

  // ارتداد → يرجع مستحق المورد ودين العميل
  await حالة(ش.id, "BOUNCED", {}, ahmed.id);
  تحقق(await رطرف(مورد.id) === 15000, "ارتداد: مستحق المورد يرجع 15000");
  تحقق(await رطرف(عميل.id) === 20000, "ارتداد: دين العميل يرجع 20000");

  // شيك وارد آخر → تحصيل نقدي (كاش مش بنك)
  const ش2 = await prisma.cheque.create({ data: { drawerName: "عميل2", amount: 3000, direction: "INCOMING", dueDate: new Date("2026-09-01"), status: "PENDING", createdById: ahmed.id } });
  await حالة(ش2.id, "COLLECTED", { معرف_حساب_التحصيل: cash.id, معرف_حساب_فرعي: null }, ahmed.id);
  تحقق(await رحساب(cash.id) === cash0 + 3000, "تحصيل نقدي: النقدي +3000");
  تحقق(await رحساب(bank.id) === bank0, "تحصيل نقدي: البنك ثابت");

  // تنظيف
  for (const id of [ش.id, ش2.id]) await prisma.cheque.delete({ where: { id } });
  for (const p of [عميل.id, مورد.id]) { await prisma.ledgerEntry.deleteMany({ where: { partyId: p } }); await prisma.party.delete({ where: { id: p } }); }
  await prisma.treasuryTxn.deleteMany({ where: { description: { contains: "شيك" } } });
  console.log("✓ تم التنظيف");
}
main().then(() => { console.log("\n✅ نجح اختبار التظهير (3أ)"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
