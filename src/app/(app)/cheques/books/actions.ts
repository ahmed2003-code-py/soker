"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { اطلب_المستخدم } from "@/lib/session";
import { تحقق_الصلاحية } from "@/lib/authz";
import { تسجيل_عملية } from "@/lib/activity";
import { نجح, فشل, type نتيجة } from "@/lib/result";
import { نطاق_صالح } from "@/lib/cheque-books";
import { ChequeDirection } from "@prisma/client";

type مدخلات_دفتر = {
  الاسم: string;
  الاتجاه: ChequeDirection;
  اسم_البنك?: string | null;
  من_رقم?: number | null;
  إلى_رقم?: number | null;
  ملاحظات?: string | null;
};

function نظّف(م: مدخلات_دفتر) {
  const الاسم = (م.الاسم ?? "").trim();
  const اسم_البنك = م.اسم_البنك?.trim() || null;
  const من_رقم = م.من_رقم != null && Number.isFinite(Number(م.من_رقم)) ? Number(م.من_رقم) : null;
  const إلى_رقم = م.إلى_رقم != null && Number.isFinite(Number(م.إلى_رقم)) ? Number(م.إلى_رقم) : null;
  return { الاسم, اسم_البنك, من_رقم, إلى_رقم, ملاحظات: م.ملاحظات?.trim() || null };
}

export async function أنشئ_دفتر(مدخلات: مدخلات_دفتر): Promise<نتيجة<{ id: number }>> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const ن = نظّف(مدخلات);
  if (!ن.الاسم) return فشل("اسم الدفتر/الحافظة مطلوب");
  if (!نطاق_صالح(ن.من_رقم, ن.إلى_رقم)) return فشل("مدى الأرقام غير صالح (إلى < من)");

  const دفتر = await prisma.$transaction(async (tx) => {
    const d = await tx.chequeBook.create({
      data: {
        name: ن.الاسم,
        direction: مدخلات.الاتجاه,
        bankName: ن.اسم_البنك,
        startNo: ن.من_رقم,
        endNo: ن.إلى_رقم,
        notes: ن.ملاحظات,
        createdById: فاعل.id,
      },
    });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "CREATE",
      نوع_الكيان: "دفتر_الشيكات",
      معرف_الكيان: d.id,
      التفاصيل: { الاسم: ن.الاسم, الاتجاه: مدخلات.الاتجاه },
    });
    return d;
  });
  revalidatePath("/cheques/books");
  return نجح({ id: دفتر.id }, "تم إنشاء الدفتر/الحافظة");
}

export async function تعديل_دفتر(id: number, مدخلات: مدخلات_دفتر): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const دفتر = await prisma.chequeBook.findUnique({ where: { id } });
  if (!دفتر) return فشل("الدفتر غير موجود");
  const ن = نظّف(مدخلات);
  if (!ن.الاسم) return فشل("اسم الدفتر/الحافظة مطلوب");
  if (!نطاق_صالح(ن.من_رقم, ن.إلى_رقم)) return فشل("مدى الأرقام غير صالح (إلى < من)");

  await prisma.$transaction(async (tx) => {
    await tx.chequeBook.update({
      where: { id },
      data: {
        name: ن.الاسم,
        direction: مدخلات.الاتجاه,
        bankName: ن.اسم_البنك,
        startNo: ن.من_رقم,
        endNo: ن.إلى_رقم,
        notes: ن.ملاحظات,
      },
    });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "UPDATE",
      نوع_الكيان: "دفتر_الشيكات",
      معرف_الكيان: id,
      التفاصيل: { الاسم: ن.الاسم },
    });
  });
  revalidatePath("/cheques/books");
  return نجح(undefined, "تم حفظ التعديلات");
}

/** تفعيل/أرشفة الدفتر (لا حذف — للحفاظ على ربط الشيكات). */
export async function بدّل_تفعيل_دفتر(id: number): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const دفتر = await prisma.chequeBook.findUnique({ where: { id }, select: { isActive: true } });
  if (!دفتر) return فشل("الدفتر غير موجود");
  await prisma.chequeBook.update({ where: { id }, data: { isActive: !دفتر.isActive } });
  revalidatePath("/cheques/books");
  return نجح(undefined, دفتر.isActive ? "تمت الأرشفة" : "تم التفعيل");
}

/** حذف دفتر — مسموح فقط إذا لم يرتبط به أي شيك. */
export async function احذف_دفتر(id: number): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "حذف");
  const عدد = await prisma.cheque.count({ where: { chequeBookId: id } });
  if (عدد > 0) return فشل(`لا يمكن الحذف — مرتبط به ${عدد} شيك. استخدم الأرشفة بدلاً من ذلك`);
  await prisma.$transaction(async (tx) => {
    await tx.chequeBook.delete({ where: { id } });
    await تسجيل_عملية(tx, { المستخدم: فاعل.id, العملية: "DELETE", نوع_الكيان: "دفتر_الشيكات", معرف_الكيان: id, التفاصيل: {} });
  });
  revalidatePath("/cheques/books");
  return نجح(undefined, "تم حذف الدفتر");
}
