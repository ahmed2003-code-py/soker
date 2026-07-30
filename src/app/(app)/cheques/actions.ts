"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { اطلب_المستخدم } from "@/lib/session";
import { تحقق_الصلاحية } from "@/lib/authz";
import { تسجيل_عملية } from "@/lib/activity";
import { احذف_حركة_خزنة_ناعم } from "@/lib/treasury";
import { زامن_آثار_الشيك, دخل_معاملة_مالية } from "@/lib/cheques-accounting";
import { نجح, فشل, type نتيجة } from "@/lib/result";
import { تحليل_تاريخ } from "@/lib/date";
import { مخطط_شيك } from "@/lib/schemas/cheque";
import { ChequeStatus } from "@prisma/client";
import { تسمية_حالة_الشيك } from "@/lib/enums";

/** الانتقالات المسموح بها لدورة حياة الشيك. */
const انتقالات_الحالة: Record<ChequeStatus, ChequeStatus[]> = {
  REGISTERED: ["PENDING", "DEPOSITED", "ENDORSED", "COLLECTED", "CANCELLED"],
  PENDING: ["DEPOSITED", "ENDORSED", "COLLECTED", "BOUNCED", "CANCELLED"],
  DEPOSITED: ["COLLECTED", "BOUNCED", "CANCELLED"],
  ENDORSED: ["BOUNCED", "CANCELLED"], // مُظهَّر لمورد → ارتداد (يرجع مستحق المورد) أو إلغاء
  COLLECTED: ["BOUNCED", "CANCELLED"], // تصحيح: ارتداد بعد التحصيل أو إلغاء (عكس)
  BOUNCED: ["PENDING", "DEPOSITED", "ENDORSED", "CANCELLED"], // إعادة تقديم
  CANCELLED: [], // نهائي
};


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
        direction: ب.الاتجاه,
        status: ب.الحالة,
        partyId: ب.معرف_الطرف ?? null,
        notes: ب.ملاحظات || null,
        imageData: فكّ_base64(ب.صورة_base64),
        imageMime: ب.صورة_mime || null,
        ocrText: ب.نص_OCR || null,
        createdById: فاعل.id,
      },
    });
    // أثر الطرف عند الاستلام/التسليم (لو الشيك مربوط بطرف وفي حالة ملتزمة)
    await زامن_آثار_الشيك(
      tx,
      { id: c.id, direction: c.direction, amount: c.amount, partyId: c.partyId, chequeNumber: c.chequeNumber, drawerName: c.drawerName, status: c.status, collectedTxnId: null, partyLedgerEntryId: null, endorseLedgerEntryId: null, endorsedToId: null },
      c.status,
      {},
      فاعل.id
    );
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "CREATE",
      نوع_الكيان: "الشيك",
      معرف_الكيان: c.id,
      التفاصيل: { اسم_المدين: ب.اسم_المدين, المبلغ: ب.المبلغ, الاتجاه: ب.الاتجاه, الاستحقاق: ب.تاريخ_الاستحقاق, الحالة: ب.الحالة },
    });
    return c;
  });
  revalidatePath("/cheques");
  revalidatePath("/treasury");
  if (ب.معرف_الطرف) {
    revalidatePath(`/customers/${ب.معرف_الطرف}`);
    revalidatePath(`/suppliers/${ب.معرف_الطرف}`);
  }
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
  // منع التعديل بعد دخول الشيك معاملة مالية — التصحيح بالإلغاء أو القيد العكسي فقط
  if (دخل_معاملة_مالية(حالي)) {
    return فشل("لا يمكن تعديل شيك دخل معاملة مالية — استخدم تغيير الحالة (إلغاء/عكس) بدلاً من ذلك");
  }
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
        direction: ب.الاتجاه,
        status: ب.الحالة,
        partyId: ب.معرف_الطرف ?? null,
        notes: ب.ملاحظات || null,
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
      التفاصيل: { قبل: { الحالة: حالي.status }, بعد: { الحالة: ب.الحالة, الاتجاه: ب.الاتجاه } },
    });
  });
  revalidatePath("/cheques");
  return نجح(undefined, "تم حفظ التعديلات");
}

type خيارات_حالة = {
  معرف_حساب_التحصيل?: number | null;
  معرف_حساب_فرعي?: number | null;
  معرف_المورد_للتظهير?: number | null;
};

export async function تغيير_حالة_شيك(
  id: number,
  الحالة: ChequeStatus,
  خيارات: خيارات_حالة = {}
): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");

  const شيك = await prisma.cheque.findUnique({ where: { id } });
  if (!شيك) return فشل("الشيك غير موجود");

  // التحقق من صحة الانتقال في دورة الحياة
  if (الحالة !== شيك.status && !انتقالات_الحالة[شيك.status].includes(الحالة)) {
    return فشل(
      `انتقال غير مسموح: من «${تسمية_حالة_الشيك[شيك.status]}» إلى «${تسمية_حالة_الشيك[الحالة]}»`
    );
  }
  if (الحالة === "ENDORSED" && شيك.direction !== "INCOMING") {
    return فشل("التظهير للشيكات الواردة فقط");
  }
  if (الحالة === "ENDORSED" && !خيارات.معرف_المورد_للتظهير && !شيك.endorsedToId) {
    return فشل("اختر المورد المُظهَّر له الشيك");
  }
  if (الحالة === شيك.status) return نجح(undefined, "لا تغيير");

  try {
    await prisma.$transaction(async (tx) => {
      await زامن_آثار_الشيك(tx, شيك, الحالة, خيارات, فاعل.id);
      await تسجيل_عملية(tx, {
        المستخدم: فاعل.id,
        العملية: "UPDATE",
        نوع_الكيان: "الشيك",
        معرف_الكيان: id,
        التفاصيل: { تغيير_الحالة: الحالة, من: شيك.status, ...(خيارات.معرف_المورد_للتظهير ? { تظهير_لمورد: خيارات.معرف_المورد_للتظهير } : {}) },
      });
    });
  } catch (e) {
    return فشل(e instanceof Error ? e.message : "خطأ أثناء تغيير الحالة");
  }
  revalidatePath("/cheques");
  revalidatePath("/treasury");
  if (خيارات.معرف_المورد_للتظهير) revalidatePath(`/suppliers/${خيارات.معرف_المورد_للتظهير}`);
  if (شيك.endorsedToId) revalidatePath(`/suppliers/${شيك.endorsedToId}`);
  if (شيك.partyId) {
    revalidatePath(`/customers/${شيك.partyId}`);
    revalidatePath(`/suppliers/${شيك.partyId}`);
  }
  return نجح(undefined, "تم تحديث الحالة");
}

/** تظهير شيك وارد لمورد (يقلّل مستحق المورد، بلا حركة خزنة). */
export async function ظهّر_شيك(id: number, معرف_المورد: number): Promise<نتيجة> {
  return تغيير_حالة_شيك(id, "ENDORSED", { معرف_المورد_للتظهير: معرف_المورد });
}

export async function حذف_شيك(id: number): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "حذف");
  const ش = await prisma.cheque.findUnique({ where: { id } });
  if (!ش) return فشل("الشيك غير موجود");
  // لا حذف نهائي لأي شيك دخل معاملة مالية — يبقى السجل، والتصحيح بالإلغاء
  if (دخل_معاملة_مالية(ش)) {
    return فشل("لا يمكن حذف شيك دخل معاملة مالية — استخدم الإلغاء للحفاظ على السجل");
  }

  await prisma.$transaction(async (tx) => {
    // إذا كان صادراً ومحصّلاً → اعكس خصم البنك أولاً (احترازي — لا يصل هنا عادةً بعد الحارس)
    if (ش.direction === "OUTGOING" && ش.collectedTxnId) {
      await احذف_حركة_خزنة_ناعم(tx, ش.collectedTxnId);
    }
    await tx.cheque.delete({ where: { id } });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "DELETE",
      نوع_الكيان: "الشيك",
      معرف_الكيان: id,
      التفاصيل: { اسم_المدين: ش.drawerName, المبلغ: ش.amount, الاتجاه: ش.direction },
    });
  });
  revalidatePath("/cheques");
  if (ش.collectedTxnId) revalidatePath("/treasury");
  return نجح(undefined, "تم حذف الشيك");
}
