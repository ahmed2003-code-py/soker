/**
 * اختبار شامل لسلامة أرصدة الخزنة + الحسابات الفرعية (المحافظ) عبر دورة الشيك.
 * يثبت: الفلوس اللي تدخل حساب فرعي تظهر في (الرئيسي + الفرعي + الإجمالي) معاً،
 * والعكس (إلغاء الشيك) يشيلها من كل الأماكن، والحركة تُحذف حذفاً ناعماً،
 * والرصيد التزايدي = إعادة الحساب الكاملة تماماً.
 */
import { PrismaClient } from "@prisma/client";
import { أضف_حركة_خزنة, احذف_حركة_خزنة_ناعم, أعد_حساب_حساب_الخزنة } from "../src/lib/treasury";
import { زامن_آثار_الشيك, رصيد_خزنة_الشيكات } from "../src/lib/cheques-accounting";
const prisma = new PrismaClient();
const N = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }
const رحساب = async (id: number) => N((await prisma.treasuryAccount.findUniqueOrThrow({ where: { id } })).balance);
const رفرعي = async (id: number) => N((await prisma.subAccount.findUniqueOrThrow({ where: { id } })).balance);
const رطرف = async (id: number) => N((await prisma.party.findUniqueOrThrow({ where: { id } })).balance);
const إجمالي = async () => (await prisma.treasuryAccount.findMany()).reduce((س, h) => س + N(h.balance), 0);
const رخزنة_شيكات = async () => N(await رصيد_خزنة_الشيكات(prisma));

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const إنستا = await prisma.treasuryAccount.findUniqueOrThrow({ where: { type: "INSTAPAY" } });
  // محفظة اختبار
  const محفظة = await prisma.subAccount.create({ data: { type: "INSTAPAY", name: "محفظة اختبار السلامة" } });

  const i0 = await رحساب(إنستا.id), t0 = await إجمالي(), خ0 = await رخزنة_شيكات();
  تحقق(await رفرعي(محفظة.id) === 0, "المحفظة تبدأ من صفر");

  // ═══ (أ) اختبار المحرك مباشرة: إيراد على الحساب الفرعي ═══
  let حركة1_id = 0;
  await prisma.$transaction(async (tx) => {
    const h = await أضف_حركة_خزنة(tx, { التاريخ: new Date(), النوع: "INCOME", المبلغ: 5000, معرف_الحساب: إنستا.id, معرف_حساب_فرعي: محفظة.id, البيان: "اختبار إيداع", أنشأ: ahmed.id });
    حركة1_id = h.id;
  });
  تحقق(await رحساب(إنستا.id) === i0 + 5000, "الإيراد: إنستا الرئيسي +5000");
  تحقق(await رفرعي(محفظة.id) === 5000, "الإيراد: المحفظة +5000");
  تحقق(await إجمالي() === t0 + 5000, "الإيراد: الإجمالي +5000");

  // عكس الحركة → لازم ترجع من الرئيسي والفرعي والإجمالي معاً
  await prisma.$transaction(async (tx) => { await احذف_حركة_خزنة_ناعم(tx, حركة1_id); });
  تحقق(await رحساب(إنستا.id) === i0, "العكس: إنستا الرئيسي رجع");
  تحقق(await رفرعي(محفظة.id) === 0, "العكس: المحفظة رجعت لصفر (مش فاضلة فلوس!)");
  تحقق(await إجمالي() === t0, "العكس: الإجمالي رجع");
  const ح1 = await prisma.treasuryTxn.findUniqueOrThrow({ where: { id: حركة1_id } });
  تحقق(ح1.deletedAt != null, "العكس: الحركة اتحذفت حذفاً ناعماً (السجل باقٍ)");

  // ═══ (ب) اتساق التزايدي مع إعادة الحساب الكاملة ═══
  await prisma.$transaction(async (tx) => {
    await أضف_حركة_خزنة(tx, { التاريخ: new Date("2026-01-01"), النوع: "INCOME", المبلغ: 3000, معرف_الحساب: إنستا.id, معرف_حساب_فرعي: محفظة.id, البيان: "قديمة", أنشأ: ahmed.id });
    await أضف_حركة_خزنة(tx, { التاريخ: new Date("2026-02-01"), النوع: "EXPENSE", المبلغ: 1000, معرف_الحساب: إنستا.id, معرف_حساب_فرعي: محفظة.id, البيان: "مصروف", أنشأ: ahmed.id });
  });
  const فرعي_تزايدي = await رفرعي(محفظة.id), رئيسي_تزايدي = await رحساب(إنستا.id);
  await prisma.$transaction(async (tx) => { await أعد_حساب_حساب_الخزنة(tx, إنستا.id); });
  تحقق(await رفرعي(محفظة.id) === فرعي_تزايدي, `اتساق المحفظة: تزايدي=${فرعي_تزايدي} = إعادة حساب`);
  تحقق(await رحساب(إنستا.id) === رئيسي_تزايدي, "اتساق الرئيسي: تزايدي = إعادة حساب");
  تحقق(await رفرعي(محفظة.id) === 2000, "المحفظة = 3000-1000 = 2000");

  // نظّف حركات (ب)
  const حركات_ب = await prisma.treasuryTxn.findMany({ where: { subAccountId: محفظة.id, deletedAt: null }, select: { id: true } });
  await prisma.$transaction(async (tx) => { for (const h of حركات_ب) await احذف_حركة_خزنة_ناعم(tx, h.id); });
  تحقق(await رفرعي(محفظة.id) === 0 && await رحساب(إنستا.id) === i0, "بعد التنظيف: المحفظة والرئيسي صفر/أصل");

  // ═══ (ج) السيناريو الحقيقي: شيك وارد → إيداع في محفظة إنستا → إلغاء ═══
  const عميل = await prisma.party.create({ data: { name: "عميل سلامة الخزنة", type: "CUSTOMER", openingBalance: 10000, balance: 10000, createdById: ahmed.id } });
  const ش = await prisma.cheque.create({ data: { drawerName: "عميل", amount: 8000, direction: "INCOMING", dueDate: new Date("2026-09-01"), status: "REGISTERED", partyId: عميل.id, accountingVersion: 2, createdById: ahmed.id } });
  const sync = async (status: any, opts: any = {}) => prisma.$transaction(async (tx) => { const c = await tx.cheque.findUniqueOrThrow({ where: { id: ش.id } }); await زامن_آثار_الشيك(tx, c as any, status, opts, ahmed.id); });

  await sync("REGISTERED");
  تحقق(await رطرف(عميل.id) === 2000, "تسجيل: دين العميل 10000→2000");
  تحقق(await رخزنة_شيكات() === خ0 + 8000, "تسجيل: خزنة الشيكات +8000");

  // إيداع في محفظة إنستا باي
  await sync("DEPOSITED", { معرف_حساب_التحصيل: إنستا.id, معرف_حساب_فرعي: محفظة.id });
  تحقق(await رحساب(إنستا.id) === i0 + 8000, "إيداع: إنستا الرئيسي +8000");
  تحقق(await رفرعي(محفظة.id) === 8000, "إيداع: المحفظة +8000 (تظهر في الرئيسي والفرعي معاً)");
  تحقق(await إجمالي() === t0 + 8000, "إيداع: الإجمالي +8000");
  تحقق(await رخزنة_شيكات() === خ0, "إيداع: خرج من خزنة الشيكات");
  تحقق(await رطرف(عميل.id) === 2000, "إيداع: دين العميل ثابت");

  // إلغاء الشيك → لازم يشيل الفلوس من (الرئيسي + المحفظة + الإجمالي) ويرجّع دين العميل
  await sync("CANCELLED");
  تحقق(await رحساب(إنستا.id) === i0, "إلغاء: إنستا الرئيسي رجع");
  تحقق(await رفرعي(محفظة.id) === 0, "إلغاء: المحفظة رجعت صفر — مفيش فلوس عالقة! (هذا هو الإصلاح)");
  تحقق(await إجمالي() === t0, "إلغاء: الإجمالي رجع");
  تحقق(await رطرف(عميل.id) === 10000, "إلغاء: دين العميل رجع 10000");
  // تأكيد الاتساق النهائي عبر إعادة حساب كاملة
  await prisma.$transaction(async (tx) => { await أعد_حساب_حساب_الخزنة(tx, إنستا.id); });
  تحقق(await رفرعي(محفظة.id) === 0 && await رحساب(إنستا.id) === i0, "بعد إعادة الحساب: كله متسق (لا فرق بين التزايدي والكامل)");

  // تنظيف
  await prisma.treasuryTxn.deleteMany({ where: { OR: [{ subAccountId: محفظة.id }, { chequeId: ش.id }] } });
  await prisma.cheque.delete({ where: { id: ش.id } });
  await prisma.ledgerEntry.deleteMany({ where: { partyId: عميل.id } });
  await prisma.treasuryTxn.deleteMany({ where: { partyId: عميل.id } });
  await prisma.party.delete({ where: { id: عميل.id } });
  await prisma.subAccount.delete({ where: { id: محفظة.id } });
  await prisma.$transaction(async (tx) => { await أعد_حساب_حساب_الخزنة(tx, إنستا.id); });
  console.log("✓ تم التنظيف");
}
main().then(() => { console.log("\n✅ نجح اختبار سلامة الخزنة والمحافظ — الفلوس متسقة في كل الأماكن"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
