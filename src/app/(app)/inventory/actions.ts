"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { اطلب_المستخدم } from "@/lib/session";
import { تحقق_الصلاحية } from "@/lib/authz";
import { تسجيل_عملية } from "@/lib/activity";
import { نجح, فشل, type نتيجة } from "@/lib/result";
import { تحليل_تاريخ } from "@/lib/date";
import { تحليل_مبلغ } from "@/lib/money";
import { المخزن_مفعّل } from "@/lib/flags";
import {
  أضف_حركة_مخزن, أعد_حساب_رصيد_اللط, اللطات_المتاحة, اجلب_أرصدة_المخزن,
  تسمية_حركة_المخزن, اتجاه_الحركة, ولّد_رقم_لط,
} from "@/lib/stock";
import { z } from "zod";

/** حارس: كل أكشن مخزني يرفض العمل والمخزن مقفول من الإعدادات */
async function تحقق_التفعيل(): Promise<نتيجة | null> {
  return (await المخزن_مفعّل()) ? null : فشل("المخزن غير مفعّل — فعّله من الإعدادات");
}

const رقم_غير_سالب = z
  .union([z.string(), z.number(), z.literal("")])
  .transform((v) => (v === "" ? "0" : تحليل_مبلغ(v)))
  .refine((v) => v !== null && Number(v) >= 0, { message: "قيمة غير صالحة" });

const مخطط_لط_افتتاحي = z.object({
  التصنيف: z.string().trim().min(1, "الصنف مطلوب"),
  اللون: z.string().trim().min(1, "اللون مطلوب"),
  الشركة: z.string().trim().optional().nullable(),
  رقم_اللط: z.string().trim().optional().nullable(),
  الكمية: رقم_غير_سالب,
  الوزن: رقم_غير_سالب,
  التاريخ: z.string().min(1, "التاريخ مطلوب"),
  معرف_المورد: z.number().int().positive().optional().nullable(),
  ملاحظات: z.string().trim().optional().nullable(),
});

/**
 * جرد افتتاحي: تسجيل رصيد لط موجود فعلياً في المخزن بلا فاتورة.
 * ده أول ما تعمله عند تفعيل المخزن — الفواتير القديمة تفضل بلا أثر مخزني.
 */
export async function سجّل_لط_افتتاحي(مدخلات: unknown): Promise<نتيجة<{ id: number }>> {
  const مقفول = await تحقق_التفعيل();
  if (مقفول) return مقفول;
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_لط_افتتاحي.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  if (Number(ب.الكمية) <= 0 && Number(ب.الوزن) <= 0) return فشل("أدخل كمية أو وزناً أكبر من صفر");
  const تاريخ = تحليل_تاريخ(ب.التاريخ) ?? new Date();

  try {
    const لط = await prisma.$transaction(async (tx) => {
      const رقم = ب.رقم_اللط?.trim() || (await ولّد_رقم_لط(tx, { التاريخ: تاريخ }));
      const موجود = await tx.lot.findFirst({
        where: { category: ب.التصنيف, color: ب.اللون, lotNo: رقم }, select: { id: true },
      });
      if (موجود) throw new Error(`اللط ${رقم} موجود بالفعل لنفس الصنف واللون`);
      const l = await tx.lot.create({
        data: {
          lotNo: رقم, category: ب.التصنيف, color: ب.اللون, company: ب.الشركة || null,
          receivedAt: تاريخ, supplierId: ب.معرف_المورد ?? null, notes: ب.ملاحظات || null,
          createdById: فاعل.id,
        },
      });
      await أضف_حركة_مخزن(tx, {
        معرف_اللط: l.id, النوع: "OPENING", التاريخ: تاريخ,
        الكمية: ب.الكمية!, الوزن: ب.الوزن!, البيان: "جرد افتتاحي", أنشأ: فاعل.id,
      });
      await تسجيل_عملية(tx, {
        المستخدم: فاعل.id, العملية: "CREATE", نوع_الكيان: "المخزن", معرف_الكيان: l.id,
        التفاصيل: { جرد_افتتاحي: true, اللط: رقم, الصنف: ب.التصنيف, اللون: ب.اللون, الكمية: ب.الكمية, الوزن: ب.الوزن },
      });
      return l;
    });
    revalidatePath("/inventory");
    return نجح({ id: لط.id }, `تم تسجيل اللط ${لط.lotNo} برصيد افتتاحي`);
  } catch (e) {
    return فشل(e instanceof Error ? e.message : "خطأ أثناء تسجيل اللط");
  }
}

const مخطط_تسوية = z.object({
  معرف_اللط: z.number().int().positive(),
  الاتجاه: z.enum(["زيادة", "عجز"]),
  الكمية: رقم_غير_سالب,
  الوزن: رقم_غير_سالب,
  التاريخ: z.string().min(1, "التاريخ مطلوب"),
  السبب: z.string().trim().min(1, "اكتب سبب التسوية"),
});

/** تسوية جرد على لط (زيادة أو عجز) — بسبب إجباري للمساءلة */
export async function سجّل_تسوية_لط(مدخلات: unknown): Promise<نتيجة> {
  const مقفول = await تحقق_التفعيل();
  if (مقفول) return مقفول;
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_تسوية.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  const تاريخ = تحليل_تاريخ(ب.التاريخ) ?? new Date();
  const عجز = ب.الاتجاه === "عجز";

  try {
    await prisma.$transaction(async (tx) => {
      const لط = await tx.lot.findUniqueOrThrow({ where: { id: ب.معرف_اللط } });
      if (عجز) {
        // العجز يُسجَّل كصرف بحد أقصى الرصيد المتاح
        await أضف_حركة_مخزن(tx, {
          معرف_اللط: ب.معرف_اللط, النوع: "SALE_OUT", التاريخ: تاريخ,
          الكمية: ب.الكمية!, الوزن: ب.الوزن!, البيان: `تسوية عجز — ${ب.السبب}`, أنشأ: فاعل.id,
        });
      } else {
        await أضف_حركة_مخزن(tx, {
          معرف_اللط: ب.معرف_اللط, النوع: "ADJUST", التاريخ: تاريخ,
          الكمية: ب.الكمية!, الوزن: ب.الوزن!, البيان: `تسوية زيادة — ${ب.السبب}`, أنشأ: فاعل.id,
        });
      }
      await تسجيل_عملية(tx, {
        المستخدم: فاعل.id, العملية: "UPDATE", نوع_الكيان: "المخزن", معرف_الكيان: ب.معرف_اللط,
        التفاصيل: { تسوية: ب.الاتجاه, اللط: لط.lotNo, الكمية: ب.الكمية, الوزن: ب.الوزن, السبب: ب.السبب },
      });
    });
    revalidatePath("/inventory");
    return نجح(undefined, "تم تسجيل التسوية");
  } catch (e) {
    return فشل(e instanceof Error ? e.message : "خطأ أثناء التسوية");
  }
}

/** ضبط الحد الأدنى لصنف (ولون اختياري) */
export async function اضبط_الحد_الأدنى(مدخلات: {
  التصنيف: string; اللون?: string | null; الكمية: string | number; الوزن?: string | number;
}): Promise<نتيجة> {
  const مقفول = await تحقق_التفعيل();
  if (مقفول) return مقفول;
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const تصنيف = مدخلات.التصنيف?.trim();
  if (!تصنيف) return فشل("الصنف مطلوب");
  const كمية = تحليل_مبلغ(مدخلات.الكمية) ?? "0";
  const وزن = تحليل_مبلغ(مدخلات.الوزن ?? 0) ?? "0";
  const لون = مدخلات.اللون?.trim() || null;

  // ملاحظة: المفتاح المركّب (category, color) ما ينفعش يُستخدم في upsert لما اللون null،
  // فبنبحث الأول ثم نضيف أو نعدّل (الحد على مستوى الصنف كله = لون null).
  const موجود = await prisma.stockMinimum.findFirst({ where: { category: تصنيف, color: لون } });
  if (موجود) {
    await prisma.stockMinimum.update({ where: { id: موجود.id }, data: { minQty: كمية, minWeight: وزن } });
  } else {
    await prisma.stockMinimum.create({
      data: { category: تصنيف, color: لون, minQty: كمية, minWeight: وزن, createdById: فاعل.id },
    });
  }
  revalidatePath("/inventory");
  return نجح(undefined, "تم ضبط الحد الأدنى");
}

const مخطط_تعديل_لط = z.object({
  رقم_اللط: z.string().trim().min(1, "رقم اللط مطلوب"),
  التصنيف: z.string().trim().min(1, "الصنف مطلوب"),
  اللون: z.string().trim().min(1, "اللون مطلوب"),
  الشركة: z.string().trim().optional().nullable(),
  معرف_المورد: z.number().int().positive().optional().nullable(),
  التاريخ: z.string().min(1, "تاريخ الاستلام مطلوب"),
  ملاحظات: z.string().trim().optional().nullable(),
});

/**
 * تعديل بيانات اللط (رقمه/صنفه/لونه/شركته/مورده/تاريخه).
 * الأرصدة ما تتعدلش من هنا — الفروق بتتسجّل بـ«تسوية» عشان تفضل في الكشف.
 */
export async function عدّل_لط(id: number, مدخلات: unknown): Promise<نتيجة> {
  const مقفول = await تحقق_التفعيل();
  if (مقفول) return مقفول;
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_تعديل_لط.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  const حالي = await prisma.lot.findUnique({ where: { id } });
  if (!حالي) return فشل("اللط غير موجود");
  const تاريخ = تحليل_تاريخ(ب.التاريخ) ?? حالي.receivedAt;

  const مكرر = await prisma.lot.findFirst({
    where: { category: ب.التصنيف, color: ب.اللون, lotNo: ب.رقم_اللط, id: { not: id } },
    select: { id: true },
  });
  if (مكرر) return فشل(`فيه لط بنفس الرقم ${ب.رقم_اللط} لنفس الصنف واللون`);

  await prisma.$transaction(async (tx) => {
    await tx.lot.update({
      where: { id },
      data: {
        lotNo: ب.رقم_اللط, category: ب.التصنيف, color: ب.اللون,
        company: ب.الشركة || null, supplierId: ب.معرف_المورد ?? null,
        receivedAt: تاريخ, notes: ب.ملاحظات || null,
      },
    });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id, العملية: "UPDATE", نوع_الكيان: "المخزن", معرف_الكيان: id,
      التفاصيل: {
        قبل: { اللط: حالي.lotNo, الصنف: حالي.category, اللون: حالي.color, الشركة: حالي.company },
        بعد: { اللط: ب.رقم_اللط, الصنف: ب.التصنيف, اللون: ب.اللون, الشركة: ب.الشركة },
      },
    });
  });
  revalidatePath("/inventory");
  return نجح(undefined, "تم تعديل بيانات اللط");
}

/**
 * حذف لط — مسموح فقط لو ما اتصرفش منه حاجة ومش جاي من فاتورة.
 * غير كده بيُطلب مرتجع أو تسوية عشان تاريخ المخزن يفضل سليم.
 */
export async function احذف_لط(id: number): Promise<نتيجة> {
  const مقفول = await تحقق_التفعيل();
  if (مقفول) return مقفول;
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "حذف");
  const لط = await prisma.lot.findUnique({
    where: { id },
    include: { movements: { where: { deletedAt: null }, select: { kind: true, invoiceId: true } } },
  });
  if (!لط) return فشل("اللط غير موجود");

  if (لط.movements.some((ح) => ح.invoiceId != null)) {
    return فشل("اللط ده جاي من فاتورة — عدّل الفاتورة نفسها بدل حذف اللط");
  }
  if (لط.movements.some((ح) => ح.kind === "SALE_OUT" || ح.kind === "SUPPLIER_RETURN_OUT")) {
    return فشل(`اللط ${لط.lotNo} اتصرف منه بالفعل — سجّل تسوية بدل الحذف`);
  }

  await prisma.$transaction(async (tx) => {
    await tx.lot.delete({ where: { id } }); // الحركات Cascade
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id, العملية: "DELETE", نوع_الكيان: "المخزن", معرف_الكيان: id,
      التفاصيل: { اللط: لط.lotNo, الصنف: لط.category, اللون: لط.color, الكمية: لط.qty.toString() },
    });
  });
  revalidatePath("/inventory");
  return نجح(undefined, `تم حذف اللط ${لط.lotNo}`);
}

/** اللطات المتاحة لصنف/لون (لنموذج البيع — مرتبة FIFO) */
export async function اجلب_لطات_متاحة(التصنيف: string, اللون: string, الشركة?: string | null) {
  if (!(await المخزن_مفعّل())) return [];
  await اطلب_المستخدم();
  if (!التصنيف?.trim() || !اللون?.trim()) return [];
  const ش = الشركة?.trim();
  return اللطات_المتاحة(التصنيف.trim(), اللون.trim(), ش && ش !== "بدون شركة" ? ش : null);
}

export type لون_مخزن = { اللون: string; الكمية: number; الوزن: number };
export type صنف_مخزن = { التصنيف: string; الكمية: number; الوزن: number; الألوان: لون_مخزن[] };
export type شركة_مخزن = { الشركة: string; الكمية: number; الوزن: number; الأصناف: صنف_مخزن[] };

/**
 * كتالوج المخزن بترتيب الإدخال في الفاتورة: **الشركة ← الصنف ← اللون**.
 * كل مستوى بيعرض المتاح فيه، فالمستخدم ما يقدرش يختار حاجة مش موجودة عنده.
 */
export async function اجلب_أصناف_المخزن(): Promise<شركة_مخزن[]> {
  if (!(await المخزن_مفعّل())) return [];
  await اطلب_المستخدم();
  const لطات = await prisma.lot.findMany({
    where: { qty: { gt: 0 } },
    orderBy: [{ company: "asc" }, { category: "asc" }, { color: "asc" }],
    select: { category: true, color: true, company: true, qty: true, weight: true },
  });

  const شركات = new Map<string, { الشركة: string; الكمية: number; الوزن: number; أصناف: Map<string, { التصنيف: string; الكمية: number; الوزن: number; ألوان: Map<string, لون_مخزن> }> }>();
  for (const ل of لطات) {
    const اسم_الشركة = ل.company?.trim() || "بدون شركة";
    const ش = شركات.get(اسم_الشركة) ?? { الشركة: اسم_الشركة, الكمية: 0, الوزن: 0, أصناف: new Map() };
    ش.الكمية += Number(ل.qty);
    ش.الوزن += Number(ل.weight);

    const ص = ش.أصناف.get(ل.category) ?? { التصنيف: ل.category, الكمية: 0, الوزن: 0, ألوان: new Map() };
    ص.الكمية += Number(ل.qty);
    ص.الوزن += Number(ل.weight);

    const لون = ص.ألوان.get(ل.color) ?? { اللون: ل.color, الكمية: 0, الوزن: 0 };
    لون.الكمية += Number(ل.qty);
    لون.الوزن += Number(ل.weight);

    ص.ألوان.set(ل.color, لون);
    ش.أصناف.set(ل.category, ص);
    شركات.set(اسم_الشركة, ش);
  }

  return [...شركات.values()].map((ش) => ({
    الشركة: ش.الشركة,
    الكمية: ش.الكمية,
    الوزن: ش.الوزن,
    الأصناف: [...ش.أصناف.values()].map((ص) => ({
      التصنيف: ص.التصنيف, الكمية: ص.الكمية, الوزن: ص.الوزن, الألوان: [...ص.ألوان.values()],
    })),
  }));
}

/** أرصدة المخزن (لشاشة المخزن) */
export async function اجلب_المخزن(بحث?: string | null) {
  if (!(await المخزن_مفعّل())) return [];
  await اطلب_المستخدم();
  return اجلب_أرصدة_المخزن(بحث ?? null);
}

/** كشف حركة لط */
export async function اجلب_كشف_اللط(معرف_اللط: number) {
  if (!(await المخزن_مفعّل())) return null;
  await اطلب_المستخدم();
  const لط = await prisma.lot.findUnique({
    where: { id: معرف_اللط },
    include: { supplier: { select: { name: true } } },
  });
  if (!لط) return null;
  const حركات = await prisma.stockMovement.findMany({
    where: { lotId: معرف_اللط, deletedAt: null },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    include: {
      invoice: { select: { id: true, number: true, externalRef: true, customer: { select: { name: true } } } },
      createdBy: { select: { name: true } },
    },
  });
  return {
    id: لط.id,
    رقم_اللط: لط.lotNo,
    التصنيف: لط.category,
    اللون: لط.color,
    الشركة: لط.company,
    المورد: لط.supplier?.name ?? null,
    الكمية: Number(لط.qty),
    الوزن: Number(لط.weight),
    تاريخ_الاستلام: لط.receivedAt.toISOString(),
    الحركات: حركات.map((ح) => ({
      id: ح.id,
      التاريخ: ح.date.toISOString(),
      النوع: تسمية_حركة_المخزن[ح.kind],
      وارد: اتجاه_الحركة(ح.kind) === 1,
      الكمية: Number(ح.qty),
      الوزن: Number(ح.weight),
      رصيد_الكمية: Number(ح.balanceAfterQty),
      رصيد_الوزن: Number(ح.balanceAfterWeight),
      البيان: ح.description,
      معرف_الفاتورة: ح.invoice?.id ?? null,
      رقم_الفاتورة: ح.invoice?.number ? String(ح.invoice.number).padStart(7, "0") : (ح.invoice?.externalRef ?? null),
      الطرف: ح.invoice?.customer?.name ?? null,
      بواسطة: ح.createdBy.name,
    })),
  };
}

/** إعادة حساب أرصدة كل اللطات (صيانة) */
export async function أعد_حساب_المخزن(): Promise<نتيجة> {
  const مقفول = await تحقق_التفعيل();
  if (مقفول) return مقفول;
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const لطات = await prisma.lot.findMany({ select: { id: true } });
  await prisma.$transaction(async (tx) => {
    for (const ل of لطات) await أعد_حساب_رصيد_اللط(tx, ل.id);
  }, { timeout: 60000 });
  void فاعل;
  revalidatePath("/inventory");
  return نجح(undefined, `تمت إعادة حساب ${لطات.length} لط`);
}
