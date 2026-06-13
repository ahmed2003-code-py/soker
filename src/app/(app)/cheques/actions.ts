"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { اطلب_المستخدم } from "@/lib/session";
import { تحقق_الصلاحية } from "@/lib/authz";
import { تسجيل_عملية } from "@/lib/activity";
import { نجح, فشل, type نتيجة } from "@/lib/result";
import { تحليل_تاريخ } from "@/lib/date";
import { مخطط_شيك } from "@/lib/schemas/cheque";

function فكّ_base64(صورة?: string | null): Buffer | null {
  if (!صورة) return null;
  const بيانات = صورة.includes(",") ? صورة.split(",")[1] : صورة;
  try {
    return Buffer.from(بيانات, "base64");
  } catch {
    return null;
  }
}

export async function إنشاء_شيك(مدخلات: unknown): Promise<نتيجة<{ id: number }>> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_شيك.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  const تاريخ = تحليل_تاريخ(ب.تاريخ_الاستحقاق);
  if (!تاريخ) return فشل("تاريخ الاستحقاق غير صالح");

  const شيك = await prisma.$transaction(async (tx) => {
    const c = await tx.cheque.create({
      data: {
        drawerName: ب.اسم_المدين,
        amount: ب.المبلغ!,
        beneficiary: ب.المستفيد || null,
        transferredFrom: ب.محول_من || null,
        bankName: ب.اسم_البنك || null,
        dueDate: تاريخ,
        chequeNumber: ب.رقم_الشيك || null,
        status: ب.الحالة,
        notes: ب.ملاحظات || null,
        imageData: فكّ_base64(ب.صورة_base64),
        imageMime: ب.صورة_mime || null,
        ocrText: ب.نص_OCR || null,
        createdById: فاعل.id,
      },
    });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "CREATE",
      نوع_الكيان: "الشيك",
      معرف_الكيان: c.id,
      التفاصيل: { اسم_المدين: ب.اسم_المدين, المبلغ: ب.المبلغ, الاستحقاق: ب.تاريخ_الاستحقاق },
    });
    return c;
  });
  revalidatePath("/cheques");
  return نجح({ id: شيك.id }, "تمت إضافة الشيك");
}

export async function تعديل_شيك(id: number, مدخلات: unknown): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_شيك.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  const حالي = await prisma.cheque.findUnique({ where: { id } });
  if (!حالي) return فشل("الشيك غير موجود");
  const تاريخ = تحليل_تاريخ(ب.تاريخ_الاستحقاق);
  if (!تاريخ) return فشل("تاريخ الاستحقاق غير صالح");

  const صورة = فكّ_base64(ب.صورة_base64);

  await prisma.$transaction(async (tx) => {
    await tx.cheque.update({
      where: { id },
      data: {
        drawerName: ب.اسم_المدين,
        amount: ب.المبلغ!,
        beneficiary: ب.المستفيد || null,
        transferredFrom: ب.محول_من || null,
        bankName: ب.اسم_البنك || null,
        dueDate: تاريخ,
        chequeNumber: ب.رقم_الشيك || null,
        status: ب.الحالة,
        notes: ب.ملاحظات || null,
        // لا نمسح الصورة الموجودة إن لم تُرسَل جديدة
        ...(صورة ? { imageData: صورة, imageMime: ب.صورة_mime || null } : {}),
        ...(ب.نص_OCR ? { ocrText: ب.نص_OCR } : {}),
        updatedById: فاعل.id,
      },
    });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "UPDATE",
      نوع_الكيان: "الشيك",
      معرف_الكيان: id,
      التفاصيل: { قبل: { الحالة: حالي.status }, بعد: { الحالة: ب.الحالة } },
    });
  });
  revalidatePath("/cheques");
  return نجح(undefined, "تم حفظ التعديلات");
}

export async function تغيير_حالة_شيك(
  id: number,
  الحالة: "PENDING" | "COLLECTED" | "BOUNCED"
): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  await prisma.$transaction(async (tx) => {
    await tx.cheque.update({ where: { id }, data: { status: الحالة, updatedById: فاعل.id } });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "UPDATE",
      نوع_الكيان: "الشيك",
      معرف_الكيان: id,
      التفاصيل: { تغيير_الحالة: الحالة },
    });
  });
  revalidatePath("/cheques");
  return نجح(undefined, "تم تحديث الحالة");
}

export async function حذف_شيك(id: number): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "حذف");
  const ش = await prisma.cheque.findUnique({ where: { id } });
  if (!ش) return فشل("الشيك غير موجود");
  await prisma.$transaction(async (tx) => {
    await tx.cheque.delete({ where: { id } });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "DELETE",
      نوع_الكيان: "الشيك",
      معرف_الكيان: id,
      التفاصيل: { اسم_المدين: ش.drawerName, المبلغ: ش.amount },
    });
  });
  revalidatePath("/cheques");
  return نجح(undefined, "تم حذف الشيك");
}
