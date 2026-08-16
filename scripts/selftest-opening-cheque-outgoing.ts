/**
 * اختبار الشيك الصادر الافتتاحي (نموذج الدلتا الموحّد — مرآة الوارد):
 *  - الشيك الصادر العادي: سلوكه لم يتغيّر (تسليم/صرف/ارتداد/إلغاء) — اختبار انحدار للنموذج القديم.
 *  - الشيك الصادر الافتتاحي: لا حركة عند الإدخال، والانتقالات اللاحقة تُنشئ حركات حقيقية،
 *    والارتداد/الإلغاء يرجع مستحق المورد (+ يعكس حركة البنك لو كان مصروفاً وقت البداية).
 */
import { PrismaClient, ChequeStatus } from "@prisma/client";
import { زامن_آثار_الشيك } from "../src/lib/cheques-accounting";
const prisma = new PrismaClient();
const N = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }
const رطرف = async (id: number) => N((await prisma.party.findUniqueOrThrow({ where: { id } })).balance);
const رحساب = async (id: number) => N((await prisma.treasuryAccount.findUniqueOrThrow({ where: { id } })).balance);

async function زامن(id: number, هدف: ChequeStatus, خيارات: any, فاعل: number) {
  await prisma.$transaction(async (tx) => {
    const c = await tx.cheque.findUniqueOrThrow({ where: { id } });
    await زامن_آثار_الشيك(tx, c as any, هدف, خيارات ?? {}, فاعل);
  });
}

/** تنظيف: يحذف قيود/حركات الشيك ويعيد حساب سلسلة حساب الخزنة. */
async function نظّف(معرف_الشيك: number, أطراف: number[], حسابات: number[]) {
  for (const p of أطراف) await prisma.ledgerEntry.deleteMany({ where: { partyId: p } });
  await prisma.treasuryTxn.deleteMany({ where: { chequeId: معرف_الشيك } });
  await prisma.cheque.delete({ where: { id: معرف_الشيك } });
  for (const p of أطراف) await prisma.party.delete({ where: { id: p } });
  const { أعد_حساب_حساب_الخزنة } = await import("../src/lib/treasury");
  for (const ح of حسابات) await prisma.$transaction(async (tx) => { await أعد_حساب_حساب_الخزنة(tx, ح); });
}

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const bank = await prisma.treasuryAccount.findFirstOrThrow({ where: { type: "BANK" } });
  const cash = await prisma.treasuryAccount.findFirstOrThrow({ where: { type: "CASH" } });
  const أنشئ_شيك = (data: any) => prisma.cheque.create({ data: { direction: "OUTGOING", accountingVersion: 2, dueDate: new Date("2026-09-01"), createdById: ahmed.id, ...data } });
  const أنشئ_مورد = (اسم: string, رصيد: number) =>
    prisma.party.create({ data: { name: اسم, type: "SUPPLIER", openingBalance: رصيد, balance: رصيد, createdById: ahmed.id } });

  // ═══════════ (1) اختبار انحدار: شيك صادر عادي بلا تغيير في السلوك ═══════════
  {
    const مورد = await أنشئ_مورد("مورد صادر عادي", 20000);
    const بنك0 = await رحساب(bank.id);
    const ش = await أنشئ_شيك({ drawerName: "ش صادر عادي", amount: 6000, status: "PENDING", partyId: مورد.id });
    await زامن(ش.id, "PENDING", {}, ahmed.id);
    تحقق(await رطرف(مورد.id) === 14000, "صادر/عادي/تسليم: مستحق المورد 20000→14000 (مدين)");
    تحقق(await رحساب(bank.id) === بنك0, "صادر/عادي/تسليم: البنك ثابت (لسه ما اتصرفش)");
    await زامن(ش.id, "COLLECTED", { معرف_حساب_التحصيل: bank.id }, ahmed.id);
    تحقق(await رحساب(bank.id) === بنك0 - 6000, "صادر/عادي/صرف: البنك −6000 (مصروف)");
    تحقق(await رطرف(مورد.id) === 14000, "صادر/عادي/صرف: مستحق المورد ثابت 14000");
    await زامن(ش.id, "BOUNCED", {}, ahmed.id);
    تحقق(await رحساب(bank.id) === بنك0, "صادر/عادي/ارتداد: البنك رجع لأصله (+6000)");
    تحقق(await رطرف(مورد.id) === 20000, "صادر/عادي/ارتداد: مستحق المورد رجع 20000");
    await نظّف(ش.id, [مورد.id], [bank.id]);
  }

  // ═══════════ (2) صادر عادي: تسليم ثم إلغاء (يرجع المستحق بلا حركة خزنة) ═══════════
  {
    const مورد = await أنشئ_مورد("مورد صادر ملغي", 9000);
    const بنك0 = await رحساب(bank.id);
    const ش = await أنشئ_شيك({ drawerName: "ش صادر ملغي", amount: 3000, status: "PENDING", partyId: مورد.id });
    await زامن(ش.id, "PENDING", {}, ahmed.id);
    تحقق(await رطرف(مورد.id) === 6000, "صادر/إلغاء: بعد التسليم المستحق 6000");
    await زامن(ش.id, "CANCELLED", {}, ahmed.id);
    تحقق(await رطرف(مورد.id) === 9000, "صادر/إلغاء: المستحق رجع 9000");
    تحقق(await رحساب(bank.id) === بنك0, "صادر/إلغاء: البنك ثابت");
    await نظّف(ش.id, [مورد.id], [bank.id]);
  }

  // ═══════════ (3) صادر افتتاحي «مسلّم للمورد» (PENDING) ثم صرف ثم ارتداد ═══════════
  {
    const مورد = await أنشئ_مورد("مورد افت-مسلّم", 15000);
    const بنك0 = await رحساب(bank.id); const مستحق0 = await رطرف(مورد.id);
    const ش = await أنشئ_شيك({ drawerName: "افت صادر مسلّم", amount: 5000, status: "PENDING", partyId: مورد.id, isOpening: true, openingBaseline: "PENDING" });
    await زامن(ش.id, "PENDING", {}, ahmed.id);
    تحقق(await رطرف(مورد.id) === مستحق0, "صادر/افت/مسلّم/إدخال: مستحق المورد ثابت (لا حركة)");
    تحقق(await رحساب(bank.id) === بنك0, "صادر/افت/مسلّم/إدخال: البنك ثابت");
    تحقق((await prisma.ledgerEntry.count({ where: { partyId: مورد.id, deletedAt: null } })) === 0, "صادر/افت/مسلّم/إدخال: لا قيود على المورد");
    // صرف لاحق → حركة حقيقية على البنك فقط
    await زامن(ش.id, "COLLECTED", { معرف_حساب_التحصيل: bank.id }, ahmed.id);
    تحقق(await رحساب(bank.id) === بنك0 - 5000, "صادر/افت/مسلّم/صرف لاحق: البنك −5000 (حركة حقيقية)");
    تحقق(await رطرف(مورد.id) === مستحق0, "صادر/افت/مسلّم/صرف لاحق: مستحق المورد ثابت");
    // ارتداد → يرجع مستحق المورد + ترجع الفلوس للبنك
    await زامن(ش.id, "BOUNCED", {}, ahmed.id);
    تحقق(await رحساب(bank.id) === بنك0, "صادر/افت/مسلّم/ارتداد: البنك رجع (+5000)");
    تحقق(await رطرف(مورد.id) === مستحق0 + 5000, "صادر/افت/مسلّم/ارتداد: مستحق المورد +5000 (رجع)");
    await نظّف(ش.id, [مورد.id], [bank.id]);
  }

  // ═══════════ (4) صادر افتتاحي «مصروف من البنك» (COLLECTED) ثم ارتداد ═══════════
  {
    const مورد = await أنشئ_مورد("مورد افت-مصروف", 12000);
    const بنك0 = await رحساب(bank.id); const مستحق0 = await رطرف(مورد.id);
    const ش = await أنشئ_شيك({ drawerName: "افت صادر مصروف", amount: 4000, status: "COLLECTED", partyId: مورد.id, isOpening: true, openingBaseline: "COLLECTED", openingAccountId: bank.id });
    await زامن(ش.id, "COLLECTED", { معرف_حساب_التحصيل: bank.id }, ahmed.id);
    تحقق(await رحساب(bank.id) === بنك0, "صادر/افت/مصروف/إدخال: البنك ثابت (القيمة محتسَبة سلفاً)");
    تحقق(await رطرف(مورد.id) === مستحق0, "صادر/افت/مصروف/إدخال: مستحق المورد ثابت");
    // ارتداد → يرجع مستحق المورد + ترجع الفلوس للحساب الذي خرجت منه وقت البداية
    await زامن(ش.id, "BOUNCED", {}, ahmed.id);
    تحقق(await رحساب(bank.id) === بنك0 + 4000, "صادر/افت/مصروف/ارتداد: البنك +4000 (رجعت الآن فعلاً)");
    تحقق(await رطرف(مورد.id) === مستحق0 + 4000, "صادر/افت/مصروف/ارتداد: مستحق المورد +4000");
    await نظّف(ش.id, [مورد.id], [bank.id]);
  }

  // ═══════════ (5) صادر افتتاحي «مصروف نقدي» ثم إلغاء (عكس على نفس حساب البداية) ═══════════
  {
    const مورد = await أنشئ_مورد("مورد افت-نقدي", 7000);
    const نقد0 = await رحساب(cash.id); const مستحق0 = await رطرف(مورد.id);
    const ش = await أنشئ_شيك({ drawerName: "افت صادر نقدي", amount: 2500, status: "COLLECTED", partyId: مورد.id, isOpening: true, openingBaseline: "COLLECTED", openingAccountId: cash.id });
    await زامن(ش.id, "COLLECTED", { معرف_حساب_التحصيل: cash.id }, ahmed.id);
    تحقق(await رحساب(cash.id) === نقد0, "صادر/افت/نقدي/إدخال: النقدية ثابتة");
    await زامن(ش.id, "CANCELLED", {}, ahmed.id);
    تحقق(await رحساب(cash.id) === نقد0 + 2500, "صادر/افت/نقدي/إلغاء: النقدية +2500 (عكس على حساب البداية)");
    تحقق(await رطرف(مورد.id) === مستحق0 + 2500, "صادر/افت/نقدي/إلغاء: مستحق المورد +2500");
    await نظّف(ش.id, [مورد.id], [cash.id]);
  }

  // ═══════════ (6) تبديل النوع: افتتاحي → عادي (يُسجَّل بحساب المورد) ثم رجوع لافتتاحي ═══════════
  {
    const مورد = await أنشئ_مورد("مورد تبديل النوع", 10000);
    const مستحق0 = await رطرف(مورد.id);
    const ش = await أنشئ_شيك({ drawerName: "شيك تبديل", amount: 3500, status: "PENDING", partyId: مورد.id, isOpening: true, openingBaseline: "PENDING" });
    await زامن(ش.id, "PENDING", {}, ahmed.id);
    تحقق(await رطرف(مورد.id) === مستحق0, "تبديل/افتتاحي: المستحق ثابت قبل التحويل");
    // تحويل لعادي: خط الأساس يصبح أصفاراً ⇒ يُنشأ قيد المدين فعلاً
    await prisma.cheque.update({ where: { id: ش.id }, data: { isOpening: false, openingBaseline: null, openingAccountId: null } });
    await زامن(ش.id, "PENDING", {}, ahmed.id);
    تحقق(await رطرف(مورد.id) === مستحق0 - 3500, "تبديل/لعادي: المستحق −3500 (اتسجّل بحساب المورد)");
    // إرجاع لافتتاحي: عكس الأثر
    const ش2 = await prisma.cheque.findUniqueOrThrow({ where: { id: ش.id } });
    await prisma.$transaction(async (tx) => {
      const { احذف_قيد_ناعم } = await import("../src/lib/ledger");
      if (ش2.partyLedgerEntryId) await احذف_قيد_ناعم(tx, ش2.partyLedgerEntryId);
      await tx.cheque.update({ where: { id: ش.id }, data: { isOpening: true, openingBaseline: ش2.status, partyLedgerEntryId: null } });
    });
    تحقق(await رطرف(مورد.id) === مستحق0, "تبديل/لافتتاحي: المستحق رجع (أُزيل الأثر)");
    await نظّف(ش.id, [مورد.id], []);
  }
}
main().then(() => { console.log("\n✅ نجح اختبار الشيك الصادر الافتتاحي (عادي بلا تغيير + كل حالات الافتتاحي)"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
