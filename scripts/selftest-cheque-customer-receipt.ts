/**
 * اختبار معاملة الاستلام عند العميل (مرآة للمورد) — يحاكي أرجع_شيك_من_عميل + اربط_شيكات_بعميل:
 *  - إزالة شيك من حساب العميل: دينه يرجع يزيد، والشيك يبقى غير مرتبط بعميل (متاح)، ولا يُمسح.
 *  - إسناد شيك متاح لعميل آخر: دينه يقل (استلام منه).
 *  - معرّف معاملة الاستلام مستقل لكل شيك (لا يُدمج تلقائياً).
 */
import { PrismaClient } from "@prisma/client";
import { زامن_آثار_الشيك, رصيد_خزنة_الشيكات } from "../src/lib/cheques-accounting";
import { احذف_قيد_ناعم } from "../src/lib/ledger";
const prisma = new PrismaClient();
const N = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }
const رطرف = async (id: number) => N((await prisma.party.findUniqueOrThrow({ where: { id } })).balance);
const رخزنة = async () => N(await رصيد_خزنة_الشيكات(prisma));

// يحاكي أرجع_شيك_من_عميل
async function أزل_من_عميل(id: number, فاعل: number) {
  await prisma.$transaction(async (tx) => {
    const ش = await tx.cheque.findUniqueOrThrow({ where: { id } });
    if (ش.partyLedgerEntryId) await احذف_قيد_ناعم(tx, ش.partyLedgerEntryId);
    await tx.cheque.update({ where: { id }, data: { partyId: null, partyLedgerEntryId: null, receiptBatchId: null } });
  });
}
// يحاكي اربط_شيكات_بعميل (شيك واحد)
async function اربط_بعميل(id: number, معرف_العميل: number, فاعل: number) {
  await prisma.$transaction(async (tx) => {
    await tx.cheque.update({ where: { id }, data: { partyId: معرف_العميل, receiptBatchId: id } });
    const ش = await tx.cheque.findUniqueOrThrow({ where: { id } });
    await زامن_آثار_الشيك(tx, ش as any, "REGISTERED", {}, فاعل);
  });
}

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const عميلأ = await prisma.party.create({ data: { name: "عميل استلام أ", type: "CUSTOMER", openingBalance: 50000, balance: 50000, createdById: ahmed.id } });
  const عميلب = await prisma.party.create({ data: { name: "عميل استلام ب", type: "CUSTOMER", openingBalance: 30000, balance: 30000, createdById: ahmed.id } });
  const خ0 = await رخزنة();

  // استلام شيك 8000 من العميل أ → دينه 50000→42000، ومعرّف معاملة استلام = معرّف الشيك
  const ش = await prisma.cheque.create({ data: { drawerName: "ش", amount: 8000, direction: "INCOMING", accountingVersion: 2, dueDate: new Date("2026-09-01"), status: "REGISTERED", partyId: عميلأ.id, createdById: ahmed.id } });
  await prisma.$transaction(async (tx) => { const c = await tx.cheque.findUniqueOrThrow({ where: { id: ش.id } }); await زامن_آثار_الشيك(tx, c as any, "REGISTERED", {}, ahmed.id); });
  await prisma.cheque.update({ where: { id: ش.id }, data: { receiptBatchId: ش.id } });
  تحقق(await رطرف(عميلأ.id) === 42000, "استلام: دين العميل أ 50000→42000");
  تحقق(await رخزنة() === خ0 + 8000, "استلام: خزنة الشيكات +8000");
  تحقق((await prisma.cheque.findUniqueOrThrow({ where: { id: ش.id } })).receiptBatchId === ش.id, "معرّف معاملة استلام مستقل = معرّف الشيك");

  // إزالة من حساب العميل أ → دينه يرجع 50000، الشيك غير مرتبط بعميل، لا يُمسح
  await أزل_من_عميل(ش.id, ahmed.id);
  تحقق(await رطرف(عميلأ.id) === 50000, "إزالة: دين العميل أ رجع 50000");
  const ش1 = await prisma.cheque.findUniqueOrThrow({ where: { id: ش.id } });
  تحقق(ش1.partyId === null && ش1.partyLedgerEntryId === null, "إزالة: الشيك غير مرتبط بعميل (متاح)");
  تحقق(ش1.status === "REGISTERED", "إزالة: الشيك لا يُمسح ويبقى «مسجّل»");
  تحقق(await رخزنة() === خ0 + 8000, "إزالة: الشيك لسه في خزنة الشيكات (متاح)");

  // إسناد لعميل ب → دينه 30000→22000
  await اربط_بعميل(ش.id, عميلب.id, ahmed.id);
  تحقق(await رطرف(عميلب.id) === 22000, "إسناد: دين العميل ب 30000→22000");
  تحقق(await رطرف(عميلأ.id) === 50000, "إسناد: العميل أ لم يتأثر (50000)");
  const ش2 = await prisma.cheque.findUniqueOrThrow({ where: { id: ش.id } });
  تحقق(ش2.partyId === عميلب.id, "إسناد: الشيك بقى مربوطاً بالعميل ب");

  // تنظيف
  await prisma.cheque.delete({ where: { id: ش.id } });
  for (const p of [عميلأ.id, عميلب.id]) { await prisma.ledgerEntry.deleteMany({ where: { partyId: p } }); await prisma.party.delete({ where: { id: p } }); }
}
main().then(() => { console.log("\n✅ نجح اختبار معاملة الاستلام عند العميل (إزالة/إسناد)"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
