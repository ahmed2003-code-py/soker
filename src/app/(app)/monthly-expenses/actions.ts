"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { اطلب_المستخدم } from "@/lib/session";
import { تحقق_الصلاحية } from "@/lib/authz";
import { تسجيل_عملية } from "@/lib/activity";
import { نجح, فشل, type نتيجة } from "@/lib/result";
import { تحليل_مبلغ } from "@/lib/money";
import { د } from "@/lib/decimal";
import {
  شهر_اليوم,
  اجلب_بنود_الشهر,
  اضمن_بنود_الشهر,
  متبقي_بند_الشهر,
  تسمية_الشهر,
  type شهر,
} from "@/lib/monthly-expenses";
import { z } from "zod";

const مبلغ_موجب = z
  .union([z.string(), z.number()])
  .transform((v) => تحليل_مبلغ(v))
  .refine((v) => v !== null && Number(v) > 0, { message: "المبلغ يجب أن يكون أكبر من صفر" });

const مخطط_بند = z.object({
  الاسم: z.string().trim().min(1, "اسم البند مطلوب"),
  المبلغ: مبلغ_موجب,
  ملاحظات: z.string().trim().optional().nullable(),
});

/**
 * إضافة بند مصروف شهري متكرر + توليد بند الشهر المعروض له فوراً.
 * البند بيتكرر تلقائياً كل شهر بنفس المبلغ (وينضاف له المرحَّل من الشهر السابق).
 */
export async function أضف_بند_مصروف(مدخلات: unknown, س?: شهر): Promise<نتيجة<{ id: number }>> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_بند.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  const الشهر = س ?? شهر_اليوم();

  const مكرر = await prisma.monthlyExpenseItem.findFirst({
    where: { name: ب.الاسم, active: true },
    select: { id: true },
  });
  if (مكرر) return فشل(`فيه بند مصروف بنفس الاسم «${ب.الاسم}» بالفعل`);

  const بند = await prisma.$transaction(async (tx) => {
    const i = await tx.monthlyExpenseItem.create({
      data: { name: ب.الاسم, defaultAmount: ب.المبلغ!, notes: ب.ملاحظات || null, createdById: فاعل.id },
    });
    await tx.monthlyExpensePeriod.create({
      data: { itemId: i.id, year: الشهر.سنة, month: الشهر.شهر, amount: ب.المبلغ!, createdById: فاعل.id },
    });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "CREATE",
      نوع_الكيان: "مصروف_شهري",
      معرف_الكيان: i.id,
      التفاصيل: { الاسم: ب.الاسم, المبلغ: ب.المبلغ, الشهر: تسمية_الشهر(الشهر) },
    });
    return i;
  });

  revalidatePath("/monthly-expenses");
  revalidatePath("/treasury");
  return نجح({ id: بند.id }, `تمت إضافة بند «${ب.الاسم}»`);
}

/** تعديل البند المتكرر: الاسم والمبلغ الافتراضي للشهور الجاية */
export async function عدّل_بند_مصروف(id: number, مدخلات: unknown): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_بند.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  const حالي = await prisma.monthlyExpenseItem.findUnique({ where: { id } });
  if (!حالي) return فشل("البند غير موجود");

  await prisma.$transaction(async (tx) => {
    await tx.monthlyExpenseItem.update({
      where: { id },
      data: { name: ب.الاسم, defaultAmount: ب.المبلغ!, notes: ب.ملاحظات || null, updatedById: فاعل.id },
    });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "UPDATE",
      نوع_الكيان: "مصروف_شهري",
      معرف_الكيان: id,
      التفاصيل: {
        قبل: { الاسم: حالي.name, المبلغ: حالي.defaultAmount.toString() },
        بعد: { الاسم: ب.الاسم, المبلغ: ب.المبلغ },
      },
    });
  });
  revalidatePath("/monthly-expenses");
  return نجح(undefined, "تم تعديل البند (المبلغ الجديد يسري على الشهور الجاية)");
}

/**
 * تعديل المبلغ المقرر لشهر بعينه — ده الحل اللي بيظهر للمستخدم
 * لما يتجاوز المتاح ويختار «إلغاء وتعديل المبلغ».
 * يُحدَّث كذلك المبلغ الافتراضي للبند اختيارياً (سريان على الشهور الجاية).
 */
export async function عدّل_مبلغ_الشهر(
  معرف_بند_الشهر: number,
  مبلغ: unknown,
  طبّق_على_الشهور_الجاية = false
): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const قيمة = تحليل_مبلغ(مبلغ as string | number);
  if (قيمة === null || Number(قيمة) <= 0) return فشل("المبلغ يجب أن يكون أكبر من صفر");
  const بند = await prisma.monthlyExpensePeriod.findUnique({
    where: { id: معرف_بند_الشهر },
    include: { item: { select: { id: true, name: true } } },
  });
  if (!بند) return فشل("بند الشهر غير موجود");

  await prisma.$transaction(async (tx) => {
    await tx.monthlyExpensePeriod.update({ where: { id: معرف_بند_الشهر }, data: { amount: قيمة } });
    if (طبّق_على_الشهور_الجاية) {
      await tx.monthlyExpenseItem.update({
        where: { id: بند.item.id },
        data: { defaultAmount: قيمة, updatedById: فاعل.id },
      });
    }
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "UPDATE",
      نوع_الكيان: "مصروف_شهري",
      معرف_الكيان: بند.item.id,
      التفاصيل: {
        تعديل_مبلغ_شهر: `${بند.month}/${بند.year}`,
        قبل: بند.amount.toString(),
        بعد: String(قيمة),
        الشهور_الجاية: طبّق_على_الشهور_الجاية,
      },
    });
  });
  revalidatePath("/monthly-expenses");
  revalidatePath("/treasury");
  return نجح(undefined, "تم تعديل المبلغ المقرر");
}

/** إيقاف/تشغيل البند (الموقوف ما يتولّدش في الشهور الجاية) */
export async function بدّل_تفعيل_بند(id: number): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const حالي = await prisma.monthlyExpenseItem.findUnique({ where: { id } });
  if (!حالي) return فشل("البند غير موجود");
  await prisma.monthlyExpenseItem.update({
    where: { id },
    data: { active: !حالي.active, updatedById: فاعل.id },
  });
  revalidatePath("/monthly-expenses");
  return نجح(undefined, حالي.active ? "تم إيقاف البند" : "تم تشغيل البند");
}

/** حذف البند نهائياً (بكل شهوره) — حركات الخزنة تفضل زي ما هي بلا ربط */
export async function احذف_بند_مصروف(id: number): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "حذف");
  const بند = await prisma.monthlyExpenseItem.findUnique({ where: { id } });
  if (!بند) return فشل("البند غير موجود");
  await prisma.$transaction(async (tx) => {
    await tx.monthlyExpenseItem.delete({ where: { id } }); // بنود الشهور Cascade
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "DELETE",
      نوع_الكيان: "مصروف_شهري",
      معرف_الكيان: id,
      التفاصيل: { الاسم: بند.name },
    });
  });
  revalidatePath("/monthly-expenses");
  revalidatePath("/treasury");
  return نجح(undefined, `تم حذف بند «${بند.name}»`);
}

/** بنود الشهر الحالي للاختيار من نموذج الخزنة (مع المتبقي لفحص التجاوز) */
export async function اجلب_بنود_شهر_للاختيار(): Promise<
  { id: number; الاسم: string; المتاح: number; المدفوع: number; المتبقي: number }[]
> {
  const فاعل = await اطلب_المستخدم();
  const بنود = await اجلب_بنود_الشهر(شهر_اليوم(), فاعل.id);
  return بنود
    .filter((ب) => ب.نشط)
    .map((ب) => ({ id: ب.معرف, الاسم: ب.الاسم, المتاح: ب.المتاح, المدفوع: ب.المدفوع, المتبقي: ب.المتبقي }));
}

/** فحص التجاوز قبل الحفظ (يستخدمه نموذج الخزنة لعرض التحذير) */
export async function افحص_تجاوز_المصروف(
  معرف_بند_الشهر: number,
  مبلغ: unknown,
  استثنِ_حركة?: number | null
): Promise<{ متجاوز: boolean; الاسم: string; المقرر: number; المتبقي: number; الزيادة: number } | null> {
  await اطلب_المستخدم();
  const حالة = await متبقي_بند_الشهر(معرف_بند_الشهر, استثنِ_حركة ?? null);
  if (!حالة) return null;
  const قيمة = Number(تحليل_مبلغ(مبلغ as string | number) ?? 0);
  const الزيادة = قيمة - حالة.المتبقي;
  return {
    متجاوز: الزيادة > 0.0001,
    الاسم: حالة.الاسم,
    المقرر: حالة.المقرر,
    المتبقي: حالة.المتبقي,
    الزيادة: Math.max(الزيادة, 0),
  };
}

/** حركات الخزنة المرتبطة ببند شهر (لعرضها في نافذة التفاصيل) */
export async function اجلب_حركات_بند_الشهر(معرف_بند_الشهر: number): Promise<
  { id: number; التاريخ: string; البيان: string; الحساب: string; المبلغ: number }[]
> {
  await اطلب_المستخدم();
  const حركات = await prisma.treasuryTxn.findMany({
    where: { monthlyExpensePeriodId: معرف_بند_الشهر, deletedAt: null },
    orderBy: { date: "asc" },
    select: { id: true, date: true, description: true, amount: true, account: { select: { type: true } } },
  });
  const { تسمية_حساب_الخزنة } = await import("@/lib/enums");
  return حركات.map((ح) => ({
    id: ح.id,
    التاريخ: ح.date.toISOString(),
    البيان: ح.description,
    الحساب: تسمية_حساب_الخزنة[ح.account.type],
    المبلغ: Number(ح.amount),
  }));
}

/** توليد بنود شهر يدوياً (زرار في الواجهة عند فتح شهر جديد) */
export async function ولّد_بنود_الشهر(س: شهر): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  await اضمن_بنود_الشهر(س, فاعل.id);
  revalidatePath("/monthly-expenses");
  return نجح(undefined, `تم تجهيز بنود ${تسمية_الشهر(س)}`);
}
