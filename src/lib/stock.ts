import type { Prisma, PrismaClient, StockMoveKind } from "@prisma/client";
import { prisma as عميل_افتراضي } from "@/lib/prisma";
import { د, جمع, طرح } from "@/lib/decimal";

type عميل_معاملة = Prisma.TransactionClient;

/**
 * منطق المخزن — وحدة الرصيد = (الصنف × اللون × اللط).
 *
 * القواعد التجارية المتّبعة:
 *  1) كل حركة مخزنية تُكتب في سجل الحركات (append-only بحذف ناعم) ومعها الرصيد
 *     بعد الحركة — نفس نمط دفتر الأستاذ والخزنة، فالكشف يتقرأ زي كشف الحساب.
 *  2) الرصيد مخزَّن على اللط + دالة إعادة حساب من الحركات (لا نثق برصيد قديم بعد
 *     تعديل أو حذف).
 *  3) الكمية (الشكاير) هي وحدة المنع: ممنوع الصرف بأكتر من المتاح.
 *     الوزن تتبعي (وزن الشكارة بيختلف) فبيتخصم بالفعلي وبنكتفي بتحذير.
 *  4) كل حركة داخل نفس معاملة الفاتورة الذرّية، ومختومة بمن نفّذها.
 */

export const تسمية_حركة_المخزن: Record<StockMoveKind, string> = {
  OPENING: "جرد افتتاحي",
  PURCHASE_IN: "وارد شراء",
  SALE_OUT: "صادر بيع",
  CUSTOMER_RETURN_IN: "مرتجع عميل (وارد)",
  SUPPLIER_RETURN_OUT: "مرتجع للمورد (صادر)",
  ADJUST: "تسوية جرد",
};

/** اتجاه الحركة: +1 وارد، −1 صادر (التسوية تُعامَل كوارد بقيمة موجبة أو سالبة) */
export function اتجاه_الحركة(نوع: StockMoveKind): 1 | -1 {
  return نوع === "SALE_OUT" || نوع === "SUPPLIER_RETURN_OUT" ? -1 : 1;
}

/**
 * إعادة حساب رصيد اللط من حركاته بالترتيب الزمني + تحديث «الرصيد بعد الحركة»
 * لكل حركة. تُستدعى بعد أي إضافة/تعديل/حذف.
 */
export async function أعد_حساب_رصيد_اللط(tx: عميل_معاملة, معرف_اللط: number) {
  const حركات = await tx.stockMovement.findMany({
    where: { lotId: معرف_اللط, deletedAt: null },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    select: { id: true, kind: true, qty: true, weight: true },
  });
  let كمية = د(0);
  let وزن = د(0);
  for (const ح of حركات) {
    const إشارة = اتجاه_الحركة(ح.kind);
    كمية = إشارة === 1 ? جمع(كمية, ح.qty) : طرح(كمية, ح.qty);
    وزن = إشارة === 1 ? جمع(وزن, ح.weight) : طرح(وزن, ح.weight);
    await tx.stockMovement.update({
      where: { id: ح.id },
      data: { balanceAfterQty: كمية, balanceAfterWeight: وزن },
    });
  }
  await tx.lot.update({
    where: { id: معرف_اللط },
    data: {
      qty: كمية,
      weight: وزن,
      // اللط يُقفل تلقائياً عند نفاد كميته (يخرج من اقتراح FIFO)
      closedAt: كمية.lessThanOrEqualTo(0) ? new Date() : null,
    },
  });
  return { كمية, وزن };
}

/** رصيد اللط الحالي (كمية/وزن) */
export async function رصيد_اللط(tx: عميل_معاملة, معرف_اللط: number) {
  const ل = await tx.lot.findUnique({ where: { id: معرف_اللط }, select: { qty: true, weight: true, lotNo: true, category: true, color: true } });
  return ل;
}

/**
 * إضافة حركة مخزن + إعادة حساب رصيد اللط.
 * الصادر يتحقق من كفاية الكمية قبل التسجيل (ما لم يُسمح بالسالب صراحةً).
 */
export async function أضف_حركة_مخزن(
  tx: عميل_معاملة,
  ب: {
    معرف_اللط: number;
    النوع: StockMoveKind;
    التاريخ: Date;
    الكمية: Prisma.Decimal.Value;
    الوزن: Prisma.Decimal.Value;
    البيان?: string | null;
    معرف_الفاتورة?: number | null;
    معرف_البند?: number | null;
    أنشأ: number;
  }
) {
  const إشارة = اتجاه_الحركة(ب.النوع);
  if (إشارة === -1) {
    const ل = await رصيد_اللط(tx, ب.معرف_اللط);
    if (!ل) throw new Error("اللط غير موجود");
    // الكمية (الشكاير): منع صارم
    if (د(ل.qty).lessThan(د(ب.الكمية))) {
      throw new Error(
        `الكمية غير كافية في اللط ${ل.lotNo} (${ل.category} — ${ل.color}): المتاح ${Number(ل.qty)} والمطلوب ${Number(ب.الكمية)}`
      );
    }
    // الوزن: تتبعي (وزن الشكارة بيختلف) فبنسمح بفرق حتى 2%، وأي تجاوز أكبر = خطأ إدخال
    const حد_الوزن = د(ل.weight).times(1.02);
    if (د(ب.الوزن).greaterThan(حد_الوزن)) {
      throw new Error(
        `الوزن أكبر من المتاح في اللط ${ل.lotNo} (${ل.category} — ${ل.color}): المتاح ${Number(ل.weight).toFixed(2)} كجم والمطلوب ${Number(ب.الوزن).toFixed(2)} كجم`
      );
    }
  }
  const حركة = await tx.stockMovement.create({
    data: {
      lotId: ب.معرف_اللط,
      kind: ب.النوع,
      date: ب.التاريخ,
      qty: ب.الكمية,
      weight: ب.الوزن,
      description: ب.البيان ?? null,
      invoiceId: ب.معرف_الفاتورة ?? null,
      invoiceLineId: ب.معرف_البند ?? null,
      createdById: ب.أنشأ,
    },
  });
  await أعد_حساب_رصيد_اللط(tx, ب.معرف_اللط);
  return حركة;
}

/** حذف ناعم لحركة + إعادة حساب اللط */
export async function احذف_حركة_مخزن(tx: عميل_معاملة, معرف_الحركة: number) {
  const ح = await tx.stockMovement.update({
    where: { id: معرف_الحركة },
    data: { deletedAt: new Date() },
    select: { lotId: true },
  });
  await أعد_حساب_رصيد_اللط(tx, ح.lotId);
}

/** عكس كل حركات فاتورة (عند التعديل أو الحذف) */
export async function اعكس_حركات_الفاتورة(tx: عميل_معاملة, معرف_الفاتورة: number) {
  const حركات = await tx.stockMovement.findMany({
    where: { invoiceId: معرف_الفاتورة, deletedAt: null },
    select: { id: true, lotId: true },
  });
  if (!حركات.length) return [];
  await tx.stockMovement.updateMany({
    where: { id: { in: حركات.map((h) => h.id) } },
    data: { deletedAt: new Date() },
  });
  for (const معرف of [...new Set(حركات.map((h) => h.lotId))]) {
    await أعد_حساب_رصيد_اللط(tx, معرف);
  }
  return حركات;
}

/**
 * هل يمكن حذف/تعديل فاتورة أثّرت على المخزون؟
 * القاعدة: يُسمح فقط لو اللطات اللي دخلت منها لسه ما اتصرفش منها حاجة
 * (رصيد اللط = الكمية الواردة كاملة). غير كده يُمنع ويُطلب مرتجع/تسوية.
 */
export async function افحص_إمكانية_عكس_الوارد(
  tx: عميل_معاملة,
  معرف_الفاتورة: number
): Promise<{ مسموح: boolean; سبب?: string }> {
  const وارد = await tx.stockMovement.findMany({
    where: { invoiceId: معرف_الفاتورة, deletedAt: null, kind: { in: ["PURCHASE_IN", "CUSTOMER_RETURN_IN"] } },
    select: { lotId: true, qty: true },
  });
  for (const ح of وارد) {
    const ل = await tx.lot.findUnique({ where: { id: ح.lotId }, select: { qty: true, lotNo: true, category: true, color: true } });
    if (!ل) continue;
    if (د(ل.qty).lessThan(د(ح.qty))) {
      return {
        مسموح: false,
        سبب: `اللط ${ل.lotNo} (${ل.category} — ${ل.color}) اتصرف منه بالفعل — سجّل مرتجعاً أو تسوية بدل الحذف`,
      };
    }
  }
  return { مسموح: true };
}

/** رقم لط تلقائي: مرجع المورد إن وُجد، وإلا تسلسل شهري واضح */
export async function ولّد_رقم_لط(
  tx: عميل_معاملة,
  خيارات: { مرجع?: string | null; التاريخ: Date }
): Promise<string> {
  const أساس = خيارات.مرجع?.trim();
  if (أساس) return أساس;
  const س = خيارات.التاريخ.getFullYear();
  const ش = String(خيارات.التاريخ.getMonth() + 1).padStart(2, "0");
  const بادئة = `L${س}${ش}-`;
  const آخر = await tx.lot.findFirst({
    where: { lotNo: { startsWith: بادئة } },
    orderBy: { lotNo: "desc" },
    select: { lotNo: true },
  });
  const تسلسل = آخر ? Number(آخر.lotNo.slice(بادئة.length)) + 1 : 1;
  return `${بادئة}${String(تسلسل).padStart(3, "0")}`;
}

/**
 * اللطات المتاحة لصنف/لون معيّن — مرتبة FIFO (الأقدم استلاماً أولاً).
 * تُستخدم في نموذج البيع لعرض المتاح واقتراح اللط.
 */
export async function اللطات_المتاحة(
  التصنيف: string,
  اللون: string,
  الشركة: string | null = null,
  p: PrismaClient = عميل_افتراضي
) {
  const لطات = await p.lot.findMany({
    where: {
      category: التصنيف, color: اللون, qty: { gt: 0 },
      ...(الشركة ? { company: الشركة } : {}),
    },
    orderBy: [{ receivedAt: "asc" }, { id: "asc" }],
    select: { id: true, lotNo: true, qty: true, weight: true, receivedAt: true, company: true, supplier: { select: { name: true } } },
  });
  return لطات.map((ل) => ({
    id: ل.id,
    رقم_اللط: ل.lotNo,
    الكمية: Number(ل.qty),
    الوزن: Number(ل.weight),
    الشركة: ل.company,
    المورد: ل.supplier?.name ?? null,
    تاريخ_الاستلام: ل.receivedAt.toISOString(),
  }));
}

/** أرصدة المخزن مرتّبة هرمياً: شركة ← تصنيف ← لون ← لطات (لشاشة المخزن) */
export type لط_رصيد = {
  id: number; رقم_اللط: string; الكمية: number; الوزن: number;
  تاريخ_الاستلام: string; المورد: string | null;
};
export type لون_رصيد = {
  اللون: string; الكمية: number; الوزن: number; عدد_اللطات: number;
  الحد_الأدنى_كمية: number; تحت_الحد_الأدنى: boolean; اللطات: لط_رصيد[];
};
export type صنف_رصيد = {
  التصنيف: string; الكمية: number; الوزن: number; عدد_اللطات: number; الألوان: لون_رصيد[];
};
export type شركة_رصيد = {
  الشركة: string; الكمية: number; الوزن: number; عدد_اللطات: number;
  تحت_الحد_الأدنى: number; الأصناف: صنف_رصيد[];
};

export async function اجلب_أرصدة_المخزن(
  بحث?: string | null,
  p: PrismaClient = عميل_افتراضي
): Promise<شركة_رصيد[]> {
  const ن = بحث?.trim();
  const لطات = await p.lot.findMany({
    where: ن
      ? {
          OR: [
            { category: { contains: ن, mode: "insensitive" } },
            { color: { contains: ن, mode: "insensitive" } },
            { lotNo: { contains: ن, mode: "insensitive" } },
            { company: { contains: ن, mode: "insensitive" } },
            { supplier: { name: { contains: ن, mode: "insensitive" } } },
            { movements: { some: { invoice: { externalRef: { contains: ن, mode: "insensitive" } } } } },
          ],
        }
      : undefined,
    orderBy: [{ company: "asc" }, { category: "asc" }, { color: "asc" }, { receivedAt: "asc" }],
    select: {
      id: true, lotNo: true, category: true, color: true, company: true,
      qty: true, weight: true, receivedAt: true, supplier: { select: { name: true } },
    },
  });

  const حدود = await p.stockMinimum.findMany();
  const حد = (تصنيف: string, لون: string) => {
    const دقيق = حدود.find((h) => h.category === تصنيف && h.color === لون);
    const عام = حدود.find((h) => h.category === تصنيف && h.color === null);
    return Number((دقيق ?? عام)?.minQty ?? 0);
  };

  type م_لون = لون_رصيد;
  type م_صنف = { التصنيف: string; الكمية: number; الوزن: number; عدد_اللطات: number; ألوان: Map<string, م_لون> };
  type م_شركة = { الشركة: string; الكمية: number; الوزن: number; عدد_اللطات: number; أصناف: Map<string, م_صنف> };
  const شركات = new Map<string, م_شركة>();

  for (const ل of لطات) {
    const اسم_الشركة = ل.company?.trim() || "بدون شركة";
    const ش = شركات.get(اسم_الشركة) ?? { الشركة: اسم_الشركة, الكمية: 0, الوزن: 0, عدد_اللطات: 0, أصناف: new Map() };
    const ص = ش.أصناف.get(ل.category) ?? { التصنيف: ل.category, الكمية: 0, الوزن: 0, عدد_اللطات: 0, ألوان: new Map() };
    const لون = ص.ألوان.get(ل.color) ?? {
      اللون: ل.color, الكمية: 0, الوزن: 0, عدد_اللطات: 0,
      الحد_الأدنى_كمية: حد(ل.category, ل.color), تحت_الحد_الأدنى: false, اللطات: [],
    };

    const كمية = Number(ل.qty), وزن = Number(ل.weight);
    لون.الكمية += كمية; لون.الوزن += وزن;
    ص.الكمية += كمية;  ص.الوزن += وزن;
    ش.الكمية += كمية;  ش.الوزن += وزن;
    if (كمية > 0) { لون.عدد_اللطات++; ص.عدد_اللطات++; ش.عدد_اللطات++; }
    لون.اللطات.push({
      id: ل.id, رقم_اللط: ل.lotNo, الكمية: كمية, الوزن: وزن,
      تاريخ_الاستلام: ل.receivedAt.toISOString(), المورد: ل.supplier?.name ?? null,
    });

    ص.ألوان.set(ل.color, لون);
    ش.أصناف.set(ل.category, ص);
    شركات.set(اسم_الشركة, ش);
  }

  return [...شركات.values()].map((ش) => {
    const أصناف = [...ش.أصناف.values()].map((ص) => ({
      التصنيف: ص.التصنيف, الكمية: ص.الكمية, الوزن: ص.الوزن, عدد_اللطات: ص.عدد_اللطات,
      الألوان: [...ص.ألوان.values()].map((ل) => ({
        ...ل,
        تحت_الحد_الأدنى: ل.الحد_الأدنى_كمية > 0 && ل.الكمية <= ل.الحد_الأدنى_كمية,
      })),
    }));
    return {
      الشركة: ش.الشركة, الكمية: ش.الكمية, الوزن: ش.الوزن, عدد_اللطات: ش.عدد_اللطات,
      تحت_الحد_الأدنى: أصناف.reduce((س, ص) => س + ص.الألوان.filter((ل) => ل.تحت_الحد_الأدنى).length, 0),
      الأصناف: أصناف,
    };
  });
}
