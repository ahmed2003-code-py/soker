"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { اطلب_المستخدم } from "@/lib/session";
import { تحقق_الصلاحية } from "@/lib/authz";
import { تسجيل_عملية } from "@/lib/activity";
import { أضف_حركة_خزنة, احذف_حركة_خزنة_ناعم } from "@/lib/treasury";
import { زامن_آثار_الشيك, دخل_معاملة_مالية } from "@/lib/cheques-accounting";
import { نجح, فشل, type نتيجة } from "@/lib/result";
import { تحليل_تاريخ } from "@/lib/date";
import { د } from "@/lib/decimal";
import { مخطط_شيك } from "@/lib/schemas/cheque";
import { ChequeStatus, TxnKind } from "@prisma/client";
import { تسمية_حالة_الشيك, تسمية_حساب_الخزنة } from "@/lib/enums";

/** الانتقالات المسموح بها لدورة حياة الشيك. */
const انتقالات_الحالة: Record<ChequeStatus, ChequeStatus[]> = {
  REGISTERED: ["PENDING", "DEPOSITED", "ENDORSED", "COLLECTED", "CANCELLED"],
  PENDING: ["DEPOSITED", "ENDORSED", "COLLECTED", "BOUNCED", "CANCELLED"],
  DEPOSITED: ["COLLECTED", "BOUNCED", "CANCELLED"],
  ENDORSED: ["BOUNCED", "CANCELLED"], // مُظهَّر لمورد → ارتداد (يرجع مستحق المورد) أو إلغاء
  COLLECTED: ["BOUNCED", "CANCELLED"], // تصحيح: ارتداد بعد التحصيل أو إلغاء (عكس)
  SETTLED: ["CANCELLED"], // تمت التسوية على دفعات → إلغاء فقط (يعكس الدفعات)
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
  // منع الازدواج: شيك عليه دفعات تسوية لا يُصرف من البنك
  if (الحالة === "COLLECTED") {
    const عدد_دفعات = await prisma.treasuryTxn.count({ where: { chequeId: id, deletedAt: null } });
    if (عدد_دفعات > 0) return فشل("الشيك تحت التسوية على دفعات — لا يمكن صرفه من البنك");
  }
  if (الحالة === شيك.status) return نجح(undefined, "لا تغيير");

  try {
    await prisma.$transaction(async (tx) => {
      // الإلغاء يعكس دفعات التسوية أيضاً (ترجع الفلوس للخزنة)
      if (الحالة === "CANCELLED") {
        const دفعات = await tx.treasuryTxn.findMany({ where: { chequeId: id, deletedAt: null }, select: { id: true } });
        for (const د of دفعات) await احذف_حركة_خزنة_ناعم(tx, د.id);
      }
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

/**
 * إضافة دفعة تسوية لشيك صادر — فلوس تخرج من الخزنة (كاش/تحويل) بدل صرف الشيك من البنك.
 * لا أثر على دفتر الأستاذ (المستحق للمورد اتخصم وقت الإصدار). عند اكتمال القيمة → «تمت التسوية».
 */
export async function أضف_دفعة_تسوية(
  id: number,
  مدخلات: { المبلغ: string | number; معرف_الحساب: number; معرف_حساب_فرعي?: number | null; التاريخ?: string | null; البيان?: string | null }
): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const شيك = await prisma.cheque.findUnique({ where: { id } });
  if (!شيك) return فشل("الشيك غير موجود");
  if (شيك.direction !== "OUTGOING") return فشل("التسوية على دفعات للشيكات الصادرة فقط");
  if (شيك.collectedTxnId) return فشل("الشيك تم صرفه من البنك — لا يمكن التسوية على دفعات");
  if (!(["PENDING", "SETTLED"] as ChequeStatus[]).includes(شيك.status)) {
    return فشل(`لا يمكن التسوية في الحالة الحالية (${تسمية_حالة_الشيك[شيك.status]}) — يجب أن يكون «تحت الصرف»`);
  }
  const مبلغ = د(String(مدخلات.المبلغ).replace(/,/g, ""));
  if (مبلغ.lessThanOrEqualTo(0)) return فشل("المبلغ يجب أن يكون أكبر من صفر");

  const دفعات = await prisma.treasuryTxn.findMany({ where: { chequeId: id, deletedAt: null }, select: { amount: true } });
  const مُسدَّد = دفعات.reduce((س, د2) => س.plus(د2.amount), د(0));
  const متبقٍ = د(شيك.amount).minus(مُسدَّد);
  if (مبلغ.greaterThan(متبقٍ.plus(0.005))) {
    return فشل(`المبلغ أكبر من المتبقي (${متبقٍ.toFixed(2)})`);
  }
  const تاريخ = تحليل_تاريخ(مدخلات.التاريخ ?? null) ?? new Date();
  const حساب = await prisma.treasuryAccount.findUnique({ where: { id: مدخلات.معرف_الحساب }, select: { type: true } });
  if (!حساب) return فشل("حساب الخزنة غير موجود");
  const طريقة = تسمية_حساب_الخزنة[حساب.type];
  const مكتمل = مُسدَّد.plus(مبلغ).greaterThanOrEqualTo(د(شيك.amount).minus(0.005));

  try {
    await prisma.$transaction(async (tx) => {
      const حركة = await أضف_حركة_خزنة(tx, {
        التاريخ: تاريخ,
        النوع: TxnKind.EXPENSE,
        المبلغ: مبلغ,
        معرف_الحساب: مدخلات.معرف_الحساب,
        معرف_حساب_فرعي: مدخلات.معرف_حساب_فرعي ?? null,
        البيان: مدخلات.البيان?.trim() || `تسوية شيك صادر${شيك.chequeNumber ? " رقم " + شيك.chequeNumber : ""} — ${طريقة}`,
        اسم_الطرف_الخارجي: شيك.drawerName,
        طريقة_الدفع: طريقة,
        أنشأ: فاعل.id,
      });
      await tx.treasuryTxn.update({ where: { id: حركة.id }, data: { chequeId: id } });
      if (مكتمل && شيك.status !== "SETTLED") {
        await tx.cheque.update({ where: { id }, data: { status: "SETTLED", updatedById: فاعل.id } });
      }
      await تسجيل_عملية(tx, {
        المستخدم: فاعل.id,
        العملية: "UPDATE",
        نوع_الكيان: "الشيك",
        معرف_الكيان: id,
        التفاصيل: { دفعة_تسوية: مبلغ.toString(), طريقة, ...(مكتمل ? { تمت_التسوية: true } : {}) },
      });
    });
  } catch (e) {
    return فشل(e instanceof Error ? e.message : "خطأ أثناء تسجيل الدفعة");
  }
  revalidatePath("/cheques");
  revalidatePath("/treasury");
  return نجح(undefined, مكتمل ? "تمت التسوية بالكامل" : "تم تسجيل الدفعة");
}

/** حذف دفعة تسوية — ترجع الفلوس للخزنة، ولو كان الشيك «تمت التسوية» يرجع «تحت الصرف». */
export async function احذف_دفعة_تسوية(معرف_الحركة: number): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "حذف");
  const حركة = await prisma.treasuryTxn.findUnique({ where: { id: معرف_الحركة }, select: { chequeId: true, amount: true } });
  if (!حركة?.chequeId) return فشل("هذه ليست دفعة تسوية");
  const معرف_الشيك = حركة.chequeId;

  try {
    await prisma.$transaction(async (tx) => {
      await احذف_حركة_خزنة_ناعم(tx, معرف_الحركة);
      const شيك = await tx.cheque.findUniqueOrThrow({ where: { id: معرف_الشيك } });
      if (شيك.status === "SETTLED") {
        await tx.cheque.update({ where: { id: معرف_الشيك }, data: { status: "PENDING", updatedById: فاعل.id } });
      }
      await تسجيل_عملية(tx, {
        المستخدم: فاعل.id,
        العملية: "DELETE",
        نوع_الكيان: "الشيك",
        معرف_الكيان: معرف_الشيك,
        التفاصيل: { حذف_دفعة_تسوية: حركة.amount.toString() },
      });
    });
  } catch (e) {
    return فشل(e instanceof Error ? e.message : "خطأ أثناء حذف الدفعة");
  }
  revalidatePath("/cheques");
  revalidatePath("/treasury");
  return نجح(undefined, "تم حذف الدفعة وإرجاعها للخزنة");
}

/** جلب دفعات تسوية شيك (للعرض في الحوار). */
export async function اجلب_دفعات_التسوية(id: number): Promise<
  نتيجة<{ الإجمالي: number; المُسدَّد: number; الدفعات: { id: number; المبلغ: number; الطريقة: string | null; التاريخ: string; البيان: string }[] }>
> {
  await اطلب_المستخدم();
  const [شيك, دفعات] = await Promise.all([
    prisma.cheque.findUnique({ where: { id }, select: { amount: true } }),
    prisma.treasuryTxn.findMany({
      where: { chequeId: id, deletedAt: null },
      orderBy: { id: "asc" },
      select: { id: true, amount: true, method: true, date: true, description: true },
    }),
  ]);
  if (!شيك) return فشل("الشيك غير موجود");
  return نجح({
    الإجمالي: Number(شيك.amount),
    المُسدَّد: دفعات.reduce((س, د2) => س + Number(د2.amount), 0),
    الدفعات: دفعات.map((د2) => ({ id: د2.id, المبلغ: Number(د2.amount), الطريقة: د2.method, التاريخ: د2.date.toISOString(), البيان: د2.description })),
  });
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
