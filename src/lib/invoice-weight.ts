import type { PartyType, PrismaClient } from "@prisma/client";
import { prisma as عميل_افتراضي } from "@/lib/prisma";

export type وزن_قيد = { الإجمالي: number; حسب_التصنيف: { تصنيف: string; الوزن: number }[] };

type قيد_للوزن = { id: number; invoiceId: number | null; debit: unknown; credit: unknown };

/**
 * وزن الفاتورة المقابل لكل قيد في دفتر أستاذ طرف — مفتاحه معرّف القيد.
 *
 * القيد على «الجانب الطبيعي» للطرف (عميل: مدين = بيع، مورد: دائن = شراء) ياخد وزن بنود
 * الفاتورة العادية بالموجب. القيد على الجانب العكسي ياخد وزن بنود المرتجع بالسالب —
 * إلا فاتورة «مرتجع مورد» كلها، اللي بنودها عادية فيتعكس وزنها كله بالسالب.
 */
export async function اجلب_أوزان_القيود(
  قيود: قيد_للوزن[],
  نوع_الطرف: PartyType,
  p: PrismaClient = عميل_افتراضي
): Promise<Map<number, وزن_قيد | null>> {
  const معرفات_فواتير = [...new Set(قيود.map((ق) => ق.invoiceId).filter((x): x is number => x != null))];
  const النتيجة = new Map<number, وزن_قيد | null>();
  if (معرفات_فواتير.length === 0) return النتيجة;

  const [بنود, فواتير] = await Promise.all([
    p.invoiceLine.groupBy({
      by: ["invoiceId", "category", "lineType"],
      where: { invoiceId: { in: معرفات_فواتير } },
      _sum: { weight: true },
    }),
    p.invoice.findMany({ where: { id: { in: معرفات_فواتير } }, select: { id: true, invoiceType: true } }),
  ]);
  const نوع_فاتورة = new Map(فواتير.map((f) => [f.id, f.invoiceType]));

  const خام = new Map<number, { عادي: Map<string, number>; مرتجع: Map<string, number> }>();
  for (const ب of بنود) {
    const سجل = خام.get(ب.invoiceId) ?? { عادي: new Map<string, number>(), مرتجع: new Map<string, number>() };
    const جانب = ب.lineType === "RETURN" ? سجل.مرتجع : سجل.عادي;
    جانب.set(ب.category, (جانب.get(ب.category) ?? 0) + Number(ب._sum.weight ?? 0));
    خام.set(ب.invoiceId, سجل);
  }

  const حوّل = (خريطة: Map<string, number> | undefined, إشارة: 1 | -1): وزن_قيد | null => {
    if (!خريطة) return null;
    const حسب_التصنيف = [...خريطة.entries()]
      .filter(([, وزن]) => Math.abs(وزن) > 0.001)
      .map(([تصنيف, وزن]) => ({ تصنيف, الوزن: إشارة * وزن }));
    if (حسب_التصنيف.length === 0) return null;
    return { حسب_التصنيف, الإجمالي: حسب_التصنيف.reduce((س, ت) => س + ت.الوزن, 0) };
  };

  const عميل = نوع_الطرف === "CUSTOMER";
  for (const ق of قيود) {
    if (ق.invoiceId == null) continue;
    const سجل = خام.get(ق.invoiceId);
    const طبيعي = عميل ? Number(ق.debit) > 0 : Number(ق.credit) > 0;
    let وزن: وزن_قيد | null;
    if (طبيعي) وزن = حوّل(سجل?.عادي, 1);
    else if (نوع_فاتورة.get(ق.invoiceId) === "SUPPLIER_RETURN") وزن = حوّل(سجل?.عادي, -1);
    else وزن = حوّل(سجل?.مرتجع, -1);
    النتيجة.set(ق.id, وزن);
  }
  return النتيجة;
}
