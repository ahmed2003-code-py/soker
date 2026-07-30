import { prisma } from "@/lib/prisma";
import { د } from "@/lib/decimal";
import type { ChequeStatus } from "@prisma/client";

/**
 * طبقة تخصيص/تتبّع فقط (المرحلة 4): توزيع قيمة شيك على فواتير محددة.
 * لا تُنشئ ولا تعدّل أي قيود محاسبية — أثر الطرف تمّ وقت استلام/تسليم الشيك.
 * الشيكات المرتدة/الملغاة لا تُحتسب مغطّية للفاتورة.
 */
export const حالات_لا_تغطّي: ChequeStatus[] = ["BOUNCED", "CANCELLED"];

/** توزيع شيك واحد: قيمته، المخصَّص، المتبقّي غير الموزَّع، وبنود التوزيع. */
export async function اجلب_توزيع_شيك(معرف_الشيك: number) {
  const شيك = await prisma.cheque.findUnique({
    where: { id: معرف_الشيك },
    select: { id: true, amount: true, direction: true, partyId: true },
  });
  if (!شيك) return null;
  const بنود = await prisma.chequeInvoiceAllocation.findMany({
    where: { chequeId: معرف_الشيك },
    orderBy: { id: "asc" },
    select: {
      id: true, amount: true, invoiceId: true,
      invoice: { select: { number: true, date: true, totalAmount: true, customerId: true, guestName: true } },
    },
  });
  const مخصَّص = بنود.reduce((س, ب) => س.plus(ب.amount), د(0));
  return {
    قيمة_الشيك: Number(شيك.amount),
    المخصَّص: Number(مخصَّص),
    غير_موزَّع: Number(د(شيك.amount).minus(مخصَّص)),
    معرف_الطرف: شيك.partyId,
    الاتجاه: شيك.direction,
    البنود: بنود.map((ب) => ({
      id: ب.id,
      معرف_الفاتورة: ب.invoiceId,
      المبلغ: Number(ب.amount),
      رقم_الفاتورة: ب.invoice.number,
      تاريخ_الفاتورة: ب.invoice.date.toISOString(),
      إجمالي_الفاتورة: Number(ب.invoice.totalAmount),
    })),
  };
}

/** إجمالي ما غُطّي على فاتورة بشيكات (باستثناء المرتد/الملغى). */
export async function مدفوع_فاتورة_بشيكات(معرف_الفاتورة: number): Promise<number> {
  const بنود = await prisma.chequeInvoiceAllocation.findMany({
    where: { invoiceId: معرف_الفاتورة, cheque: { status: { notIn: حالات_لا_تغطّي } } },
    select: { amount: true },
  });
  return Number(بنود.reduce((س, ب) => س.plus(ب.amount), د(0)));
}

/** نسخة مجمّعة لعدة فواتير (لتفادي N+1 في القوائم/التقارير). */
export async function مدفوع_فواتير_بشيكات(معرفات: number[]): Promise<Map<number, number>> {
  const م = new Map<number, number>();
  if (معرفات.length === 0) return م;
  const بنود = await prisma.chequeInvoiceAllocation.findMany({
    where: { invoiceId: { in: معرفات }, cheque: { status: { notIn: حالات_لا_تغطّي } } },
    select: { invoiceId: true, amount: true },
  });
  for (const ب of بنود) م.set(ب.invoiceId, Number(د(م.get(ب.invoiceId) ?? 0).plus(ب.amount)));
  return م;
}
