import type { Prisma } from "@prisma/client";
import { المخزن_مفعّل } from "@/lib/flags";
import { أضف_حركة_مخزن, اعكس_حركات_الفاتورة, افحص_إمكانية_عكس_الوارد, ولّد_رقم_لط } from "@/lib/stock";

type عميل_معاملة = Prisma.TransactionClient;

/**
 * جسر الفواتير ↔ المخزن. كل الدوال دي **بتخرج فوراً** لو متغير التشغيل مقفول،
 * فالنظام يفضل شغّال بسلوكه القديم بالظبط بلا أي أثر مخزني.
 *
 * القواعد:
 *  - فاتورة شراء وجهتها «المخزن» ⇒ كل بند ينشئ/يزوّد لط (وارد شراء).
 *  - فاتورة بيع ⇒ بند البيع يخصم من لط محدد، وبند المرتجع يرجّع لنفس اللط.
 *  - مرتجع للمورد ⇒ يخرج من اللط.
 *  - الفاتورة المباشرة (مورد ← عميل) ⇒ **لا تمس المخزن** (البضاعة ما دخلتش).
 */

export type بند_مخزني = {
  معرف_البند: number;
  التصنيف: string;
  اللون: string;
  الشركة?: string | null;
  الكمية: Prisma.Decimal.Value;
  الوزن: Prisma.Decimal.Value;
  نوع_البند?: "SALE" | "RETURN";
  معرف_اللط?: number | null;
  رقم_اللط?: string | null;
};

/** ترحيل أثر الفاتورة على المخزن (بعد إنشاء/تحديث بنودها) */
export async function رحّل_مخزن_الفاتورة(
  tx: عميل_معاملة,
  ب: {
    معرف_الفاتورة: number;
    نوع_الفاتورة: string;
    وجهة_البضاعة?: string | null;
    مباشرة?: boolean;
    التاريخ: Date;
    معرف_المورد?: number | null;
    مرجع?: string | null;
    وصف: string;
    البنود: بند_مخزني[];
    أنشأ: number;
  }
): Promise<boolean> {
  if (!(await المخزن_مفعّل(tx))) return false;
  // الفاتورة المباشرة: البضاعة راحت للعميل على طول ⇒ بلا أثر مخزني
  if (ب.مباشرة) return false;

  const شراء = ب.نوع_الفاتورة === "PURCHASE";
  const مرتجع_مورد = ب.نوع_الفاتورة === "SUPPLIER_RETURN";
  // الشراء بلا وجهة محددة يُعتبر «للمخزن» (السلوك الطبيعي)
  if (شراء && (ب.وجهة_البضاعة ?? "WAREHOUSE") !== "WAREHOUSE") return false;

  let أثّرت = false;
  for (const بند of ب.البنود) {
    const كمية = Number(بند.الكمية) || 0;
    const وزن = Number(بند.الوزن) || 0;
    if (كمية <= 0 && وزن <= 0) continue;

    if (شراء) {
      // وارد: ابحث عن اللط أو أنشئه (الصنف × اللون × رقم اللط)
      const رقم = بند.رقم_اللط?.trim() || (await ولّد_رقم_لط(tx, { مرجع: ب.مرجع, التاريخ: ب.التاريخ }));
      let لط = await tx.lot.findFirst({
        where: { category: بند.التصنيف, color: بند.اللون, lotNo: رقم },
        select: { id: true },
      });
      if (!لط) {
        لط = await tx.lot.create({
          data: {
            lotNo: رقم, category: بند.التصنيف, color: بند.اللون, company: بند.الشركة || null,
            receivedAt: ب.التاريخ, supplierId: ب.معرف_المورد ?? null, createdById: ب.أنشأ,
          },
          select: { id: true },
        });
      }
      await أضف_حركة_مخزن(tx, {
        معرف_اللط: لط.id, النوع: "PURCHASE_IN", التاريخ: ب.التاريخ,
        الكمية: كمية, الوزن: وزن, البيان: ب.وصف,
        معرف_الفاتورة: ب.معرف_الفاتورة, معرف_البند: بند.معرف_البند, أنشأ: ب.أنشأ,
      });
      await tx.invoiceLine.update({ where: { id: بند.معرف_البند }, data: { lotId: لط.id } });
      أثّرت = true;
      continue;
    }

    // صادر/مرتجع: لازم لط محدد
    if (!بند.معرف_اللط) {
      throw new Error(`اختر اللط للبند «${بند.اللون} — ${بند.التصنيف}» (المخزن مفعّل)`);
    }
    const نوع = مرتجع_مورد
      ? "SUPPLIER_RETURN_OUT"
      : بند.نوع_البند === "RETURN"
      ? "CUSTOMER_RETURN_IN"
      : "SALE_OUT";
    await أضف_حركة_مخزن(tx, {
      معرف_اللط: بند.معرف_اللط, النوع: نوع, التاريخ: ب.التاريخ,
      الكمية: كمية, الوزن: وزن, البيان: ب.وصف,
      معرف_الفاتورة: ب.معرف_الفاتورة, معرف_البند: بند.معرف_البند, أنشأ: ب.أنشأ,
    });
    await tx.invoiceLine.update({ where: { id: بند.معرف_البند }, data: { lotId: بند.معرف_اللط } });
    أثّرت = true;
  }

  if (أثّرت) {
    await tx.invoice.update({ where: { id: ب.معرف_الفاتورة }, data: { stockPosted: true } });
  }
  return أثّرت;
}

/** عكس أثر الفاتورة على المخزن (قبل إعادة التطبيق أو عند الحذف) */
export async function اعكس_مخزن_الفاتورة(tx: عميل_معاملة, معرف_الفاتورة: number) {
  if (!(await المخزن_مفعّل(tx))) return;
  await اعكس_حركات_الفاتورة(tx, معرف_الفاتورة);
  await tx.invoice.update({ where: { id: معرف_الفاتورة }, data: { stockPosted: false } });
}

/**
 * تحقق قبل تعديل/حذف فاتورة أثّرت على المخزون:
 * ممنوع لو اللط اللي دخل منها اتصرف منه بالفعل (يُطلب مرتجع/تسوية بدلها).
 * يُرجع رسالة الخطأ أو null.
 */
export async function امنع_عكس_غير_آمن(tx: عميل_معاملة, معرف_الفاتورة: number): Promise<string | null> {
  if (!(await المخزن_مفعّل(tx))) return null;
  const ف = await tx.invoice.findUnique({ where: { id: معرف_الفاتورة }, select: { stockPosted: true } });
  if (!ف?.stockPosted) return null;
  const فحص = await افحص_إمكانية_عكس_الوارد(tx, معرف_الفاتورة);
  return فحص.مسموح ? null : (فحص.سبب ?? "لا يمكن التعديل — البضاعة اتصرفت من المخزن");
}
