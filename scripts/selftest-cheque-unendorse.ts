/**
 * اختبار «إزالة شيك من المعاملة» (إرجاع شيك مُظهَّر لليد) — يحاكي أرجع_شيك_مظهّر:
 *  - مستحق المورد يرجع يزيد بقيمة الشيك (عكس التظهير).
 *  - دين العميل يبقى كما هو (لم يتغيّر).
 *  - الشيك يعود «مسجّل» + endorsedToId=null + يرجع لخزنة الشيكات ومتاح لإعادة الاستخدام.
 */
import { PrismaClient } from "@prisma/client";
import { زامن_آثار_الشيك, رصيد_خزنة_الشيكات } from "../src/lib/cheques-accounting";
const prisma = new PrismaClient();
const N = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }
const رطرف = async (id: number) => N((await prisma.party.findUniqueOrThrow({ where: { id } })).balance);
const رخزنة_شيكات = async () => N(await رصيد_خزنة_الشيكات(prisma));
async function حالة(id: number, هدف: any, خيارات: any, فاعل: number) {
  await prisma.$transaction(async (tx) => {
    const c = await tx.cheque.findUniqueOrThrow({ where: { id } });
    await زامن_آثار_الشيك(tx, c as any, هدف, خيارات ?? {}, فاعل);
  });
}
// يحاكي أرجع_شيك_مظهّر: زامن إلى «مسجّل» ثم تفريغ endorsedToId
async function أرجع_لليد(id: number, فاعل: number) {
  await prisma.$transaction(async (tx) => {
    const c = await tx.cheque.findUniqueOrThrow({ where: { id } });
    await زامن_آثار_الشيك(tx, c as any, "REGISTERED", {}, فاعل);
    await tx.cheque.update({ where: { id }, data: { endorsedToId: null } });
  });
}

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const عميل = await prisma.party.create({ data: { name: "عميل إرجاع", type: "CUSTOMER", openingBalance: 10000, balance: 10000, createdById: ahmed.id } });
  const موردأ = await prisma.party.create({ data: { name: "مورد إرجاع أ", type: "SUPPLIER", openingBalance: 9000, balance: 9000, createdById: ahmed.id } });
  const موردب = await prisma.party.create({ data: { name: "مورد إرجاع ب", type: "SUPPLIER", openingBalance: 4000, balance: 4000, createdById: ahmed.id } });
  const خ0 = await رخزنة_شيكات();

  const ش = await prisma.cheque.create({ data: { drawerName: "ش", amount: 3000, direction: "INCOMING", accountingVersion: 2, dueDate: new Date("2026-09-01"), status: "REGISTERED", partyId: عميل.id, createdById: ahmed.id } });
  await حالة(ش.id, "REGISTERED", {}, ahmed.id);
  تحقق(await رطرف(عميل.id) === 7000, "تسجيل: دين العميل 10000→7000");
  تحقق(await رخزنة_شيكات() === خ0 + 3000, "تسجيل: خزنة الشيكات +3000");

  // تظهير للمورد أ → مستحقه يقل 9000→6000
  await حالة(ش.id, "ENDORSED", { معرف_المورد_للتظهير: موردأ.id }, ahmed.id);
  تحقق(await رطرف(موردأ.id) === 6000, "تظهير: مستحق المورد أ 9000→6000");
  تحقق(await رطرف(عميل.id) === 7000, "تظهير: دين العميل ثابت 7000");
  تحقق(await رخزنة_شيكات() === خ0, "تظهير: خرج من خزنة الشيكات (لم يعد مسجّلاً)");

  // ═══ إزالة من المعاملة (إرجاع لليد) ═══
  await أرجع_لليد(ش.id, ahmed.id);
  تحقق(await رطرف(موردأ.id) === 9000, "إرجاع: مستحق المورد أ رجع 9000 (عكس التظهير)");
  تحقق(await رطرف(عميل.id) === 7000, "إرجاع: دين العميل ثابت 7000 (لم يتغيّر)");
  تحقق(await رخزنة_شيكات() === خ0 + 3000, "إرجاع: الشيك رجع لخزنة الشيكات (+3000)");
  const ش1 = await prisma.cheque.findUniqueOrThrow({ where: { id: ش.id } });
  تحقق(ش1.status === "REGISTERED" && ش1.endorsedToId === null && ش1.endorseLedgerEntryId === null, "إرجاع: «مسجّل» + بلا مورد + بلا قيد تظهير (متاح)");

  // ═══ إعادة الاستخدام مع مورد آخر ب ═══
  await حالة(ش.id, "ENDORSED", { معرف_المورد_للتظهير: موردب.id }, ahmed.id);
  تحقق(await رطرف(موردب.id) === 1000, "إعادة استخدام: مستحق المورد ب 4000→1000");
  تحقق(await رطرف(موردأ.id) === 9000, "إعادة استخدام: المورد أ لم يتأثر (لسه 9000)");
  تحقق(await رطرف(عميل.id) === 7000, "إعادة استخدام: دين العميل ثابت 7000");

  // تنظيف
  await prisma.cheque.delete({ where: { id: ش.id } });
  for (const p of [عميل.id, موردأ.id, موردب.id]) { await prisma.ledgerEntry.deleteMany({ where: { partyId: p } }); await prisma.party.delete({ where: { id: p } }); }
}
main().then(() => { console.log("\n✅ نجح اختبار إرجاع الشيك المُظهَّر لليد وإعادة استخدامه"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
