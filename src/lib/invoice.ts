import type { Prisma } from "@prisma/client";
import { د, جمع, ضرب } from "@/lib/decimal";
import { أعد_حساب_سلسلة_الطرف } from "@/lib/ledger";

type عميل_معاملة = Prisma.TransactionClient;

export type بند_إدخال = {
  اللون: string;
  الكمية: Prisma.Decimal.Value | null;
  الوزن: Prisma.Decimal.Value | null;
  التصنيف: string;
  السعر?: Prisma.Decimal.Value | null;
  ملاحظات?: string | null;
};

/** رقم فاتورة تسلسلي فريد آمن للتزامن (تحديث ذرّي لعدّاد الإعدادات). */
export async function احصل_رقم_فاتورة_جديد(tx: عميل_معاملة): Promise<number> {
  const نتيجة = await tx.$queryRaw<{ value: string }[]>`
    UPDATE settings SET value = ((value::int) + 1)::text
    WHERE key = 'عداد_الفواتير'
    RETURNING value
  `;
  if (!نتيجة[0]) throw new Error("عدّاد الفواتير غير مُهيّأ");
  return Number(نتيجة[0].value);
}

/** حساب إجماليات الفاتورة. التسعير بالوزن: مجموع البند = السعر × الوزن. */
export function احسب_إجماليات(بنود: بند_إدخال[]) {
  let إجمالي_الكمية = د(0);
  let إجمالي_الوزن = د(0);
  let الإجمالي_المالي = د(0);
  const بنود_محسوبة = بنود.map((ب) => {
    const وزن = د(ب.الوزن || 0);
    const كمية = د(ب.الكمية || 0);
    const سعر = ب.السعر != null && ب.السعر !== "" ? د(ب.السعر) : د(0);
    const مجموع_البند = ضرب(سعر, وزن); // التسعير بالوزن
    إجمالي_الكمية = جمع(إجمالي_الكمية, كمية);
    إجمالي_الوزن = جمع(إجمالي_الوزن, وزن);
    الإجمالي_المالي = جمع(الإجمالي_المالي, مجموع_البند);
    return { ...ب, _مجموع: مجموع_البند, _وزن: وزن, _كمية: كمية, _سعر: سعر };
  });
  return { إجمالي_الكمية, إجمالي_الوزن, الإجمالي_المالي, بنود_محسوبة };
}

/** تجميع البنود حسب التصنيف (للملخص أسفل الفاتورة). */
export function جمّع_حسب_التصنيف(
  بنود: { التصنيف: string; الكمية: Prisma.Decimal.Value; الوزن: Prisma.Decimal.Value }[]
) {
  const خريطة = new Map<string, { كمية: Prisma.Decimal; وزن: Prisma.Decimal }>();
  for (const ب of بنود) {
    const ح = خريطة.get(ب.التصنيف) ?? { كمية: د(0), وزن: د(0) };
    ح.كمية = جمع(ح.كمية, ب.الكمية || 0);
    ح.وزن = جمع(ح.وزن, ب.الوزن || 0);
    خريطة.set(ب.التصنيف, ح);
  }
  return [...خريطة.entries()].map(([التصنيف, ح]) => ({
    التصنيف,
    الكمية: ح.كمية,
    الوزن: ح.وزن,
  }));
}

/**
 * ترحيل قيمة الفاتورة كقيد مدين على العميل (مرتبط برقم الفاتورة) + إعادة حساب الرصيد.
 */
export async function رحّل_فاتورة_للعميل(
  tx: عميل_معاملة,
  بيانات: {
    معرف_الفاتورة: number;
    رقم_الفاتورة: number;
    معرف_العميل: number;
    التاريخ: Date;
    القيمة: Prisma.Decimal.Value;
    أنشأ: number;
  }
) {
  await tx.ledgerEntry.create({
    data: {
      partyId: بيانات.معرف_العميل,
      date: بيانات.التاريخ,
      description: `فاتورة رقم ${بيانات.رقم_الفاتورة}`,
      docNumber: String(بيانات.رقم_الفاتورة),
      debit: د(بيانات.القيمة),
      credit: 0,
      balanceAfter: 0,
      invoiceId: بيانات.معرف_الفاتورة,
      createdById: بيانات.أنشأ,
    },
  });
  await أعد_حساب_سلسلة_الطرف(tx, بيانات.معرف_العميل);
}

/** عكس قيود فاتورة (حذف قيود دفتر الأستاذ المرتبطة) + إعادة حساب رصيد العميل. */
export async function اعكس_قيود_الفاتورة(
  tx: عميل_معاملة,
  معرف_الفاتورة: number,
  معرف_العميل: number
) {
  await tx.ledgerEntry.deleteMany({ where: { invoiceId: معرف_الفاتورة } });
  await أعد_حساب_سلسلة_الطرف(tx, معرف_العميل);
}
