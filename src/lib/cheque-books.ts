import { prisma } from "@/lib/prisma";
import { د } from "@/lib/decimal";
import type { ChequeDirection } from "@prisma/client";

/**
 * دفاتر/حافظات الشيكات (المرحلة 5).
 * دفتر صادر: بنك + مدى أرقام أوراق → نتتبّع المستخدَم/المتبقّي من الأوراق.
 * حافظة واردة: تجميع شيكات مستلَمة بالاسم → نتتبّع العدد والإجمالي.
 * كله طبقة تنظيمية: لا أثر محاسبي.
 */
export type دفتر_معروض = {
  id: number;
  الاسم: string;
  الاتجاه: ChequeDirection;
  اسم_البنك: string | null;
  من_رقم: number | null;
  إلى_رقم: number | null;
  ملاحظات: string | null;
  نشط: boolean;
  عدد_الشيكات: number;
  إجمالي_القيمة: number;
  سعة_الأوراق: number | null; // (إلى−من+1) للدفاتر ذات المدى
  متبقّي_الأوراق: number | null;
};

/** جلب كل الدفاتر/الحافظات مع إحصاءات الاستخدام (بلا N+1). */
export async function اجلب_الدفاتر(): Promise<دفتر_معروض[]> {
  const دفاتر = await prisma.chequeBook.findMany({ orderBy: [{ isActive: "desc" }, { id: "desc" }] });
  const تجميع = await prisma.cheque.groupBy({
    by: ["chequeBookId"],
    where: { chequeBookId: { not: null } },
    _count: { _all: true },
    _sum: { amount: true },
  });
  const خريطة = new Map(تجميع.map((g) => [g.chequeBookId, { عدد: g._count._all, مجموع: Number(g._sum.amount ?? 0) }]));
  return دفاتر.map((د2) => {
    const إح = خريطة.get(د2.id) ?? { عدد: 0, مجموع: 0 };
    const سعة = د2.startNo != null && د2.endNo != null && د2.endNo >= د2.startNo ? د2.endNo - د2.startNo + 1 : null;
    return {
      id: د2.id,
      الاسم: د2.name,
      الاتجاه: د2.direction,
      اسم_البنك: د2.bankName,
      من_رقم: د2.startNo,
      إلى_رقم: د2.endNo,
      ملاحظات: د2.notes,
      نشط: د2.isActive,
      عدد_الشيكات: إح.عدد,
      إجمالي_القيمة: إح.مجموع,
      سعة_الأوراق: سعة,
      متبقّي_الأوراق: سعة != null ? Math.max(0, سعة - إح.عدد) : null,
    };
  });
}

/** خيارات الدفاتر لقوائم الاختيار في نموذج الشيك (نشطة فقط، حسب الاتجاه). */
export async function اجلب_خيارات_الدفاتر(الاتجاه?: ChequeDirection) {
  const دفاتر = await prisma.chequeBook.findMany({
    where: { isActive: true, ...(الاتجاه ? { direction: الاتجاه } : {}) },
    orderBy: { name: "asc" },
    select: { id: true, name: true, direction: true, bankName: true },
  });
  return دفاتر.map((d) => ({ id: d.id, الاسم: d.name, الاتجاه: d.direction, اسم_البنك: d.bankName }));
}

/** حساب إجمالي بسيط لمجموعة أرقام (للتحقق من التداخل — احتياطي مستقبلي). */
export function نطاق_صالح(من: number | null | undefined, إلى: number | null | undefined): boolean {
  if (من == null || إلى == null) return true; // مدى اختياري
  return Number(إلى) >= Number(من);
}

export { د };
