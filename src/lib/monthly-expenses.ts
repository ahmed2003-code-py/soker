import type { Prisma, PrismaClient } from "@prisma/client";
import { prisma as عميل_افتراضي } from "@/lib/prisma";
import { د, جمع, طرح } from "@/lib/decimal";

/**
 * المصروفات الشهرية: بنود متكررة (إيجار/كهربا/مرتبات…) لكل واحد مبلغ مقرر شهرياً.
 *
 * قاعدة الترحيل: المبلغ المقرر ثابت كل شهر، والفرق بين المتاح والمدفوع في الشهر
 * السابق يترحّل للشهر الجديد:
 *   - دفعت أقل  ⇒ مرحَّل موجب (فائض يزيد متاح الشهر الجديد)
 *   - دفعت أكتر ⇒ مرحَّل سالب (تجاوز يستهلك من رصيد الشهر الجديد ويظهر في البروجريس)
 *
 *   المتاح = المقرر + المرحَّل      المتبقي = المتاح − المدفوع
 *   المدفوع = مجموع حركات الخزنة (مصروف) المرتبطة بالبند في شهره.
 */

export type شهر = { سنة: number; شهر: number };

export const أسماء_الشهور = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
] as const;

/** شهر اليوم بتوقيت القاهرة */
export function شهر_اليوم(): شهر {
  const الآن = new Date(new Date().toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
  return { سنة: الآن.getFullYear(), شهر: الآن.getMonth() + 1 };
}

export function الشهر_السابق(س: شهر): شهر {
  return س.شهر === 1 ? { سنة: س.سنة - 1, شهر: 12 } : { سنة: س.سنة, شهر: س.شهر - 1 };
}

export function الشهر_التالي(س: شهر): شهر {
  return س.شهر === 12 ? { سنة: س.سنة + 1, شهر: 1 } : { سنة: س.سنة, شهر: س.شهر + 1 };
}

export function تسمية_الشهر(س: شهر): string {
  return `${أسماء_الشهور[س.شهر - 1]} ${س.سنة}`;
}

/** التحقق من صلاحية الشهر القادم من الرابط (مع رجوع لشهر اليوم) */
export function حلّل_الشهر(سنة?: string | null, شهر?: string | null): شهر {
  const y = Number(سنة), m = Number(شهر);
  if (Number.isInteger(y) && y >= 2000 && y <= 2999 && Number.isInteger(m) && m >= 1 && m <= 12) {
    return { سنة: y, شهر: m };
  }
  return شهر_اليوم();
}

/** مجموع المدفوع لكل بند شهر (حركات خزنة غير محذوفة) */
async function مدفوعات_البنود(
  p: PrismaClient,
  معرفات: number[]
): Promise<Map<number, { مدفوع: Prisma.Decimal; عدد: number }>> {
  const خريطة = new Map<number, { مدفوع: Prisma.Decimal; عدد: number }>();
  if (!معرفات.length) return خريطة;
  const صفوف = await p.treasuryTxn.groupBy({
    by: ["monthlyExpensePeriodId"],
    where: { monthlyExpensePeriodId: { in: معرفات }, deletedAt: null },
    _sum: { amount: true },
    _count: { _all: true },
  });
  for (const ص of صفوف) {
    if (ص.monthlyExpensePeriodId == null) continue;
    خريطة.set(ص.monthlyExpensePeriodId, { مدفوع: د(ص._sum.amount ?? 0), عدد: ص._count._all });
  }
  return خريطة;
}

/**
 * يضمن وجود بنود الشهر المطلوب:
 *  - يولّد بند شهر لكل بند نشط ليس له بند في هذا الشهر (بالمبلغ الافتراضي)
 *  - يحدّث «المرحَّل» من متبقي الشهر السابق (يعاد حسابه دائماً ليظل مطابقاً للواقع)
 * آمن للتكرار (idempotent).
 */
export async function اضمن_بنود_الشهر(س: شهر, أنشأ: number, p: PrismaClient = عميل_افتراضي) {
  const [بنود, حالية, سابقة] = await Promise.all([
    p.monthlyExpenseItem.findMany({ where: { active: true }, select: { id: true, defaultAmount: true } }),
    p.monthlyExpensePeriod.findMany({ where: { year: س.سنة, month: س.شهر } }),
    (async () => {
      const ق = الشهر_السابق(س);
      return p.monthlyExpensePeriod.findMany({ where: { year: ق.سنة, month: ق.شهر } });
    })(),
  ]);

  const مدفوع_السابق = await مدفوعات_البنود(p, سابقة.map((x) => x.id));
  // متبقي الشهر السابق لكل بند = (المقرر + المرحَّل) − المدفوع
  const مرحَّل = new Map<number, Prisma.Decimal>();
  for (const ق of سابقة) {
    const مدفوع = مدفوع_السابق.get(ق.id)?.مدفوع ?? د(0);
    مرحَّل.set(ق.itemId, طرح(جمع(ق.amount, ق.carriedIn), مدفوع));
  }

  const موجود = new Map(حالية.map((x) => [x.itemId, x]));
  const عمليات: Prisma.PrismaPromise<unknown>[] = [];
  for (const بند of بنود) {
    const مرحَّل_البند = مرحَّل.get(بند.id) ?? د(0);
    const ح = موجود.get(بند.id);
    if (!ح) {
      عمليات.push(
        p.monthlyExpensePeriod.create({
          data: {
            itemId: بند.id, year: س.سنة, month: س.شهر,
            amount: بند.defaultAmount, carriedIn: مرحَّل_البند, createdById: أنشأ,
          },
        })
      );
    } else if (!د(ح.carriedIn).equals(مرحَّل_البند)) {
      // الشهر السابق اتعدّل بعد التوليد ⇒ حدّث المرحَّل ليظل مطابقاً
      عمليات.push(
        p.monthlyExpensePeriod.update({ where: { id: ح.id }, data: { carriedIn: مرحَّل_البند } })
      );
    }
  }
  // كذلك بنود شهر لبنود اتوقفت لاحقاً: تفضل كما هي (تاريخية) بلا تغيير
  if (عمليات.length) await p.$transaction(عمليات);
}

export type بند_شهر_محسوب = {
  معرف: number;           // معرّف بند الشهر
  معرف_البند: number;     // معرّف البند المتكرر
  الاسم: string;
  نشط: boolean;
  المقرر: number;
  المرحّل: number;        // + فائض / − تجاوز من الشهر السابق
  المتاح: number;         // المقرر + المرحّل
  المدفوع: number;
  المتبقي: number;        // المتاح − المدفوع (سالب = تجاوز)
  عدد_الحركات: number;
  ملاحظات: string | null;
};

/** بنود شهر مع كل الأرقام المحسوبة (يضمن التوليد أولاً) */
export async function اجلب_بنود_الشهر(
  س: شهر,
  أنشأ: number,
  p: PrismaClient = عميل_افتراضي
): Promise<بند_شهر_محسوب[]> {
  await اضمن_بنود_الشهر(س, أنشأ, p);
  const صفوف = await p.monthlyExpensePeriod.findMany({
    where: { year: س.سنة, month: س.شهر },
    include: { item: { select: { id: true, name: true, active: true } } },
    orderBy: { id: "asc" },
  });
  const مدفوع = await مدفوعات_البنود(p, صفوف.map((x) => x.id));
  return صفوف
    .map((ص) => {
      const م = مدفوع.get(ص.id) ?? { مدفوع: د(0), عدد: 0 };
      const متاح = جمع(ص.amount, ص.carriedIn);
      return {
        معرف: ص.id,
        معرف_البند: ص.item.id,
        الاسم: ص.item.name,
        نشط: ص.item.active,
        المقرر: Number(ص.amount),
        المرحّل: Number(ص.carriedIn),
        المتاح: Number(متاح),
        المدفوع: Number(م.مدفوع),
        المتبقي: Number(طرح(متاح, م.مدفوع)),
        عدد_الحركات: م.عدد,
        ملاحظات: ص.notes,
      };
    })
    // البنود الموقوفة تظهر فقط لو عليها حركة في هذا الشهر
    .filter((ص) => ص.نشط || ص.عدد_الحركات > 0);
}

/** المتبقي في بند شهر بعينه (لفحص التجاوز عند تسجيل حركة خزنة) */
export async function متبقي_بند_الشهر(
  معرف_بند_الشهر: number,
  استثنِ_حركة: number | null = null,
  p: PrismaClient = عميل_افتراضي
): Promise<{ الاسم: string; المقرر: number; المرحّل: number; المتاح: number; المدفوع: number; المتبقي: number } | null> {
  const بند = await p.monthlyExpensePeriod.findUnique({
    where: { id: معرف_بند_الشهر },
    include: { item: { select: { name: true } } },
  });
  if (!بند) return null;
  const مجموع = await p.treasuryTxn.aggregate({
    where: {
      monthlyExpensePeriodId: معرف_بند_الشهر,
      deletedAt: null,
      ...(استثنِ_حركة ? { id: { not: استثنِ_حركة } } : {}),
    },
    _sum: { amount: true },
  });
  const متاح = جمع(بند.amount, بند.carriedIn);
  const مدفوع = د(مجموع._sum.amount ?? 0);
  return {
    الاسم: بند.item.name,
    المقرر: Number(بند.amount),
    المرحّل: Number(بند.carriedIn),
    المتاح: Number(متاح),
    المدفوع: Number(مدفوع),
    المتبقي: Number(طرح(متاح, مدفوع)),
  };
}
