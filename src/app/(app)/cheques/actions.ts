"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { اطلب_المستخدم } from "@/lib/session";
import { تحقق_الصلاحية } from "@/lib/authz";
import { تسجيل_عملية } from "@/lib/activity";
import { أضف_حركة_خزنة, احذف_حركة_خزنة_ناعم } from "@/lib/treasury";
import { نجح, فشل, type نتيجة } from "@/lib/result";
import { تحليل_تاريخ } from "@/lib/date";
import { مخطط_شيك } from "@/lib/schemas/cheque";
import { TxnKind, TreasuryAccountType, ChequeStatus } from "@prisma/client";
import { تسمية_حالة_الشيك } from "@/lib/enums";

/** الانتقالات المسموح بها لدورة حياة الشيك. */
const انتقالات_الحالة: Record<ChequeStatus, ChequeStatus[]> = {
  REGISTERED: ["PENDING", "DEPOSITED", "ENDORSED", "COLLECTED", "CANCELLED"],
  PENDING: ["DEPOSITED", "ENDORSED", "COLLECTED", "BOUNCED", "CANCELLED"],
  DEPOSITED: ["COLLECTED", "BOUNCED", "CANCELLED"],
  ENDORSED: ["COLLECTED", "BOUNCED", "CANCELLED"],
  COLLECTED: ["BOUNCED", "CANCELLED"], // تصحيح: ارتداد بعد التحصيل أو إلغاء (عكس)
  BOUNCED: ["PENDING", "DEPOSITED", "ENDORSED", "CANCELLED"], // إعادة تقديم
  CANCELLED: [], // نهائي
};

/** هل دخل الشيك معاملة مالية (فلا يُعدَّل/يُحذف — يُصحَّح بالإلغاء/العكس)؟ */
function دخل_معاملة_مالية(شيك: { status: ChequeStatus; collectedTxnId: number | null }): boolean {
  return شيك.collectedTxnId != null ||
    (["DEPOSITED", "ENDORSED", "COLLECTED", "CANCELLED"] as ChequeStatus[]).includes(شيك.status);
}

function فكّ_base64(صورة?: string | null): Buffer | null {
  if (!صورة) return null;
  const بيانات = صورة.includes(",") ? صورة.split(",")[1] : صورة;
  try {
    return Buffer.from(بيانات, "base64");
  } catch {
    return null;
  }
}

/** ابحث عن حساب البنك */
async function حساب_البنك(): Promise<number | null> {
  const بنك = await prisma.treasuryAccount.findFirst({
    where: { type: TreasuryAccountType.BANK },
    select: { id: true },
  });
  return بنك?.id ?? null;
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
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "CREATE",
      نوع_الكيان: "الشيك",
      معرف_الكيان: c.id,
      التفاصيل: { اسم_المدين: ب.اسم_المدين, المبلغ: ب.المبلغ, الاتجاه: ب.الاتجاه, الاستحقاق: ب.تاريخ_الاستحقاق },
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

export async function تغيير_حالة_شيك(
  id: number,
  الحالة: ChequeStatus,
  معرف_حساب_فرعي?: number | null
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
  if (الحالة === شيك.status) return نجح(undefined, "لا تغيير");

  await prisma.$transaction(async (tx) => {
    // شيك صادر: تحويل إلى COLLECTED → خصم من البنك (مرة واحدة فقط)
    if (شيك.direction === "OUTGOING" && الحالة === "COLLECTED" && شيك.status !== "COLLECTED" && !شيك.collectedTxnId) {
      const معرف_البنك = await حساب_البنك();
      if (معرف_البنك) {
        const حركة = await أضف_حركة_خزنة(tx, {
          التاريخ: new Date(),
          النوع: TxnKind.EXPENSE,
          المبلغ: شيك.amount,
          معرف_الحساب: معرف_البنك,
          معرف_حساب_فرعي: معرف_حساب_فرعي ?? null,
          البيان: `صرف شيك صادر${شيك.chequeNumber ? " رقم " + شيك.chequeNumber : ""} — ${شيك.drawerName}`,
          أنشأ: فاعل.id,
        });
        await tx.cheque.update({
          where: { id },
          data: { status: الحالة, collectedTxnId: حركة.id, updatedById: فاعل.id },
        });
        await تسجيل_عملية(tx, {
          المستخدم: فاعل.id,
          العملية: "UPDATE",
          نوع_الكيان: "الشيك",
          معرف_الكيان: id,
          التفاصيل: { تغيير_الحالة: الحالة, خصم_بنك: true, معرف_حركة: حركة.id, المبلغ: Number(شيك.amount) },
        });
        return;
      }
    }

    // شيك صادر: العودة من COLLECTED → عكس خصم البنك
    if (شيك.direction === "OUTGOING" && شيك.status === "COLLECTED" && الحالة !== "COLLECTED" && شيك.collectedTxnId) {
      await احذف_حركة_خزنة_ناعم(tx, شيك.collectedTxnId);
      await tx.cheque.update({
        where: { id },
        data: { status: الحالة, collectedTxnId: null, updatedById: فاعل.id },
      });
      await تسجيل_عملية(tx, {
        المستخدم: فاعل.id,
        العملية: "UPDATE",
        نوع_الكيان: "الشيك",
        معرف_الكيان: id,
        التفاصيل: { تغيير_الحالة: الحالة, عكس_خصم_بنك: true },
      });
      return;
    }

    // تغيير حالة عادي بدون أثر مالي
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
  revalidatePath("/treasury");
  return نجح(undefined, "تم تحديث الحالة");
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
