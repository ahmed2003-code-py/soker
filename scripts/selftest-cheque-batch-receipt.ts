/**
 * اختبار «إضافة عدة شيكات دفعة واحدة من عميل»:
 *  - كل الشيكات تتسجّل على نفس العميل بنفس معرّف معاملة الاستلام ⇒ تتجمّع في صف واحد بكشف حسابه.
 *  - دين العميل يقلّ بإجمالي الدفعة (كل شيك قيد دائن مستقل).
 *  - تقرير المعاملة يجيب كل شيكات الدفعة بإجمالي واحد.
 *  - الدفعة الافتتاحية تتسجّل بلا أي أثر مالي.
 * يحاكي مسار الأكشن أضف_شيكات_واردة_دفعة (نفس دوال lib).
 */
import { PrismaClient } from "@prisma/client";
import { زامن_آثار_الشيك } from "../src/lib/cheques-accounting";
import { اجلب_بيانات_تقرير_السداد } from "../src/lib/settlement-report";

const prisma = new PrismaClient();
const N = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }
const رطرف = async (id: number) => N((await prisma.party.findUniqueOrThrow({ where: { id } })).balance);

/** نفس منطق الأكشن: إنشاء الشيكات + مزامنة الأثر + معرّف معاملة استلام مشترك */
async function أضف_دفعة(معرف_العميل: number, اسم_العميل: string, صفوف: { مبلغ: number; بنك: string; رقم: string }[], أنشأ: number, افتتاحي = false) {
  return prisma.$transaction(async (tx) => {
    const معرفات: number[] = [];
    for (const [i, ص] of صفوف.entries()) {
      const c = await tx.cheque.create({ data: {
        drawerName: اسم_العميل, amount: ص.مبلغ, transferredFrom: اسم_العميل, bankName: ص.بنك,
        dueDate: new Date(2026, 9 + i, 20), chequeNumber: ص.رقم, direction: "INCOMING",
        status: "REGISTERED", partyId: معرف_العميل,
        isOpening: افتتاحي, openingBaseline: افتتاحي ? "REGISTERED" : null, createdById: أنشأ,
      } });
      await زامن_آثار_الشيك(tx, {
        id: c.id, direction: c.direction, amount: c.amount, partyId: c.partyId, chequeNumber: c.chequeNumber,
        drawerName: c.drawerName, status: c.status, collectedTxnId: null, partyLedgerEntryId: null,
        endorseLedgerEntryId: null, endorsedToId: null, accountingVersion: c.accountingVersion,
        isOpening: c.isOpening, openingBaseline: c.openingBaseline, openingAccountId: null, openingSubAccountId: null,
      }, c.status, {}, أنشأ);
      معرفات.push(c.id);
    }
    const معرف_معاملة = Math.min(...معرفات);
    await tx.cheque.updateMany({ where: { id: { in: معرفات } }, data: { receiptBatchId: معرف_معاملة } });
    return { معرفات, معرف_معاملة };
  });
}

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const عميل = await prisma.party.create({ data: { name: "عميل دفعة شيكات", type: "CUSTOMER", openingBalance: 1000000, balance: 1000000, createdById: ahmed.id } });

  const صفوف = [
    { مبلغ: 170000, بنك: "مصر", رقم: "5001" },
    { مبلغ: 190000, بنك: "التجاري الدولي", رقم: "5002" },
    { مبلغ: 200000, بنك: "الاهلي المصري", رقم: "5003" },
  ];
  const إجمالي = صفوف.reduce((س, ص) => س + ص.مبلغ, 0); // 560,000

  const { معرفات, معرف_معاملة } = await أضف_دفعة(عميل.id, عميل.name, صفوف, ahmed.id);
  تحقق(معرفات.length === 3, "اتسجّلت 3 شيكات في إدخال واحد");

  const شيكات = await prisma.cheque.findMany({ where: { id: { in: معرفات } }, select: { receiptBatchId: true, partyId: true, status: true, transferredFrom: true } });
  تحقق(شيكات.every((ش) => ش.receiptBatchId === معرف_معاملة), "كل الشيكات بنفس معرّف معاملة الاستلام (تتجمّع في صف واحد)");
  تحقق(شيكات.every((ش) => ش.partyId === عميل.id && ش.status === "REGISTERED"), "كلها مربوطة بالعميل وحالتها «مسجّل» (معي)");
  تحقق(شيكات.every((ش) => ش.transferredFrom === عميل.name), "«محوّل من» متملّي باسم العميل");

  تحقق(await رطرف(عميل.id) === 1000000 - إجمالي, `دين العميل قلّ بإجمالي الدفعة (${إجمالي})`);
  const قيود = await prisma.ledgerEntry.findMany({ where: { partyId: عميل.id, deletedAt: null } });
  تحقق(قيود.length === 3 && قيود.every((q) => N(q.credit) > 0), "3 قيود دائنة على العميل (قيد لكل شيك)");

  // ── التقرير: كل شيكات الدفعة بإجمالي واحد ──
  const ت = await اجلب_بيانات_تقرير_السداد({ معرفات_الشيكات: معرفات, معرف_الطرف: عميل.id, نوع_الطرف: "CUSTOMER" }, prisma);
  تحقق(ت.شيكات.length === 3 && ت.الإجمالي === إجمالي, `تقرير المعاملة: 3 شيكات بإجمالي ${إجمالي}`);
  تحقق(ت.مورد_سياق === false && ت.اسم_الطرف === عميل.name, "التقرير في سياق العميل (شيكات مستلَمة منه)");

  // ── دفعة افتتاحية: بلا أثر مالي ──
  const قبل = await رطرف(عميل.id);
  const { معرفات: افت } = await أضف_دفعة(عميل.id, عميل.name, [{ مبلغ: 50000, بنك: "مصر", رقم: "6001" }], ahmed.id, true);
  تحقق(await رطرف(عميل.id) === قبل, "الدفعة الافتتاحية اتسجّلت بلا أي أثر على رصيد العميل");

  // تنظيف
  await prisma.ledgerEntry.deleteMany({ where: { partyId: عميل.id } });
  await prisma.cheque.deleteMany({ where: { id: { in: [...معرفات, ...افت] } } });
  await prisma.party.delete({ where: { id: عميل.id } });
}

main().then(() => { console.log("\n✅ نجح اختبار دفعة الشيكات الواردة من عميل"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
