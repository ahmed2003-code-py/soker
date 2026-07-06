import type { Prisma } from "@prisma/client";
import { PartyType } from "@prisma/client";
import { د, جمع, طرح } from "@/lib/decimal";

type عميل_معاملة = Prisma.TransactionClient;

/**
 * منطق دفتر الأستاذ (حركة_الحساب) واتفاقيات الرصيد:
 * - عميل (CUSTOMER): الرصيد = Σمدين − Σدائن (موجب = العميل مدين لنا / مديونية).
 * - مورد (SUPPLIER): المستحق = Σدائن − Σمدين (موجب = نحن مدينون للمورد).
 * نخزّن "الرصيد_بعد_الحركة" بحسب اتفاقية الطرف، و Party.balance = آخر رصيد.
 */

/** الرصيد التراكمي لحركة واحدة حسب اتفاقية النوع */
function أثر_الحركة(
  النوع: PartyType,
  مدين: Prisma.Decimal.Value,
  دائن: Prisma.Decimal.Value
): Prisma.Decimal {
  return النوع === PartyType.CUSTOMER ? طرح(مدين, دائن) : طرح(دائن, مدين);
}

/**
 * إعادة حساب سلسلة حركات الطرف ترتيباً زمنياً وتحديث الأرصدة.
 * تُستدعى بعد أي إضافة/تعديل/حذف لضمان صحة "الرصيد_بعد_الحركة" و Party.balance.
 * تُرجع الرصيد النهائي.
 */
export async function أعد_حساب_سلسلة_الطرف(
  tx: عميل_معاملة,
  معرف_الطرف: number
): Promise<Prisma.Decimal> {
  const طرف = await tx.party.findUniqueOrThrow({
    where: { id: معرف_الطرف },
    select: { type: true, openingBalance: true },
  });

  const رصيد_ابتدائي = د(طرف.openingBalance);

  // تحديث جميع الأرصدة في استعلام واحد — الرصيد يبدأ من الرصيد الابتدائي
  if (طرف.type === PartyType.CUSTOMER) {
    await tx.$executeRaw`
      WITH running AS (
        SELECT id,
          ${رصيد_ابتدائي} + SUM(debit - credit) OVER (ORDER BY date ASC, id ASC) AS nb
        FROM ledger_entries WHERE party_id = ${معرف_الطرف} AND deleted_at IS NULL
      )
      UPDATE ledger_entries le SET balance_after = running.nb
      FROM running WHERE le.id = running.id
        AND le.balance_after IS DISTINCT FROM running.nb
    `;
  } else {
    await tx.$executeRaw`
      WITH running AS (
        SELECT id,
          ${رصيد_ابتدائي} + SUM(credit - debit) OVER (ORDER BY date ASC, id ASC) AS nb
        FROM ledger_entries WHERE party_id = ${معرف_الطرف} AND deleted_at IS NULL
      )
      UPDATE ledger_entries le SET balance_after = running.nb
      FROM running WHERE le.id = running.id
        AND le.balance_after IS DISTINCT FROM running.nb
    `;
  }

  const آخر = await tx.ledgerEntry.findFirst({
    where: { partyId: معرف_الطرف, deletedAt: null },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    select: { balanceAfter: true },
  });
  // لو ما فيش حركات، الرصيد = الرصيد الابتدائي
  const تراكمي = آخر?.balanceAfter ?? رصيد_ابتدائي;

  await tx.party.update({
    where: { id: معرف_الطرف },
    data: { balance: تراكمي },
  });
  return تراكمي;
}

/**
 * إضافة قيد إلى دفتر أستاذ الطرف داخل معاملة.
 *
 * تحسين الأداء: إذا كان القيد الجديد يقع في *نهاية* السلسلة زمنياً (تاريخه ≥ تاريخ
 * آخر حركة — والقيد الجديد دائماً صاحب أكبر id) نحدّث الرصيد تزايدياً في O(1)
 * بدل إعادة حساب السلسلة كاملة O(n). أما القيد بتاريخ سابق (إدراج وسط السلسلة)
 * فيستدعي إعادة الحساب الكاملة لضمان صحة "الرصيد_بعد_الحركة" لكل ما يليه.
 * النتيجة النهائية مطابقة تماماً لإعادة الحساب الكاملة في الحالتين.
 * تُرجع القيد المُنشأ.
 */
export async function أضف_قيد(
  tx: عميل_معاملة,
  بيانات: {
    معرف_الطرف: number;
    التاريخ: Date;
    البيان: string;
    مدين?: Prisma.Decimal.Value;
    دائن?: Prisma.Decimal.Value;
    رقم_المستند?: string | null;
    التصنيف?: string | null;
    الكمية?: Prisma.Decimal.Value | null;
    السعر?: Prisma.Decimal.Value | null;
    معرف_الفاتورة?: number | null;
    معرف_حركة_الخزنة?: number | null;
    أنشأ: number;
  }
) {
  const طرف = await tx.party.findUniqueOrThrow({
    where: { id: بيانات.معرف_الطرف },
    select: { type: true, openingBalance: true },
  });
  // آخر حركة في السلسلة (الأحدث زمنياً) قبل إضافة القيد الجديد
  const الأخيرة = await tx.ledgerEntry.findFirst({
    where: { partyId: بيانات.معرف_الطرف, deletedAt: null },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    select: { date: true, balanceAfter: true },
  });

  const مدين = د(بيانات.مدين ?? 0);
  const دائن = د(بيانات.دائن ?? 0);
  // لو ما فيش حركات سابقة، نبدأ من الرصيد الابتدائي
  const نقطة_البداية = الأخيرة?.balanceAfter ?? طرف.openingBalance;

  const في_النهاية = !الأخيرة || بيانات.التاريخ >= الأخيرة.date;
  const رصيد_جديد = في_النهاية
    ? جمع(نقطة_البداية, أثر_الحركة(طرف.type, مدين, دائن))
    : د(0); // قيد بتاريخ سابق: يُحسب في إعادة الحساب الكاملة

  const قيد = await tx.ledgerEntry.create({
    data: {
      partyId: بيانات.معرف_الطرف,
      date: بيانات.التاريخ,
      description: بيانات.البيان,
      debit: مدين,
      credit: دائن,
      balanceAfter: رصيد_جديد,
      docNumber: بيانات.رقم_المستند ?? null,
      category: بيانات.التصنيف ?? null,
      qty: بيانات.الكمية != null ? د(بيانات.الكمية) : null,
      price: بيانات.السعر != null ? د(بيانات.السعر) : null,
      invoiceId: بيانات.معرف_الفاتورة ?? null,
      treasuryTxnId: بيانات.معرف_حركة_الخزنة ?? null,
      createdById: بيانات.أنشأ,
    },
  });

  if (في_النهاية) {
    await tx.party.update({
      where: { id: بيانات.معرف_الطرف },
      data: { balance: رصيد_جديد },
    });
  } else {
    await أعد_حساب_سلسلة_الطرف(tx, بيانات.معرف_الطرف);
  }
  return قيد;
}

/**
 * حذف ناعم لقيد دفتر الأستاذ + تحديث دلتا للأرصدة التالية.
 * O(k) حيث k = عدد القيود بعد المحذوف (عادةً ≈ 0 عند حذف الأحدث).
 */
export async function احذف_قيد_ناعم(
  tx: عميل_معاملة,
  معرف_القيد: number
): Promise<void> {
  const قيد = await tx.ledgerEntry.findUnique({
    where: { id: معرف_القيد },
    select: { date: true, debit: true, credit: true, partyId: true },
  });
  if (!قيد) return;

  const طرف = await tx.party.findUniqueOrThrow({
    where: { id: قيد.partyId },
    select: { type: true },
  });

  // الخطوة 1: حذف ناعم
  await tx.ledgerEntry.update({ where: { id: معرف_القيد }, data: { deletedAt: new Date() } });

  // الخطوة 2: دلتا معاكسة (عميل: مدين−دائن؛ مورد: دائن−مدين)
  const دلتا = طرف.type === PartyType.CUSTOMER
    ? طرح(قيد.credit, قيد.debit)
    : طرح(قيد.debit, قيد.credit);

  // الخطوة 3: تعديل أرصدة القيود اللاحقة
  await tx.$executeRaw`
    UPDATE ledger_entries
    SET balance_after = balance_after + ${دلتا}
    WHERE party_id = ${قيد.partyId}
      AND deleted_at IS NULL
      AND (date > ${قيد.date} OR (date = ${قيد.date} AND id > ${معرف_القيد}))
  `;

  // الخطوة 4: تعديل رصيد الطرف
  await tx.party.update({
    where: { id: قيد.partyId },
    data: { balance: { increment: دلتا } },
  });
}

/** تسمية الرصيد حسب نوع الطرف (مديونية/مستحق + دائن/مدين) */
export function وصف_الرصيد(النوع: PartyType, الرصيد: Prisma.Decimal.Value) {
  const ر = د(الرصيد);
  const موجب = ر.greaterThan(0);
  const سالب = ر.lessThan(0);
  if (النوع === PartyType.CUSTOMER) {
    if (موجب) return { نص: "مديونية", لون: "danger" as const };
    if (سالب) return { نص: "دفعة مقدمة", لون: "success" as const };
    return { نص: "مسدّد", لون: "default" as const };
  } else {
    if (موجب) return { نص: "مستحق للمورد", لون: "danger" as const };
    if (سالب) return { نص: "دفعة مقدمة لنا", لون: "success" as const };
    return { نص: "مسوّى", لون: "default" as const };
  }
}
