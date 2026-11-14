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

/** ترقيم الشهر كرقم متصل (سنة×12 + شهر−1) لتسهيل المقارنة والتكرار */
const رقم_الشهر = (س: شهر) => س.سنة * 12 + (س.شهر - 1);
const شهر_من_رقم = (ر: number): شهر => ({ سنة: Math.floor(ر / 12), شهر: (ر % 12) + 1 });

/** شهر تاريخ معيّن بتوقيت القاهرة */
function شهر_التاريخ(ت: Date): شهر {
  const ق = new Date(ت.toLocaleString("en-US", { timeZone: "Africa/Cairo" }));
  return { سنة: ق.getFullYear(), شهر: ق.getMonth() + 1 };
}

/** أقصى مدى للتوليد في المستقبل (حماية من توليد آلاف الشهور لو اتفتح رابط لسنة بعيدة) */
const أقصى_شهور_مستقبلية = 12;

/**
 * يضمن وجود بنود الشهر المطلوب ويعيد بناء سلسلة «المرحَّل» لكل بند.
 *
 * قواعد:
 *  - بداية البند = أول شهر اتعمل له (بند الشهر اللي اتولّد مع إضافة البند).
 *    **ممنوع** توليد بند شهر قبل بداية البند — فتح شهر قديم في الواجهة ما يعملش
 *    شهور وهمية غير مدفوعة تترحّل بعدين كمديونية (ده كان سبب باج الترحيل الكبير).
 *  - البند النشط يتولّد له كل شهر من بعد آخر شهر موجود لحد الشهر المطلوب
 *    (فتح شهر بعد فجوة ما يضيّعش مقرر الشهور اللي في النص).
 *  - المرحَّل لكل شهر = متبقي آخر شهر قبله لنفس البند، ويُعاد حسابه للسلسلة كلها
 *    بالترتيب الزمني (مش الشهر السابق بس) ⇒ أي تعديل قديم يوصل لآخر السلسلة.
 * آمن للتكرار (idempotent).
 */
export async function اضمن_بنود_الشهر(س: شهر, أنشأ: number, p: PrismaClient = عميل_افتراضي) {
  const الهدف = Math.min(رقم_الشهر(س), رقم_الشهر(شهر_اليوم()) + أقصى_شهور_مستقبلية);
  const بنود = await p.monthlyExpenseItem.findMany({
    select: {
      id: true, defaultAmount: true, active: true, createdAt: true,
      periods: { select: { id: true, year: true, month: true, amount: true, carriedIn: true } },
    },
  });
  const مدفوعات = await مدفوعات_البنود(p, بنود.flatMap((ب) => ب.periods.map((x) => x.id)));

  const جديدة: Prisma.MonthlyExpensePeriodCreateManyInput[] = [];
  const تحديثات: Prisma.PrismaPromise<unknown>[] = [];

  for (const بند of بنود) {
    const شهور = [...بند.periods].sort((أ, ب) => رقم_الشهر({ سنة: أ.year, شهر: أ.month }) - رقم_الشهر({ سنة: ب.year, شهر: ب.month }));
    const موجود = new Map(شهور.map((x) => [رقم_الشهر({ سنة: x.year, شهر: x.month }), x]));
    const البداية = شهور.length
      ? رقم_الشهر({ سنة: شهور[0].year, شهر: شهور[0].month })
      : رقم_الشهر(شهر_التاريخ(بند.createdAt));
    const آخر_موجود = شهور.length ? رقم_الشهر({ سنة: شهور[شهور.length - 1].year, شهر: شهور[شهور.length - 1].month }) : -1;
    const النهاية = Math.max(آخر_موجود, بند.active ? الهدف : -1);
    if (النهاية < البداية) continue; // الشهر المطلوب قبل بداية البند ⇒ لا توليد

    let متبقي_السابق = د(0);
    for (let ر = البداية; ر <= النهاية; ر++) {
      const ح = موجود.get(ر);
      if (ح) {
        if (!د(ح.carriedIn).equals(متبقي_السابق)) {
          تحديثات.push(p.monthlyExpensePeriod.update({ where: { id: ح.id }, data: { carriedIn: متبقي_السابق } }));
        }
        const مدفوع = مدفوعات.get(ح.id)?.مدفوع ?? د(0);
        متبقي_السابق = طرح(جمع(ح.amount, متبقي_السابق), مدفوع);
      } else if (بند.active && ر > آخر_موجود && ر <= الهدف) {
        const س_ر = شهر_من_رقم(ر);
        جديدة.push({
          itemId: بند.id, year: س_ر.سنة, month: س_ر.شهر,
          amount: بند.defaultAmount, carriedIn: متبقي_السابق, createdById: أنشأ,
        });
        متبقي_السابق = جمع(بند.defaultAmount, متبقي_السابق);
      }
      // فجوة لبند كان موقوف: ما تتولّدش، والمتبقي يفضل يترحّل لأول شهر بعدها
    }
  }

  if (!جديدة.length && !تحديثات.length) return;
  await p.$transaction([
    ...(جديدة.length ? [p.monthlyExpensePeriod.createMany({ data: جديدة, skipDuplicates: true })] : []),
    ...تحديثات,
  ]);
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
