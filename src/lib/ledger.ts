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
    select: { type: true },
  });
  const حركات = await tx.ledgerEntry.findMany({
    where: { partyId: معرف_الطرف },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    select: { id: true, debit: true, credit: true, balanceAfter: true },
  });

  let تراكمي = د(0);
  for (const ح of حركات) {
    تراكمي = جمع(تراكمي, أثر_الحركة(طرف.type, ح.debit, ح.credit));
    if (!تراكمي.equals(ح.balanceAfter)) {
      await tx.ledgerEntry.update({
        where: { id: ح.id },
        data: { balanceAfter: تراكمي },
      });
    }
  }

  await tx.party.update({
    where: { id: معرف_الطرف },
    data: { balance: تراكمي },
  });
  return تراكمي;
}

/**
 * إضافة قيد إلى دفتر أستاذ الطرف داخل معاملة، ثم إعادة حساب السلسلة.
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
  const قيد = await tx.ledgerEntry.create({
    data: {
      partyId: بيانات.معرف_الطرف,
      date: بيانات.التاريخ,
      description: بيانات.البيان,
      debit: د(بيانات.مدين ?? 0),
      credit: د(بيانات.دائن ?? 0),
      balanceAfter: 0, // يُحسب في إعادة الحساب
      docNumber: بيانات.رقم_المستند ?? null,
      category: بيانات.التصنيف ?? null,
      qty: بيانات.الكمية != null ? د(بيانات.الكمية) : null,
      price: بيانات.السعر != null ? د(بيانات.السعر) : null,
      invoiceId: بيانات.معرف_الفاتورة ?? null,
      treasuryTxnId: بيانات.معرف_حركة_الخزنة ?? null,
      createdById: بيانات.أنشأ,
    },
  });
  await أعد_حساب_سلسلة_الطرف(tx, بيانات.معرف_الطرف);
  return قيد;
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
