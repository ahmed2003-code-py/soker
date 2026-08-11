/**
 * اختبار الشيك الافتتاحي (نموذج الدلتا الموحّد):
 *  - الشيك العادي: سلوكه لم يتغيّر (تسجيل/إيداع/ارتداد) — اختبار انحدار.
 *  - الشيك الافتتاحي: لا حركة عند الإدخال في كل الحالات، والانتقالات اللاحقة تُنشئ حركات حقيقية،
 *    والارتداد يرجع دين العميل (+ يعكس البنك/النقدية أو يرجع مستحق المورد حسب حالة البداية).
 */
import { PrismaClient, ChequeStatus } from "@prisma/client";
import { زامن_آثار_الشيك, رصيد_خزنة_الشيكات } from "../src/lib/cheques-accounting";
const prisma = new PrismaClient();
const N = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }
const رطرف = async (id: number) => N((await prisma.party.findUniqueOrThrow({ where: { id } })).balance);
const رحساب = async (id: number) => N((await prisma.treasuryAccount.findUniqueOrThrow({ where: { id } })).balance);
const رخزنة_شيكات = async () => N(await رصيد_خزنة_الشيكات(prisma));

async function زامن(id: number, هدف: ChequeStatus, خيارات: any, فاعل: number) {
  await prisma.$transaction(async (tx) => {
    const c = await tx.cheque.findUniqueOrThrow({ where: { id } });
    await زامن_آثار_الشيك(tx, c as any, هدف, خيارات ?? {}, فاعل);
  });
}

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const bank = await prisma.treasuryAccount.findFirstOrThrow({ where: { type: "BANK" } });
  const cash = await prisma.treasuryAccount.findFirstOrThrow({ where: { type: "CASH" } });
  const أنشئ_شيك = (data: any) => prisma.cheque.create({ data: { direction: "INCOMING", accountingVersion: 2, dueDate: new Date("2026-09-01"), createdById: ahmed.id, ...data } });

  // ═══════════ (1) اختبار انحدار: شيك عادي بلا تغيير في السلوك ═══════════
  {
    const عميل = await prisma.party.create({ data: { name: "عميل عادي", type: "CUSTOMER", openingBalance: 10000, balance: 10000, createdById: ahmed.id } });
    const بنك0 = await رحساب(bank.id); const خ0 = await رخزنة_شيكات();
    const ش = await أنشئ_شيك({ drawerName: "ش عادي", amount: 3000, status: "REGISTERED", partyId: عميل.id });
    await زامن(ش.id, "REGISTERED", {}, ahmed.id);
    تحقق(await رطرف(عميل.id) === 7000, "عادي/تسجيل: دين العميل 10000→7000 (دائن)");
    تحقق(await رخزنة_شيكات() === خ0 + 3000, "عادي/تسجيل: خزنة الشيكات +3000");
    await زامن(ش.id, "DEPOSITED", { معرف_حساب_التحصيل: bank.id }, ahmed.id);
    تحقق(await رحساب(bank.id) === بنك0 + 3000, "عادي/إيداع: البنك +3000");
    تحقق(await رطرف(عميل.id) === 7000, "عادي/إيداع: دين العميل ثابت 7000");
    await زامن(ش.id, "BOUNCED", {}, ahmed.id);
    تحقق(await رحساب(bank.id) === بنك0, "عادي/ارتداد: البنك رجع لأصله (−3000)");
    تحقق(await رطرف(عميل.id) === 10000, "عادي/ارتداد: دين العميل رجع 10000");
    await prisma.ledgerEntry.deleteMany({ where: { partyId: عميل.id } });
    await prisma.treasuryTxn.deleteMany({ where: { chequeId: ش.id } });
    await prisma.cheque.delete({ where: { id: ش.id } });
    await prisma.party.delete({ where: { id: عميل.id } });
    await prisma.$transaction(async (tx) => { const { أعد_حساب_حساب_الخزنة } = await import("../src/lib/treasury"); await أعد_حساب_حساب_الخزنة(tx, bank.id); });
  }

  // ═══════════ (2) افتتاحي «معي» (REGISTERED) ثم إيداع ثم ارتداد ═══════════
  {
    const عميل = await prisma.party.create({ data: { name: "عميل افت-معي", type: "CUSTOMER", openingBalance: 5000, balance: 5000, createdById: ahmed.id } });
    const بنك0 = await رحساب(bank.id); const خ0 = await رخزنة_شيكات(); const دين0 = await رطرف(عميل.id);
    const ش = await أنشئ_شيك({ drawerName: "افت معي", amount: 2000, status: "REGISTERED", partyId: عميل.id, isOpening: true, openingBaseline: "REGISTERED" });
    await زامن(ش.id, "REGISTERED", {}, ahmed.id);
    تحقق(await رطرف(عميل.id) === دين0, "افت/معي/إدخال: دين العميل ثابت (لا حركة)");
    تحقق(await رخزنة_شيكات() === خ0 + 2000, "افت/معي/إدخال: يظهر في خزنة الشيكات (+2000)");
    تحقق((await prisma.ledgerEntry.count({ where: { partyId: عميل.id, deletedAt: null } })) === 0, "افت/معي/إدخال: لا قيود على العميل");
    // إيداع لاحق → حركة حقيقية
    await زامن(ش.id, "DEPOSITED", { معرف_حساب_التحصيل: bank.id }, ahmed.id);
    تحقق(await رحساب(bank.id) === بنك0 + 2000, "افت/معي/إيداع لاحق: البنك +2000 (حركة حقيقية)");
    تحقق(await رطرف(عميل.id) === دين0, "افت/معي/إيداع لاحق: دين العميل ثابت");
    // ارتداد → يرجع دين العميل + يخرج من البنك
    await زامن(ش.id, "BOUNCED", {}, ahmed.id);
    تحقق(await رحساب(bank.id) === بنك0, "افت/معي/ارتداد: البنك رجع (−2000)");
    تحقق(await رطرف(عميل.id) === دين0 + 2000, "افت/معي/ارتداد: دين العميل +2000 (رجع الدين)");
    await prisma.ledgerEntry.deleteMany({ where: { partyId: عميل.id } });
    await prisma.treasuryTxn.deleteMany({ where: { chequeId: ش.id } });
    await prisma.cheque.delete({ where: { id: ش.id } });
    await prisma.party.delete({ where: { id: عميل.id } });
    await prisma.$transaction(async (tx) => { const { أعد_حساب_حساب_الخزنة } = await import("../src/lib/treasury"); await أعد_حساب_حساب_الخزنة(tx, bank.id); });
  }

  // ═══════════ (3) افتتاحي «مودع بالبنك» (DEPOSITED) ثم ارتداد ═══════════
  {
    const عميل = await prisma.party.create({ data: { name: "عميل افت-مودع", type: "CUSTOMER", openingBalance: 5000, balance: 5000, createdById: ahmed.id } });
    const بنك0 = await رحساب(bank.id); const خ0 = await رخزنة_شيكات(); const دين0 = await رطرف(عميل.id);
    const ش = await أنشئ_شيك({ drawerName: "افت مودع", amount: 4000, status: "DEPOSITED", partyId: عميل.id, isOpening: true, openingBaseline: "DEPOSITED", openingAccountId: bank.id });
    await زامن(ش.id, "DEPOSITED", { معرف_حساب_التحصيل: bank.id }, ahmed.id);
    تحقق(await رحساب(bank.id) === بنك0, "افت/مودع/إدخال: البنك ثابت (القيمة محتسَبة سلفاً)");
    تحقق(await رطرف(عميل.id) === دين0, "افت/مودع/إدخال: دين العميل ثابت");
    تحقق(await رخزنة_شيكات() === خ0, "افت/مودع/إدخال: لا يظهر في خزنة الشيكات (ليس مسجّلاً)");
    // ارتداد → يرجع دين العميل + يخرج من البنك (من openingAccountId)
    await زامن(ش.id, "BOUNCED", {}, ahmed.id);
    تحقق(await رحساب(bank.id) === بنك0 - 4000, "افت/مودع/ارتداد: البنك −4000 (خرجت الآن فعلاً)");
    تحقق(await رطرف(عميل.id) === دين0 + 4000, "افت/مودع/ارتداد: دين العميل +4000");
    await prisma.ledgerEntry.deleteMany({ where: { partyId: عميل.id } });
    await prisma.treasuryTxn.deleteMany({ where: { chequeId: ش.id } });
    await prisma.cheque.delete({ where: { id: ش.id } });
    await prisma.party.delete({ where: { id: عميل.id } });
    await prisma.$transaction(async (tx) => { const { أعد_حساب_حساب_الخزنة } = await import("../src/lib/treasury"); await أعد_حساب_حساب_الخزنة(tx, bank.id); });
  }

  // ═══════════ (4) افتتاحي «مظهّر لمورد» (ENDORSED) ثم ارتداد ═══════════
  {
    const عميل = await prisma.party.create({ data: { name: "عميل افت-مظهّر", type: "CUSTOMER", openingBalance: 5000, balance: 5000, createdById: ahmed.id } });
    const مورد = await prisma.party.create({ data: { name: "مورد افت-مظهّر", type: "SUPPLIER", openingBalance: 8000, balance: 8000, createdById: ahmed.id } });
    const دينع0 = await رطرف(عميل.id); const مستحق0 = await رطرف(مورد.id);
    const ش = await أنشئ_شيك({ drawerName: "افت مظهّر", amount: 3000, status: "ENDORSED", partyId: عميل.id, endorsedToId: مورد.id, isOpening: true, openingBaseline: "ENDORSED" });
    await زامن(ش.id, "ENDORSED", { معرف_المورد_للتظهير: مورد.id }, ahmed.id);
    تحقق(await رطرف(عميل.id) === دينع0, "افت/مظهّر/إدخال: دين العميل ثابت");
    تحقق(await رطرف(مورد.id) === مستحق0, "افت/مظهّر/إدخال: مستحق المورد ثابت (لا حركة)");
    const ش0 = await prisma.cheque.findUniqueOrThrow({ where: { id: ش.id } });
    تحقق(ش0.endorsedToId === مورد.id, "افت/مظهّر/إدخال: اسم المورد محفوظ للعرض");
    // ارتداد → يرجع دين العميل + يرجع مستحق المورد
    await زامن(ش.id, "BOUNCED", {}, ahmed.id);
    تحقق(await رطرف(عميل.id) === دينع0 + 3000, "افت/مظهّر/ارتداد: دين العميل +3000");
    تحقق(await رطرف(مورد.id) === مستحق0 + 3000, "افت/مظهّر/ارتداد: مستحق المورد +3000 (رجع)");
    for (const p of [عميل.id, مورد.id]) { await prisma.ledgerEntry.deleteMany({ where: { partyId: p } }); }
    await prisma.cheque.delete({ where: { id: ش.id } });
    for (const p of [عميل.id, مورد.id]) await prisma.party.delete({ where: { id: p } });
  }

  // ═══════════ (5) افتتاحي «محصّل» (COLLECTED) ثم ارتداد على النقدية ═══════════
  {
    const عميل = await prisma.party.create({ data: { name: "عميل افت-محصّل", type: "CUSTOMER", openingBalance: 5000, balance: 5000, createdById: ahmed.id } });
    const نقد0 = await رحساب(cash.id); const دين0 = await رطرف(عميل.id);
    const ش = await أنشئ_شيك({ drawerName: "افت محصّل", amount: 1500, status: "COLLECTED", partyId: عميل.id, isOpening: true, openingBaseline: "COLLECTED", openingAccountId: cash.id });
    await زامن(ش.id, "COLLECTED", { معرف_حساب_التحصيل: cash.id }, ahmed.id);
    تحقق(await رحساب(cash.id) === نقد0, "افت/محصّل/إدخال: النقدية ثابتة");
    تحقق(await رطرف(عميل.id) === دين0, "افت/محصّل/إدخال: دين العميل ثابت");
    await زامن(ش.id, "BOUNCED", {}, ahmed.id);
    تحقق(await رحساب(cash.id) === نقد0 - 1500, "افت/محصّل/ارتداد: النقدية −1500");
    تحقق(await رطرف(عميل.id) === دين0 + 1500, "افت/محصّل/ارتداد: دين العميل +1500");
    await prisma.ledgerEntry.deleteMany({ where: { partyId: عميل.id } });
    await prisma.treasuryTxn.deleteMany({ where: { chequeId: ش.id } });
    await prisma.cheque.delete({ where: { id: ش.id } });
    await prisma.party.delete({ where: { id: عميل.id } });
    await prisma.$transaction(async (tx) => { const { أعد_حساب_حساب_الخزنة } = await import("../src/lib/treasury"); await أعد_حساب_حساب_الخزنة(tx, cash.id); });
  }
}
main().then(() => { console.log("\n✅ نجح اختبار الشيك الافتتاحي (عادي بلا تغيير + كل حالات الافتتاحي)"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
