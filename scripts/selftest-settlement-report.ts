/**
 * اختبار «تقرير معاملة السداد الشامل»:
 *  - سداد مركّب = شيكات مُظهَّرة + دفعة موزّعة (نقدي/بنك) تحت معاملة سداد واحدة.
 *  - التقرير يجيب الجهتين وإجمالي عام واحد، من أي مدخل: معاملة / شيكات / دفعة موزّعة.
 *  - المعاملات القديمة (بلا ربط) يربطها سكربت الـ backfill بنفس المنطق.
 * يحاكي مسار الأكشن سداد_مركب_لمورد (نفس دوال lib).
 */
import { PrismaClient } from "@prisma/client";
import { أنشئ_دفعة_موزعة } from "../src/lib/integration";
import { زامن_آثار_الشيك } from "../src/lib/cheques-accounting";
import { اجلب_بيانات_تقرير_السداد } from "../src/lib/settlement-report";
import { د } from "../src/lib/decimal";

const prisma = new PrismaClient();
const N = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const cash = await prisma.treasuryAccount.findUniqueOrThrow({ where: { type: "CASH" } });
  const bank = await prisma.treasuryAccount.findUniqueOrThrow({ where: { type: "BANK" } });
  const مورد = await prisma.party.create({ data: { name: "مورد سداد مركّب — تقرير", type: "SUPPLIER", openingBalance: 1000000, balance: 1000000, createdById: ahmed.id } });
  const عميل = await prisma.party.create({ data: { name: "عميل شيكات — تقرير", type: "CUSTOMER", openingBalance: 900000, balance: 900000, createdById: ahmed.id } });

  // 4 شيكات واردة من العميل (مستلَمة)
  const مبالغ = [170000, 190000, 200000, 250000];
  const شيكات = [];
  for (const [i, مبلغ] of مبالغ.entries()) {
    const ش = await prisma.cheque.create({ data: {
      drawerName: `مدين ${i + 1}`, amount: مبلغ, direction: "INCOMING", bankName: "مصر",
      dueDate: new Date(2026, 9 + i, 15), chequeNumber: `9000${i}`, status: "PENDING",
      partyId: عميل.id, accountingVersion: 1, createdById: ahmed.id,
    } });
    await prisma.$transaction(async (tx) => {
      const c = await tx.cheque.findUniqueOrThrow({ where: { id: ش.id } });
      await زامن_آثار_الشيك(tx, c as never, "PENDING", {}, ahmed.id);
    });
    شيكات.push(ش);
  }
  const إجمالي_الشيكات = مبالغ.reduce((س, x) => س + x, 0); // 810,000

  // ── سداد مركّب: 4 شيكات مُظهَّرة + 190,000 نقدي/بنك — معاملة واحدة ──
  const تاريخ = new Date("2026-08-27");
  const { معرف_المعاملة, معرف_الدفعة } = await prisma.$transaction(async (tx) => {
    const معاملة = await tx.settlementBatch.create({ data: { partyId: مورد.id, date: تاريخ, note: `سداد مركب — ${مورد.name}`, createdById: ahmed.id } });
    const دفعة = await أنشئ_دفعة_موزعة(tx, {
      الاتجاه: "صرف", معرف_الطرف: مورد.id, اسم_الطرف: مورد.name, الإجمالي: د(190000), التاريخ: تاريخ,
      البيان: `سداد مركب — ${مورد.name}`,
      بنود: [
        { معرف_الحساب: cash.id, المبلغ: د(150000), طريقة_الدفع: "نقدي" },
        { معرف_الحساب: bank.id, المبلغ: د(40000), طريقة_الدفع: "بنك" },
      ],
      أنشأ: ahmed.id,
    });
    await tx.splitPayment.update({ where: { id: دفعة.معرف_المجموعة }, data: { settlementBatchId: معاملة.id } });
    for (const ش of شيكات) {
      const c = await tx.cheque.findUniqueOrThrow({ where: { id: ش.id } });
      await زامن_آثار_الشيك(tx, c as never, "ENDORSED", { معرف_المورد_للتظهير: مورد.id }, ahmed.id);
    }
    await tx.cheque.updateMany({
      where: { id: { in: شيكات.map((ش) => ش.id) } },
      data: { endorseBatchId: Math.min(...شيكات.map((ش) => ش.id)), settlementBatchId: معاملة.id },
    });
    return { معرف_المعاملة: معاملة.id, معرف_الدفعة: دفعة.معرف_المجموعة };
  });

  const رصيد_المورد = N((await prisma.party.findUniqueOrThrow({ where: { id: مورد.id } })).balance);
  تحقق(رصيد_المورد === 1000000 - إجمالي_الشيكات - 190000, "المستحق للمورد قلّ بإجمالي السداد (شيكات + نقدي)");

  // ── التقرير من معرّف المعاملة ──
  const ت = await اجلب_بيانات_تقرير_السداد({ معرف_معاملة: معرف_المعاملة }, prisma);
  تحقق(ت.شيكات.length === 4, "التقرير: 4 شيكات");
  تحقق(ت.حركات.length === 2, "التقرير: حركتان نقدي/بنك (مش شيكات بس)");
  تحقق(ت.إجمالي_الشيكات === إجمالي_الشيكات, `التقرير: إجمالي الشيكات ${إجمالي_الشيكات}`);
  تحقق(ت.إجمالي_النقدي === 190000, "التقرير: إجمالي النقدي والتحويلات 190,000");
  تحقق(ت.الإجمالي === إجمالي_الشيكات + 190000, "التقرير: الإجمالي العام = شيكات + نقدي = 1,000,000");
  تحقق(ت.مركّبة === true && ت.مورد_سياق === true, "التقرير متعرّف إنه سداد مركّب لمورد");
  تحقق(ت.اسم_الطرف === مورد.name, "التقرير: اسم المورد ظاهر");

  // ── نفس التقرير من رابط الشيكات القديم (ids) ⇒ يترقّى للشامل ──
  const ت2 = await اجلب_بيانات_تقرير_السداد({ معرفات_الشيكات: [شيكات[0].id] }, prisma);
  تحقق(ت2.شيكات.length === 4 && ت2.حركات.length === 2 && ت2.الإجمالي === ت.الإجمالي,
    "الدخول بشيك واحد (ids) يرجّع المعاملة كاملة بنفس الإجمالي");

  // ── ومن جهة الدفعة الموزّعة ──
  const ت3 = await اجلب_بيانات_تقرير_السداد({ معرف_دفعة_موزعة: معرف_الدفعة }, prisma);
  تحقق(ت3.شيكات.length === 4 && ت3.حركات.length === 2, "الدخول من الدفعة الموزّعة (split) يرجّع المعاملة كاملة");

  // ── معاملة قديمة بلا ربط: التقرير بالشيكات يجيب الشيكات بس (زي المشكلة الأصلية) ──
  await prisma.cheque.updateMany({ where: { id: { in: شيكات.map((ش) => ش.id) } }, data: { settlementBatchId: null } });
  await prisma.splitPayment.update({ where: { id: معرف_الدفعة }, data: { settlementBatchId: null } });
  const ت4 = await اجلب_بيانات_تقرير_السداد({ معرفات_الشيكات: شيكات.map((ش) => ش.id) }, prisma);
  تحقق(ت4.حركات.length === 0 && ت4.الإجمالي === إجمالي_الشيكات, "قبل الربط: التقرير بيجيب الشيكات بس (المشكلة الأصلية)");

  // تنظيف
  await prisma.settlementBatch.deleteMany({ where: { id: معرف_المعاملة } });
  await prisma.cheque.deleteMany({ where: { id: { in: شيكات.map((ش) => ش.id) } } });
  await prisma.treasuryTxn.deleteMany({ where: { splitPaymentId: معرف_الدفعة } });
  await prisma.ledgerEntry.deleteMany({ where: { partyId: { in: [مورد.id, عميل.id] } } });
  await prisma.splitPayment.delete({ where: { id: معرف_الدفعة } });
  await prisma.party.deleteMany({ where: { id: { in: [مورد.id, عميل.id] } } });
}

main().then(() => { console.log("\n✅ نجح اختبار تقرير معاملة السداد الشامل"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
