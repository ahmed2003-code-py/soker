"use server";
import { revalidatePath } from "next/cache";
import { PartyType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { اطلب_المستخدم } from "@/lib/session";
import { تحقق_الصلاحية } from "@/lib/authz";
import { تسجيل_عملية } from "@/lib/activity";
import { نجح, فشل, type نتيجة } from "@/lib/result";
import { تحليل_تاريخ } from "@/lib/date";
import { مخطط_دفعة } from "@/lib/schemas/party";
import {
  أنشئ_عملية_مرتبطة,
  اعكس_عملية_مرتبطة,
  type اتجاه,
} from "@/lib/integration";

/** خدمة موحّدة: تحصيل من عميل / صرف لمورد (إيراد/مصروف خزنة + قيد طرف ذرّياً). */
export async function سجّل_عملية_مرتبطة(مدخلات: unknown): Promise<نتيجة<{ معرف_حركة_الخزنة: number }>> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_دفعة.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  if (!ب.معرف_حساب_الخزنة) return فشل("اختر حساب الخزنة");

  const طرف = await prisma.party.findUnique({ where: { id: ب.معرف_الطرف } });
  if (!طرف) return فشل("الطرف غير موجود");
  const الاتجاه: اتجاه = طرف.type === PartyType.CUSTOMER ? "تحصيل" : "صرف";
  const تاريخ = تحليل_تاريخ(ب.التاريخ) ?? new Date();

  const نتج = await prisma.$transaction(async (tx) => {
    const r = await أنشئ_عملية_مرتبطة(tx, {
      الاتجاه,
      معرف_الطرف: طرف.id,
      اسم_الطرف: طرف.name,
      المبلغ: ب.المبلغ!,
      التاريخ: تاريخ,
      معرف_الحساب: ب.معرف_حساب_الخزنة!,
      طريقة_الدفع: ب.طريقة_الدفع,
      رقم_الفاتورة: ب.رقم_الفاتورة ?? null,
      أنشأ: فاعل.id,
    });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "CREATE",
      نوع_الكيان: "حركة_الخزنة",
      معرف_الكيان: r.معرف_حركة_الخزنة,
      التفاصيل: { الاتجاه, الطرف: طرف.name, المبلغ: ب.المبلغ, حساب: ب.معرف_حساب_الخزنة },
    });
    return r;
  });

  revalidatePath("/treasury");
  revalidatePath(`/${طرف.type === "CUSTOMER" ? "customers" : "suppliers"}/${طرف.id}`);
  return نجح(نتج, الاتجاه === "تحصيل" ? "تم تسجيل التحصيل وربطه بالخزنة" : "تم تسجيل الصرف وربطه بالخزنة");
}

/** تعديل عملية مرتبطة: عكس ثم إعادة تطبيق (نفس الطرف والاتجاه، بقيم جديدة). */
export async function عدّل_عملية_مرتبطة(
  معرف_حركة: number,
  مدخلات: unknown
): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_دفعة.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  if (!ب.معرف_حساب_الخزنة) return فشل("اختر حساب الخزنة");
  const طرف = await prisma.party.findUnique({ where: { id: ب.معرف_الطرف } });
  if (!طرف) return فشل("الطرف غير موجود");
  const الاتجاه: اتجاه = طرف.type === PartyType.CUSTOMER ? "تحصيل" : "صرف";
  const تاريخ = تحليل_تاريخ(ب.التاريخ) ?? new Date();

  await prisma.$transaction(async (tx) => {
    await اعكس_عملية_مرتبطة(tx, معرف_حركة); // عكس
    const r = await أنشئ_عملية_مرتبطة(tx, {
      الاتجاه,
      معرف_الطرف: طرف.id,
      اسم_الطرف: طرف.name,
      المبلغ: ب.المبلغ!,
      التاريخ: تاريخ,
      معرف_الحساب: ب.معرف_حساب_الخزنة!,
      طريقة_الدفع: ب.طريقة_الدفع,
      رقم_الفاتورة: ب.رقم_الفاتورة ?? null,
      أنشأ: فاعل.id,
    });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "UPDATE",
      نوع_الكيان: "حركة_الخزنة",
      معرف_الكيان: r.معرف_حركة_الخزنة,
      التفاصيل: { عكس_وإعادة_تطبيق: true, المبلغ_الجديد: ب.المبلغ, الطرف: طرف.name },
    });
  });
  revalidatePath("/treasury");
  revalidatePath(`/${طرف.type === "CUSTOMER" ? "customers" : "suppliers"}/${طرف.id}`);
  return نجح(undefined, "تم تعديل العملية (عكس وإعادة تطبيق) — الجانبان متّسقان");
}

/** حذف عملية مرتبطة: عكس كامل للجانبين. */
export async function احذف_عملية_مرتبطة(معرف_حركة: number): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "حذف");
  const حركة = await prisma.treasuryTxn.findUnique({ where: { id: معرف_حركة } });
  if (!حركة) return فشل("الحركة غير موجودة");

  await prisma.$transaction(async (tx) => {
    const م = await اعكس_عملية_مرتبطة(tx, معرف_حركة);
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "DELETE",
      نوع_الكيان: "حركة_الخزنة",
      معرف_الكيان: معرف_حركة,
      التفاصيل: { عكس_كامل: true, الاتجاه: م.الاتجاه, المبلغ: م.المبلغ },
    });
  });
  revalidatePath("/treasury");
  if (حركة.partyId) {
    const ط = await prisma.party.findUnique({ where: { id: حركة.partyId } });
    if (ط) revalidatePath(`/${ط.type === "CUSTOMER" ? "customers" : "suppliers"}/${ط.id}`);
  }
  return نجح(undefined, "تم حذف العملية وعكس الجانبين");
}
