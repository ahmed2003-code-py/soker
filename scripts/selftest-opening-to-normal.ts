/**
 * اختبار تحويل شيك افتتاحي إلى عادي — يحاكي حوّل_شيك_لعادي:
 *  الشيك الافتتاحي لا أثر له عند الإدخال؛ بعد التحويل تُطبَّق آثار حالته الحالية فعلياً.
 *  - افتتاحي «معي» → تحويل → دين العميل يقل (استلام).
 *  - افتتاحي «مودع» → تحويل → دين العميل يقل + البنك يزيد.
 */
import { PrismaClient, ChequeStatus } from "@prisma/client";
import { زامن_آثار_الشيك } from "../src/lib/cheques-accounting";
const prisma = new PrismaClient();
const N = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }
const رطرف = async (id: number) => N((await prisma.party.findUniqueOrThrow({ where: { id } })).balance);
const رحساب = async (id: number) => N((await prisma.treasuryAccount.findUniqueOrThrow({ where: { id } })).balance);

async function أدخل_افتتاحي(data: any, ahmed: number) {
  const ش = await prisma.cheque.create({ data: { direction: "INCOMING", accountingVersion: 2, dueDate: new Date("2026-09-01"), isOpening: true, createdById: ahmed, ...data } });
  await prisma.$transaction(async (tx) => {
    const c = await tx.cheque.findUniqueOrThrow({ where: { id: ش.id } });
    const خيارات = data.status === "ENDORSED" ? { معرف_المورد_للتظهير: c.endorsedToId } : data.status === "DEPOSITED" ? { معرف_حساب_التحصيل: c.openingAccountId } : {};
    await زامن_آثار_الشيك(tx, c as any, c.status, خيارات as any, ahmed);
  });
  return ش.id;
}
// يحاكي حوّل_شيك_لافتتاحي (العكس): يعكس الآثار ويجعله افتتاحياً بخط أساس = حالته
async function أرجع_افتتاحي(id: number, ahmed: number) {
  await prisma.$transaction(async (tx) => {
    const شيك = await tx.cheque.findUniqueOrThrow({ where: { id } });
    let acc: number | null = null, sub: number | null = null;
    if (شيك.collectedTxnId) { const h = await tx.treasuryTxn.findUnique({ where: { id: شيك.collectedTxnId }, select: { accountId: true, subAccountId: true } }); acc = h?.accountId ?? null; sub = h?.subAccountId ?? null; }
    const { احذف_قيد_ناعم } = await import("../src/lib/ledger");
    const { احذف_حركة_خزنة_ناعم } = await import("../src/lib/treasury");
    if (شيك.partyLedgerEntryId) await احذف_قيد_ناعم(tx, شيك.partyLedgerEntryId);
    if (شيك.endorseLedgerEntryId) await احذف_قيد_ناعم(tx, شيك.endorseLedgerEntryId);
    if (شيك.collectedTxnId) await احذف_حركة_خزنة_ناعم(tx, شيك.collectedTxnId);
    const بحساب = شيك.status === "DEPOSITED" || شيك.status === "COLLECTED";
    await tx.cheque.update({ where: { id }, data: { isOpening: true, openingBaseline: شيك.status, openingAccountId: بحساب ? acc : null, openingSubAccountId: بحساب ? sub : null, partyLedgerEntryId: null, endorseLedgerEntryId: null, collectedTxnId: null, receiptBatchId: null } });
  });
}
// يحاكي حوّل_شيك_لعادي
async function حوّل(id: number, ahmed: number) {
  await prisma.$transaction(async (tx) => {
    const شيك = await tx.cheque.findUniqueOrThrow({ where: { id } });
    const خيارات: any = {};
    if (شيك.status === "ENDORSED") خيارات.معرف_المورد_للتظهير = شيك.endorsedToId;
    if (شيك.status === "DEPOSITED" || شيك.status === "COLLECTED") { خيارات.معرف_حساب_التحصيل = شيك.openingAccountId; خيارات.معرف_حساب_فرعي = شيك.openingSubAccountId; }
    await tx.cheque.update({ where: { id }, data: { isOpening: false, openingBaseline: null, openingAccountId: null, openingSubAccountId: null, receiptBatchId: id } });
    const c = await tx.cheque.findUniqueOrThrow({ where: { id } });
    await زامن_آثار_الشيك(tx, c as any, c.status, خيارات, ahmed);
  });
}

async function main() {
  const ahmed = (await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } })).id;
  const bank = await prisma.treasuryAccount.findFirstOrThrow({ where: { type: "BANK" } });

  // (1) افتتاحي «معي» → تحويل
  {
    const عميل = await prisma.party.create({ data: { name: "عميل تحويل-معي", type: "CUSTOMER", openingBalance: 20000, balance: 20000, createdById: ahmed } });
    const ش = await أدخل_افتتاحي({ drawerName: "ش", amount: 5000, status: "REGISTERED", openingBaseline: "REGISTERED", partyId: عميل.id }, ahmed);
    تحقق(await رطرف(عميل.id) === 20000, "افتتاحي/معي: لا أثر عند الإدخال (دين 20000)");
    await حوّل(ش, ahmed);
    تحقق(await رطرف(عميل.id) === 15000, "تحويل: دين العميل 20000→15000 (اتسجّل الاستلام)");
    تحقق(!(await prisma.cheque.findUniqueOrThrow({ where: { id: ش } })).isOpening, "بقى عادياً (isOpening=false)");
    // العكس: إرجاع لافتتاحي → يُزال الأثر
    await أرجع_افتتاحي(ش, ahmed);
    تحقق(await رطرف(عميل.id) === 20000, "إرجاع لافتتاحي: دين العميل رجع 20000 (اتشال الأثر)");
    const بعد = await prisma.cheque.findUniqueOrThrow({ where: { id: ش } });
    تحقق(بعد.isOpening && بعد.openingBaseline === "REGISTERED", "إرجاع لافتتاحي: بقى افتتاحياً بخط أساس = حالته");
    await prisma.ledgerEntry.deleteMany({ where: { partyId: عميل.id } });
    await prisma.cheque.delete({ where: { id: ش } });
    await prisma.party.delete({ where: { id: عميل.id } });
  }

  // (2) افتتاحي «مودع» → تحويل (بنك يزيد + دين يقل)
  {
    const عميل = await prisma.party.create({ data: { name: "عميل تحويل-مودع", type: "CUSTOMER", openingBalance: 20000, balance: 20000, createdById: ahmed } });
    const بنك0 = await رحساب(bank.id);
    const ش = await أدخل_افتتاحي({ drawerName: "ش", amount: 7000, status: "DEPOSITED", openingBaseline: "DEPOSITED", openingAccountId: bank.id, partyId: عميل.id }, ahmed);
    تحقق(await رطرف(عميل.id) === 20000 && await رحساب(bank.id) === بنك0, "افتتاحي/مودع: لا أثر عند الإدخال");
    await حوّل(ش, ahmed);
    تحقق(await رطرف(عميل.id) === 13000, "تحويل: دين العميل 20000→13000");
    تحقق(await رحساب(bank.id) === بنك0 + 7000, "تحويل: البنك +7000 (اتسجّل الإيداع)");
    await prisma.ledgerEntry.deleteMany({ where: { partyId: عميل.id } });
    await prisma.treasuryTxn.deleteMany({ where: { chequeId: ش } });
    await prisma.cheque.delete({ where: { id: ش } });
    await prisma.party.delete({ where: { id: عميل.id } });
    await prisma.$transaction(async (tx) => { const { أعد_حساب_حساب_الخزنة } = await import("../src/lib/treasury"); await أعد_حساب_حساب_الخزنة(tx, bank.id); });
  }
}
main().then(() => { console.log("\n✅ نجح اختبار تحويل الشيك الافتتاحي إلى عادي"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
