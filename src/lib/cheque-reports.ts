import { prisma } from "@/lib/prisma";
import { د } from "@/lib/decimal";
import { اليوم } from "@/lib/date";
import { تسمية_حالة_الشيك } from "@/lib/enums";
import type { ChequeStatus, ChequeDirection, Prisma } from "@prisma/client";

/** فلاتر تقرير الشيكات (كلها اختيارية). */
export type فلاتر_تقرير_شيكات = {
  من?: Date;
  إلى?: Date;
  الاتجاه?: ChequeDirection;
  الحالة?: ChequeStatus;
  معرف_الطرف?: number;
  اسم_البنك?: string;
};

/** فرق الأيام بين تاريخين (يوم كامل). */
function فرق_أيام(أ: Date, ب: Date): number {
  const يوم = 24 * 60 * 60 * 1000;
  const a = Date.UTC(أ.getFullYear(), أ.getMonth(), أ.getDate());
  const b = Date.UTC(ب.getFullYear(), ب.getMonth(), ب.getDate());
  return Math.round((a - b) / يوم);
}

const مفاتيح_الأعمار = [
  { المفتاح: "قادمة", التسمية: "قادمة (> 7 أيام)" },
  { المفتاح: "خلال_7", التسمية: "مستحقة خلال 7 أيام" },
  { المفتاح: "متأخر_1_30", التسمية: "متأخرة 1-30 يوم" },
  { المفتاح: "متأخر_31_60", التسمية: "متأخرة 31-60 يوم" },
  { المفتاح: "متأخر_61_90", التسمية: "متأخرة 61-90 يوم" },
  { المفتاح: "متأخر_90", التسمية: "متأخرة أكثر من 90 يوم" },
] as const;

type مفتاح_عمر = (typeof مفاتيح_الأعمار)[number]["المفتاح"];

/** تصنيف شيك «تحت التحصيل» في شريحة عمرية حسب استحقاقه مقارنةً باليوم. */
export function شريحة_العمر(تاريخ_الاستحقاق: Date, الآن: Date): مفتاح_عمر {
  const فرق = فرق_أيام(تاريخ_الاستحقاق, الآن); // موجب = مستقبلي، سالب = متأخر
  if (فرق > 7) return "قادمة";
  if (فرق >= 0) return "خلال_7";
  const تأخير = -فرق;
  if (تأخير <= 30) return "متأخر_1_30";
  if (تأخير <= 60) return "متأخر_31_60";
  if (تأخير <= 90) return "متأخر_61_90";
  return "متأخر_90";
}

/** التقرير الشامل: ملخص بالحالة + أعمار + حسب البنك + حسب الطرف + صفوف تفصيلية. */
export async function تقرير_الشيكات(فلاتر: فلاتر_تقرير_شيكات = {}) {
  const where: Prisma.ChequeWhereInput = {};
  if (فلاتر.الاتجاه) where.direction = فلاتر.الاتجاه;
  if (فلاتر.الحالة) where.status = فلاتر.الحالة;
  if (فلاتر.معرف_الطرف) where.partyId = فلاتر.معرف_الطرف;
  if (فلاتر.اسم_البنك) where.bankName = { contains: فلاتر.اسم_البنك, mode: "insensitive" };
  if (فلاتر.من || فلاتر.إلى) {
    where.dueDate = {};
    if (فلاتر.من) where.dueDate.gte = فلاتر.من;
    if (فلاتر.إلى) where.dueDate.lte = فلاتر.إلى;
  }

  const شيكات = await prisma.cheque.findMany({
    where,
    orderBy: { dueDate: "asc" },
    select: {
      id: true, chequeNumber: true, drawerName: true, beneficiary: true, bankName: true,
      amount: true, direction: true, status: true, dueDate: true,
      party: { select: { id: true, name: true } },
    },
  });

  const الآن = اليوم();

  // ── ملخص حسب الحالة ──
  const بالحالة = new Map<ChequeStatus, { عدد: number; إجمالي: ReturnType<typeof د> }>();
  // ── حسب البنك ──
  const بالبنك = new Map<string, { عدد: number; إجمالي: ReturnType<typeof د> }>();
  // ── حسب الطرف ──
  const بالطرف = new Map<string, { الاسم: string; عدد: number; إجمالي: ReturnType<typeof د> }>();
  // ── الأعمار (للشيكات تحت التحصيل فقط — «منتظرة») ──
  const أعمار = new Map<مفتاح_عمر, { عدد: number; إجمالي: ReturnType<typeof د> }>();
  for (const م of مفاتيح_الأعمار) أعمار.set(م.المفتاح, { عدد: 0, إجمالي: د(0) });

  let إجمالي_عام = د(0);
  for (const ش of شيكات) {
    const مبلغ = د(ش.amount);
    إجمالي_عام = إجمالي_عام.plus(مبلغ);

    const ح = بالحالة.get(ش.status) ?? { عدد: 0, إجمالي: د(0) };
    ح.عدد += 1; ح.إجمالي = ح.إجمالي.plus(مبلغ); بالحالة.set(ش.status, ح);

    const مفتاح_بنك = ش.bankName?.trim() || "— بدون بنك —";
    const ب = بالبنك.get(مفتاح_بنك) ?? { عدد: 0, إجمالي: د(0) };
    ب.عدد += 1; ب.إجمالي = ب.إجمالي.plus(مبلغ); بالبنك.set(مفتاح_بنك, ب);

    const مفتاح_طرف = ش.party ? `p${ش.party.id}` : "none";
    const اسم_طرف = ش.party?.name ?? (ش.direction === "OUTGOING" ? ش.beneficiary || ش.drawerName : ش.drawerName) ?? "— غير مربوط —";
    const ط = بالطرف.get(مفتاح_طرف) ?? { الاسم: اسم_طرف, عدد: 0, إجمالي: د(0) };
    ط.عدد += 1; ط.إجمالي = ط.إجمالي.plus(مبلغ); بالطرف.set(مفتاح_طرف, ط);

    if (ش.status === "PENDING") {
      const ش2 = شريحة_العمر(ش.dueDate, الآن);
      const ع = أعمار.get(ش2)!;
      ع.عدد += 1; ع.إجمالي = ع.إجمالي.plus(مبلغ);
    }
  }

  return {
    العدد: شيكات.length,
    الإجمالي: Number(إجمالي_عام),
    الملخص_بالحالة: [...بالحالة.entries()].map(([k, v]) => ({ الحالة: k, التسمية: تسمية_حالة_الشيك[k], عدد: v.عدد, إجمالي: Number(v.إجمالي) })),
    الأعمار: مفاتيح_الأعمار.map((م) => ({ المفتاح: م.المفتاح, التسمية: م.التسمية, عدد: أعمار.get(م.المفتاح)!.عدد, إجمالي: Number(أعمار.get(م.المفتاح)!.إجمالي) })),
    حسب_البنك: [...بالبنك.entries()].map(([الاسم, v]) => ({ الاسم, عدد: v.عدد, إجمالي: Number(v.إجمالي) })).sort((a, b) => b.إجمالي - a.إجمالي),
    حسب_الطرف: [...بالطرف.values()].map((v) => ({ الاسم: v.الاسم, عدد: v.عدد, إجمالي: Number(v.إجمالي) })).sort((a, b) => b.إجمالي - a.إجمالي),
    الصفوف: شيكات.map((ش) => ({
      id: ش.id,
      رقم_الشيك: ش.chequeNumber,
      اسم_البنك: ش.bankName,
      الطرف: ش.party?.name ?? (ش.direction === "OUTGOING" ? ش.beneficiary || ش.drawerName : ش.drawerName),
      الاتجاه: ش.direction,
      الحالة: ش.status,
      تاريخ_الاستحقاق: ش.dueDate.toISOString(),
      المبلغ: Number(ش.amount),
    })),
  };
}

export type بيانات_تقرير_الشيكات = Awaited<ReturnType<typeof تقرير_الشيكات>>;
