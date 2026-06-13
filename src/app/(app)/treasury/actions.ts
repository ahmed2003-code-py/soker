"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { اطلب_المستخدم } from "@/lib/session";
import { تحقق_الصلاحية } from "@/lib/authz";
import { تسجيل_عملية } from "@/lib/activity";
import { أضف_حركة_خزنة, أعد_حساب_حساب_الخزنة } from "@/lib/treasury";
import { نجح, فشل, type نتيجة } from "@/lib/result";
import { تحليل_تاريخ } from "@/lib/date";
import { مخطط_حركة_خزنة } from "@/lib/schemas/treasury";

/** هل ستجعل الحركة رصيد الحساب سالباً؟ (للتنبيه فقط — مسموح) */
async function سيصبح_سالباً(معرف_الحساب: number): Promise<boolean> {
  const ح = await prisma.treasuryAccount.findUnique({ where: { id: معرف_الحساب } });
  return ح ? Number(ح.balance) < 0 : false;
}

export async function تسجيل_حركة(مدخلات: unknown): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_حركة_خزنة.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  const تاريخ = تحليل_تاريخ(ب.التاريخ) ?? new Date();

  const حركة = await prisma.$transaction(async (tx) => {
    const h = await أضف_حركة_خزنة(tx, {
      التاريخ: تاريخ,
      النوع: ب.النوع,
      المبلغ: ب.المبلغ!,
      معرف_الحساب: ب.معرف_الحساب,
      البيان: ب.البيان,
      معرف_الطرف: ب.معرف_الطرف ?? null,
      طريقة_الدفع: ب.طريقة_الدفع ?? null,
      أنشأ: فاعل.id,
    });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "CREATE",
      نوع_الكيان: "حركة_الخزنة",
      معرف_الكيان: h.id,
      التفاصيل: { النوع: ب.النوع, المبلغ: ب.المبلغ, الحساب: ب.معرف_الحساب },
    });
    return h;
  });

  revalidatePath("/treasury");
  const سالب = ب.النوع === "EXPENSE" && (await سيصبح_سالباً(ب.معرف_الحساب));
  return نجح(undefined, سالب ? "تم التسجيل (تنبيه: رصيد الحساب أصبح سالباً)" : "تم تسجيل الحركة");
}

export async function تعديل_حركة_خزنة(id: number, مدخلات: unknown): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_حركة_خزنة.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  const حالي = await prisma.treasuryTxn.findUnique({
    where: { id },
    include: { ledgerEntry: true },
  });
  if (!حالي) return فشل("الحركة غير موجودة");
  if (حالي.ledgerEntry)
    return فشل("هذه الحركة مرتبطة بحساب طرف — تُعدّل من شاشة التكامل (المرحلة 9)");
  const تاريخ = تحليل_تاريخ(ب.التاريخ) ?? new Date();

  await prisma.$transaction(async (tx) => {
    await tx.treasuryTxn.update({
      where: { id },
      data: {
        date: تاريخ,
        kind: ب.النوع,
        amount: ب.المبلغ!,
        accountId: ب.معرف_الحساب,
        description: ب.البيان,
        method: ب.طريقة_الدفع ?? null,
        updatedById: فاعل.id,
      },
    });
    // إعادة حساب الحساب القديم والجديد (قد تكون الحركة انتقلت بين حسابين)
    if (حالي.accountId !== ب.معرف_الحساب) {
      await أعد_حساب_حساب_الخزنة(tx, حالي.accountId);
    }
    await أعد_حساب_حساب_الخزنة(tx, ب.معرف_الحساب);
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "UPDATE",
      نوع_الكيان: "حركة_الخزنة",
      معرف_الكيان: id,
      التفاصيل: {
        قبل: { النوع: حالي.kind, المبلغ: حالي.amount, الحساب: حالي.accountId },
        بعد: { النوع: ب.النوع, المبلغ: ب.المبلغ, الحساب: ب.معرف_الحساب },
      },
    });
  });
  revalidatePath("/treasury");
  return نجح(undefined, "تم تعديل الحركة وإعادة حساب الأرصدة");
}

export async function حذف_حركة_خزنة(id: number): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "حذف");
  const حالي = await prisma.treasuryTxn.findUnique({
    where: { id },
    include: { ledgerEntry: true },
  });
  if (!حالي) return فشل("الحركة غير موجودة");
  if (حالي.ledgerEntry)
    return فشل("هذه الحركة مرتبطة بحساب طرف — تُحذف من شاشة التكامل (المرحلة 9)");

  await prisma.$transaction(async (tx) => {
    await tx.treasuryTxn.delete({ where: { id } });
    await أعد_حساب_حساب_الخزنة(tx, حالي.accountId);
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "DELETE",
      نوع_الكيان: "حركة_الخزنة",
      معرف_الكيان: id,
      التفاصيل: { النوع: حالي.kind, المبلغ: حالي.amount, الحساب: حالي.accountId },
    });
  });
  revalidatePath("/treasury");
  return نجح(undefined, "تم حذف الحركة وإعادة حساب الرصيد");
}
