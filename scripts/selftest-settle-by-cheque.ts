/** اختبار: تسوية شيك صادر بشيك وارد — بلا أثر على رصيد المورد/العميل، يتشال من خزنة الشيكات، ويُحسب مسدَّداً. */
import { PrismaClient } from "@prisma/client";
import { زامن_آثار_الشيك, رصيد_خزنة_الشيكات, مُسدَّد_تسوية, دخل_معاملة_مالية } from "../src/lib/cheques-accounting";
import { أضف_حركة_خزنة } from "../src/lib/treasury";
const prisma = new PrismaClient();
const N = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }
const رطرف = async (id: number) => N((await prisma.party.findUniqueOrThrow({ where: { id } })).balance);
const رخزنة_شيكات = async () => N(await رصيد_خزنة_الشيكات(prisma));
const مسدَّد = async (id: number) => N(await مُسدَّد_تسوية(prisma, id));

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const cash = await prisma.treasuryAccount.findUniqueOrThrow({ where: { type: "CASH" } });
  const c0 = N((await prisma.treasuryAccount.findUniqueOrThrow({ where: { id: cash.id } })).balance);
  const خ0 = await رخزنة_شيكات();

  const مورد = await prisma.party.create({ data: { name: "مورد تسوية بشيك", type: "SUPPLIER", openingBalance: 4000, balance: 4000, createdById: ahmed.id } });
  const عميل = await prisma.party.create({ data: { name: "عميل شيك تسوية", type: "CUSTOMER", openingBalance: 10000, balance: 10000, createdById: ahmed.id } });

  // شيك صادر 10000 «تحت الصرف» (المستحق للمورد افتُرض اتخصم وقت الإصدار — نثبته هنا)
  const صادر = await prisma.cheque.create({ data: { drawerName: "لأمر المورد", amount: 10000, direction: "OUTGOING", dueDate: new Date("2026-09-01"), status: "PENDING", partyId: مورد.id, accountingVersion: 1, createdById: ahmed.id } });
  const مستحق_قبل = await رطرف(مورد.id); // 4000

  // شيك وارد 3000 v2 مسجّل من العميل → خزنة الشيكات +3000، دين العميل 10000→7000
  const وارد = await prisma.cheque.create({ data: { drawerName: "عميل", amount: 3000, direction: "INCOMING", dueDate: new Date("2026-09-05"), status: "REGISTERED", partyId: عميل.id, accountingVersion: 2, createdById: ahmed.id } });
  await prisma.$transaction(async (tx) => { const c = await tx.cheque.findUniqueOrThrow({ where: { id: وارد.id } }); await زامن_آثار_الشيك(tx, c as any, "REGISTERED", {}, ahmed.id); });
  تحقق(await رطرف(عميل.id) === 7000, "تسجيل الوارد: دين العميل 10000 → 7000");
  تحقق(await رخزنة_شيكات() === خ0 + 3000, "تسجيل الوارد: خزنة الشيكات +3000");
  تحقق(await مسدَّد(صادر.id) === 0, "المسدَّد على الصادر = 0 بداية");

  // ═══ تسوية بشيك وارد (نحاكي سدّد_تسوية_بشيك: settlesChequeId) ═══
  await prisma.cheque.update({ where: { id: وارد.id }, data: { settlesChequeId: صادر.id } });
  تحقق(await مسدَّد(صادر.id) === 3000, "بعد استخدام الشيك: المسدَّد = 3000");
  تحقق(await رخزنة_شيكات() === خ0, "الشيك اتشال من خزنة الشيكات (رجعت لأصلها)");
  تحقق(await رطرف(مورد.id) === مستحق_قبل, "مستحق المورد ثابت (مايتغيرش) — الإصلاح المطلوب");
  تحقق(await رطرف(عميل.id) === 7000, "دين العميل ثابت (اتخصم وقت الاستلام)");
  const و1 = await prisma.cheque.findUniqueOrThrow({ where: { id: وارد.id } });
  تحقق(دخل_معاملة_مالية(و1) === true, "الشيك المستخدَم مقفول (لا يُعدَّل/يُحذف)");

  // إكمال الباقي 7000 من الخزنة → تمت التسوية
  await prisma.$transaction(async (tx) => {
    const h = await أضف_حركة_خزنة(tx, { التاريخ: new Date(), النوع: "EXPENSE", المبلغ: 7000, معرف_الحساب: cash.id, البيان: "تسوية نقدي", أنشأ: ahmed.id });
    await tx.treasuryTxn.update({ where: { id: h.id }, data: { chequeId: صادر.id } });
  });
  تحقق(await مسدَّد(صادر.id) === 10000, "المسدَّد = 10000 (3000 شيك + 7000 خزنة) = مكتمل");
  تحقق(await رطرف(مورد.id) === مستحق_قبل, "مستحق المورد لسه ثابت بعد التسوية الكاملة");

  // فلترة الإتاحة: شيك أكبر من المتبقّي لا يظهر
  const صادر2 = await prisma.cheque.create({ data: { drawerName: "x", amount: 2000, direction: "OUTGOING", dueDate: new Date("2026-09-01"), status: "PENDING", partyId: مورد.id, accountingVersion: 1, createdById: ahmed.id } });
  const وارد_كبير = await prisma.cheque.create({ data: { drawerName: "y", amount: 5000, direction: "INCOMING", dueDate: new Date("2026-09-05"), status: "REGISTERED", partyId: عميل.id, accountingVersion: 2, settlesChequeId: null, createdById: ahmed.id } });
  const متبقّي2 = 2000 - N(await مُسدَّد_تسوية(prisma, صادر2.id));
  const متاح = await prisma.cheque.findMany({ where: { direction: "INCOMING", status: { in: ["REGISTERED", "PENDING"] }, settlesChequeId: null, endorseLedgerEntryId: null, collectedTxnId: null, amount: { lte: متبقّي2 } }, select: { id: true } });
  تحقق(!متاح.some((m) => m.id === وارد_كبير.id), "شيك 5000 لا يظهر كمتاح لتسوية متبقّيها 2000 (أكبر → مستبعد)");

  // ═══ عكس: إزالة الشيك من التسوية ═══
  const خزنة_قبل_الإزالة = await رخزنة_شيكات();
  await prisma.cheque.update({ where: { id: وارد.id }, data: { settlesChequeId: null } });
  تحقق(await مسدَّد(صادر.id) === 7000, "بعد الإزالة: المسدَّد يرجع 7000 (خزنة فقط)");
  تحقق(await رخزنة_شيكات() === خزنة_قبل_الإزالة + 3000, "بعد الإزالة: الشيك (3000) يرجع لخزنة الشيكات");

  // تنظيف
  await prisma.treasuryTxn.deleteMany({ where: { chequeId: صادر.id } });
  for (const id of [وارد.id, وارد_كبير.id, صادر.id, صادر2.id]) { await prisma.treasuryTxn.deleteMany({ where: { chequeId: id } }); await prisma.cheque.update({ where: { id }, data: { settlesChequeId: null } }).catch(()=>{}); await prisma.cheque.delete({ where: { id } }); }
  for (const p of [مورد.id, عميل.id]) { await prisma.ledgerEntry.deleteMany({ where: { partyId: p } }); await prisma.treasuryTxn.deleteMany({ where: { partyId: p } }); await prisma.party.delete({ where: { id: p } }); }
  await prisma.$transaction(async (tx) => { const { أعد_حساب_حساب_الخزنة } = await import("../src/lib/treasury"); await أعد_حساب_حساب_الخزنة(tx, cash.id); });
  تحقق(Math.abs((await (async()=>N((await prisma.treasuryAccount.findUniqueOrThrow({where:{id:cash.id}})).balance))()) - c0) < 0.005, "النقدي رجع لأصله بعد التنظيف");
  console.log("✓ تم التنظيف");
}
main().then(() => { console.log("\n✅ نجح اختبار التسوية بشيك وارد"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
