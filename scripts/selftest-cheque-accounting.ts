/** اختبار الأثر المحاسبي للشيك (المرحلة 2): استلام/تحصيل/ارتداد/إلغاء لكلا الاتجاهين. */
import { PrismaClient } from "@prisma/client";
import { زامن_آثار_الشيك } from "../src/lib/cheques-accounting";
const prisma = new PrismaClient();
const N = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }
const رصيد_طرف = async (id: number) => N((await prisma.party.findUniqueOrThrow({ where: { id } })).balance);
const رصيد_بنك = async (id: number) => N((await prisma.treasuryAccount.findUniqueOrThrow({ where: { id } })).balance);

async function حالة(id: number, s: any, sub: number | null = null, actor: number) {
  await prisma.$transaction(async (tx) => {
    const c = await tx.cheque.findUniqueOrThrow({ where: { id } });
    // خيارات المزامنة كائن دائماً (كما في الإنتاج تغيير_حالة_شيك) — sub اختياري كحساب تحصيل
    await زامن_آثار_الشيك(tx, c as any, s, sub == null ? {} : { معرف_حساب_التحصيل: sub }, actor);
  });
}

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const bank = await prisma.treasuryAccount.findUniqueOrThrow({ where: { type: "BANK" } });
  const b0 = await رصيد_بنك(bank.id);

  // ═══ شيك وارد من عميل ═══
  const عميل = await prisma.party.create({ data: { name: "عميل شيك محاسبة", type: "CUSTOMER", createdById: ahmed.id } });
  // مديونية ابتدائية 10000 (فاتورة وهمية عبر رصيد ابتدائي)
  await prisma.party.update({ where: { id: عميل.id }, data: { openingBalance: 10000, balance: 10000 } });
  const شو = await prisma.cheque.create({ data: { drawerName: "عميل", amount: 4000, direction: "INCOMING", dueDate: new Date("2026-08-01"), status: "REGISTERED", partyId: عميل.id, accountingVersion: 1, createdById: ahmed.id } });

  // استلام (تحت التحصيل) → دين العميل يقل 4000، البنك ثابت
  await حالة(شو.id, "PENDING", null, ahmed.id);
  تحقق(await رصيد_طرف(عميل.id) === 6000, "وارد/استلام: دين العميل 10000 → 6000 (دائن 4000)");
  تحقق(await رصيد_بنك(bank.id) === b0, "وارد/استلام: البنك ثابت (لا خزنة)");

  // تحصيل فعلي → البنك +4000، دين العميل ثابت (6000)
  await حالة(شو.id, "COLLECTED", null, ahmed.id);
  تحقق(await رصيد_بنك(bank.id) === b0 + 4000, "وارد/تحصيل: البنك +4000");
  تحقق(await رصيد_طرف(عميل.id) === 6000, "وارد/تحصيل: دين العميل ثابت (اتخصم عند الاستلام)");

  // ارتداد → يعكس الاتنين: البنك يرجع، دين العميل يرجع 10000
  await حالة(شو.id, "BOUNCED", null, ahmed.id);
  تحقق(await رصيد_بنك(bank.id) === b0, "وارد/ارتداد: البنك يرجع لأصله");
  تحقق(await رصيد_طرف(عميل.id) === 10000, "وارد/ارتداد: دين العميل يرجع 10000");

  // ═══ شيك صادر لمورد ═══
  const مورد = await prisma.party.create({ data: { name: "مورد شيك محاسبة", type: "SUPPLIER", createdById: ahmed.id } });
  await prisma.party.update({ where: { id: مورد.id }, data: { openingBalance: 8000, balance: 8000 } }); // مستحق له 8000
  const شص = await prisma.cheque.create({ data: { drawerName: "لأمر المورد", amount: 3000, direction: "OUTGOING", dueDate: new Date("2026-08-01"), status: "REGISTERED", partyId: مورد.id, createdById: ahmed.id } });

  // تسليم → المستحق للمورد يقل 3000 (مدين)، البنك ثابت
  await حالة(شص.id, "PENDING", null, ahmed.id);
  تحقق(await رصيد_طرف(مورد.id) === 5000, "صادر/تسليم: مستحق المورد 8000 → 5000 (مدين 3000)");
  تحقق(await رصيد_بنك(bank.id) === b0, "صادر/تسليم: البنك ثابت");

  // صرف فعلي → البنك -3000
  await حالة(شص.id, "COLLECTED", null, ahmed.id);
  تحقق(await رصيد_بنك(bank.id) === b0 - 3000, "صادر/صرف: البنك -3000");

  // إلغاء → يعكس الاتنين
  await حالة(شص.id, "CANCELLED", null, ahmed.id);
  تحقق(await رصيد_بنك(bank.id) === b0, "صادر/إلغاء: البنك يرجع");
  تحقق(await رصيد_طرف(مورد.id) === 8000, "صادر/إلغاء: مستحق المورد يرجع 8000");

  // تنظيف
  for (const id of [شو.id, شص.id]) await prisma.cheque.delete({ where: { id } });
  for (const p of [عميل.id, مورد.id]) {
    await prisma.ledgerEntry.deleteMany({ where: { partyId: p } });
    await prisma.treasuryTxn.deleteMany({ where: { partyId: p } });
    await prisma.party.delete({ where: { id: p } });
  }
  await prisma.treasuryTxn.deleteMany({ where: { description: { contains: "شيك" } } });
  console.log("✓ تم التنظيف");
}
main().then(() => { console.log("\n✅ نجح اختبار محاسبة الشيكات (مرحلة 2)"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
