/** اختبار النموذج الجديد v2: خزنة الشيكات + مسجّل/مودع/مظهّر/محصّل + ارتداد (حالتين) + إلغاء + عدم تأثّر v1. */
import { PrismaClient } from "@prisma/client";
import { زامن_آثار_الشيك, رصيد_خزنة_الشيكات } from "../src/lib/cheques-accounting";
const prisma = new PrismaClient();
const N = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }
const رطرف = async (id: number) => N((await prisma.party.findUniqueOrThrow({ where: { id } })).balance);
const رحساب = async (id: number) => N((await prisma.treasuryAccount.findUniqueOrThrow({ where: { id } })).balance);
const رخزنة_شيكات = async () => N(await رصيد_خزنة_الشيكات(prisma));

async function sync(id: number, status: any, actor: number, opts: any = {}) {
  await prisma.$transaction(async (tx) => {
    const c = await tx.cheque.findUniqueOrThrow({ where: { id } });
    await زامن_آثار_الشيك(tx, c as any, status, opts, actor);
  });
}

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const cash = await prisma.treasuryAccount.findUniqueOrThrow({ where: { type: "CASH" } });
  const bank = await prisma.treasuryAccount.findUniqueOrThrow({ where: { type: "BANK" } });
  const c0 = await رحساب(cash.id), b0 = await رحساب(bank.id), خ0 = await رخزنة_شيكات();

  const عميل = await prisma.party.create({ data: { name: "عميل v2", type: "CUSTOMER", openingBalance: 10000, balance: 10000, createdById: ahmed.id } });
  const مورد = await prisma.party.create({ data: { name: "مورد v2", type: "SUPPLIER", openingBalance: 8000, balance: 8000, createdById: ahmed.id } });

  // ═══ 1) تسجيل شيك وارد 4000 (v2) → دين العميل يقل 4000 + خزنة الشيكات +4000 ═══
  const ش = await prisma.cheque.create({ data: { drawerName: "عميل", amount: 4000, direction: "INCOMING", dueDate: new Date("2026-09-01"), status: "REGISTERED", partyId: عميل.id, accountingVersion: 2, createdById: ahmed.id } });
  await sync(ش.id, "REGISTERED", ahmed.id);
  تحقق(await رطرف(عميل.id) === 6000, "مسجّل: دين العميل 10000 → 6000");
  تحقق(await رخزنة_شيكات() === خ0 + 4000, "مسجّل: خزنة الشيكات +4000");
  تحقق(await رحساب(bank.id) === b0 && await رحساب(cash.id) === c0, "مسجّل: لا بنك ولا نقدي");

  // ═══ 2) إيداع في البنك → بنك +4000، خزنة الشيكات ترجع، دين العميل ثابت ═══
  await sync(ش.id, "DEPOSITED", ahmed.id, { معرف_حساب_التحصيل: bank.id });
  تحقق(await رحساب(bank.id) === b0 + 4000, "مودع: البنك +4000");
  تحقق(await رخزنة_شيكات() === خ0, "مودع: خزنة الشيكات ترجع لأصلها");
  تحقق(await رطرف(عميل.id) === 6000, "مودع: دين العميل ثابت 6000");

  // ═══ 3) ارتداد (كان مودعاً) → بنك -4000، دين العميل يرجع 10000 ═══
  await sync(ش.id, "BOUNCED", ahmed.id);
  تحقق(await رحساب(bank.id) === b0, "مرتد(مودع): البنك يرجع لأصله");
  تحقق(await رطرف(عميل.id) === 10000, "مرتد(مودع): دين العميل يرجع 10000");
  تحقق(await رخزنة_شيكات() === خ0, "مرتد: مش في خزنة الشيكات");

  // ═══ 4) تحصيل نقدي (شيك جديد) → نقدي +5000 ═══
  const ش2 = await prisma.cheque.create({ data: { drawerName: "عميل", amount: 5000, direction: "INCOMING", dueDate: new Date("2026-09-01"), status: "REGISTERED", partyId: عميل.id, accountingVersion: 2, createdById: ahmed.id } });
  await sync(ش2.id, "REGISTERED", ahmed.id);
  تحقق(await رطرف(عميل.id) === 5000, "تسجيل ش2: دين العميل 10000 → 5000");
  await sync(ش2.id, "COLLECTED", ahmed.id);
  تحقق(await رحساب(cash.id) === c0 + 5000, "محصّل: النقدي +5000");
  تحقق(await رخزنة_شيكات() === خ0, "محصّل: خرج من خزنة الشيكات");
  تحقق(await رطرف(عميل.id) === 5000, "محصّل: دين العميل ثابت");

  // ═══ 5) تظهير لمورد ثم ارتداد → الحالة الثانية ═══
  const ش3 = await prisma.cheque.create({ data: { drawerName: "عميل", amount: 3000, direction: "INCOMING", dueDate: new Date("2026-09-01"), status: "REGISTERED", partyId: عميل.id, accountingVersion: 2, createdById: ahmed.id } });
  await sync(ش3.id, "REGISTERED", ahmed.id);
  const دين_قبل = await رطرف(عميل.id); // 5000 - 3000 = 2000
  تحقق(دين_قبل === 2000, "تسجيل ش3: دين العميل → 2000");
  await sync(ش3.id, "ENDORSED", ahmed.id, { معرف_المورد_للتظهير: مورد.id });
  تحقق(await رطرف(مورد.id) === 5000, "مظهّر: مستحق المورد 8000 → 5000");
  تحقق(await رطرف(عميل.id) === 2000, "مظهّر: دين العميل ثابت 2000");
  تحقق(await رخزنة_شيكات() === خ0, "مظهّر: خرج من خزنة الشيكات");
  // ارتداد بعد التظهير → يرجع للعميل وللمورد
  await sync(ش3.id, "BOUNCED", ahmed.id);
  تحقق(await رطرف(مورد.id) === 8000, "مرتد(مظهّر): مستحق المورد يرجع 8000");
  تحقق(await رطرف(عميل.id) === 5000, "مرتد(مظهّر): دين العميل يرجع (2000+3000=5000)");

  // ═══ 6) إلغاء شيك محصّل (ش2) → يعكس كل الأثر ═══
  await prisma.$transaction(async (tx) => {
    const c = await tx.cheque.findUniqueOrThrow({ where: { id: ش2.id } });
    await زامن_آثار_الشيك(tx, c as any, "CANCELLED", {}, ahmed.id);
    await tx.cheque.update({ where: { id: ش2.id }, data: { cancelReason: "خطأ إدخال", cancelledAt: new Date() } });
  });
  تحقق(await رحساب(cash.id) === c0, "ملغي: النقدي يرجع لأصله");
  تحقق(await رطرف(عميل.id) === 10000, "ملغي: دين العميل يرجع 10000 (5000+5000)");
  const ملغى = await prisma.cheque.findUniqueOrThrow({ where: { id: ش2.id } });
  تحقق(ملغى.status === "CANCELLED" && ملغى.cancelReason === "خطأ إدخال" && ملغى.cancelledAt != null, "ملغي: سبب+تاريخ محفوظان بدون حذف");

  // ═══ 7) عدم تأثّر v1: شيك قديم (نسخة 1) يتبع المنطق القديم (PENDING يخصم، لا خزنة شيكات) ═══
  const عميل1 = await prisma.party.create({ data: { name: "عميل v1", type: "CUSTOMER", openingBalance: 7000, balance: 7000, createdById: ahmed.id } });
  const شv1 = await prisma.cheque.create({ data: { drawerName: "عميل", amount: 2000, direction: "INCOMING", dueDate: new Date("2026-09-01"), status: "REGISTERED", partyId: عميل1.id, accountingVersion: 1, createdById: ahmed.id } });
  await sync(شv1.id, "PENDING", ahmed.id); // v1: PENDING يخصم من العميل
  تحقق(await رطرف(عميل1.id) === 5000, "v1: PENDING خصم دين العميل 7000 → 5000 (منطق قديم)");
  تحقق(await رخزنة_شيكات() === خ0, "v1: لا يدخل خزنة الشيكات (مقصور على v2)");

  // تنظيف
  for (const id of [ش.id, ش2.id, ش3.id, شv1.id]) { await prisma.treasuryTxn.deleteMany({ where: { chequeId: id } }); await prisma.cheque.delete({ where: { id } }); }
  for (const p of [عميل.id, مورد.id, عميل1.id]) { await prisma.ledgerEntry.deleteMany({ where: { partyId: p } }); await prisma.treasuryTxn.deleteMany({ where: { partyId: p } }); await prisma.party.delete({ where: { id: p } }); }
  await prisma.treasuryTxn.deleteMany({ where: { description: { contains: "شيك وارد" } } });
  await prisma.$transaction(async (tx) => { const { أعد_حساب_حساب_الخزنة } = await import("../src/lib/treasury"); for (const h of [cash.id, bank.id]) await أعد_حساب_حساب_الخزنة(tx, h); });
  console.log("✓ تم التنظيف");
}
main().then(() => { console.log("\n✅ نجح اختبار نموذج خزنة الشيكات v2"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
