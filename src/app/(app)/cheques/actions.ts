"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { اطلب_المستخدم } from "@/lib/session";
import { تحقق_الصلاحية } from "@/lib/authz";
import { تسجيل_عملية } from "@/lib/activity";
import { أضف_حركة_خزنة, احذف_حركة_خزنة_ناعم } from "@/lib/treasury";
import { احذف_قيد_ناعم } from "@/lib/ledger";
import { زامن_آثار_الشيك, دخل_معاملة_مالية, مُسدَّد_تسوية } from "@/lib/cheques-accounting";
import { أنشئ_دفعة_موزعة } from "@/lib/integration";
import { مسار_صفحة_الطرف } from "@/lib/paths";
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

/** انتقالات النموذج الجديد v2 للشيكات الواردة: مسجّل → {مودع/مظهّر/محصّل} → (مرتد/ملغي). */
const انتقالات_v2_وارد: Record<ChequeStatus, ChequeStatus[]> = {
  REGISTERED: ["DEPOSITED", "ENDORSED", "COLLECTED", "CANCELLED"],
  PENDING: [], // غير مستخدمة في v2
  DEPOSITED: ["BOUNCED", "CANCELLED"],
  ENDORSED: ["BOUNCED", "CANCELLED"],
  COLLECTED: ["BOUNCED", "CANCELLED"], // نهاية الدورة، لكن يمكن ارتداده لاحقاً
  SETTLED: [], // غير مستخدمة في v2
  BOUNCED: ["REGISTERED", "CANCELLED"], // إعادة تسجيل (إعادة تقديم)
  CANCELLED: [],
};

/** هل الشيك يتبع النموذج الجديد v2 (وارد + نسخة ≥ 2)؟ */
function نموذج_جديد(شيك: { direction: string; accountingVersion?: number | null }): boolean {
  return (شيك.accountingVersion ?? 1) >= 2 && شيك.direction === "INCOMING";
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

export async function إنشاء_شيك(مدخلات: unknown): Promise<نتيجة<{ id: number }>> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_شيك.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  const تاريخ = تحليل_تاريخ(ب.تاريخ_الاستحقاق);
  if (!تاريخ) return فشل("تاريخ الاستحقاق غير صالح");

  // اسم المدين اختياري — يُشتق من «محوّل من» (اسم العميل) أو المستفيد عند تركه فارغاً
  const اسم_المدين_نهائي = ب.اسم_المدين?.trim() || ب.محول_من?.trim() || ب.المستفيد?.trim() || "—";

  const شيك = await prisma.$transaction(async (tx) => {
    const c = await tx.cheque.create({
      data: {
        drawerName: اسم_المدين_نهائي,
        amount: ب.المبلغ!,
        beneficiary: ب.المستفيد || null,
        transferredFrom: ب.محول_من || null,
        bankName: ب.اسم_البنك || null,
        dueDate: تاريخ,
        chequeNumber: ب.رقم_الشيك || null,
        direction: ب.الاتجاه,
        status: ب.الحالة,
        partyId: ب.معرف_الطرف ?? null,
        chequeBookId: ب.معرف_الدفتر ?? null,
        bookLeafNo: ب.رقم_الورقة ?? null,
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
      { id: c.id, direction: c.direction, amount: c.amount, partyId: c.partyId, chequeNumber: c.chequeNumber, drawerName: c.drawerName, status: c.status, collectedTxnId: null, partyLedgerEntryId: null, endorseLedgerEntryId: null, endorsedToId: null, accountingVersion: c.accountingVersion },
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
  const v2 = نموذج_جديد(حالي);
  const اسم_المدين_نهائي = ب.اسم_المدين?.trim() || ب.محول_من?.trim() || ب.المستفيد?.trim() || "—";

  await prisma.$transaction(async (tx) => {
    // v2: عكس أثر العميل القديم قبل التعديل ليُعاد ضبطه بالقيمة الجديدة (الحالة تتغيّر عبر «تغيير الحالة» فقط)
    if (v2 && حالي.partyLedgerEntryId) {
      await احذف_قيد_ناعم(tx, حالي.partyLedgerEntryId);
    }
    await tx.cheque.update({
      where: { id },
      data: {
        drawerName: اسم_المدين_نهائي,
        amount: ب.المبلغ!,
        beneficiary: ب.المستفيد || null,
        transferredFrom: ب.محول_من || null,
        bankName: ب.اسم_البنك || null,
        dueDate: تاريخ,
        chequeNumber: ب.رقم_الشيك || null,
        // في v2 الاتجاه والحالة ثابتان أثناء التعديل (يُغيَّران عبر تغيير الحالة)
        direction: v2 ? حالي.direction : ب.الاتجاه,
        status: v2 ? حالي.status : ب.الحالة,
        partyId: ب.معرف_الطرف ?? null,
        chequeBookId: ب.معرف_الدفتر ?? null,
        bookLeafNo: ب.رقم_الورقة ?? null,
        notes: ب.ملاحظات || null,
        ...(v2 ? { partyLedgerEntryId: null } : {}),
        ...(صورة ? { imageData: صورة, imageMime: ب.صورة_mime || null } : {}),
        ...(ب.نص_OCR ? { ocrText: ب.نص_OCR } : {}),
        updatedById: فاعل.id,
      },
    });
    if (v2) {
      // إعادة تطبيق أثر العميل بالقيمة/الطرف الجديد على نفس الحالة الحالية
      const c = await tx.cheque.findUniqueOrThrow({ where: { id } });
      await زامن_آثار_الشيك(tx, c, c.status, {}, فاعل.id);
    }
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
  سبب_الإلغاء?: string | null;
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
  if (شيك.settlesChequeId != null) return فشل("الشيك مُستخدَم في تسوية شيك صادر — أزِله من التسوية أولاً لتغيير حالته");
  const v2 = نموذج_جديد(شيك);
  const خريطة_الانتقالات = v2 ? انتقالات_v2_وارد : انتقالات_الحالة;

  // التحقق من صحة الانتقال في دورة الحياة
  if (الحالة !== شيك.status && !خريطة_الانتقالات[شيك.status].includes(الحالة)) {
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
  // v2: الإيداع يتطلّب اختيار البنك
  if (v2 && الحالة === "DEPOSITED" && !خيارات.معرف_حساب_التحصيل) {
    return فشل("اختر البنك المُودَع فيه الشيك");
  }
  // منع الازدواج: شيك (صادر) عليه دفعات تسوية لا يُصرف من البنك — v1 فقط
  if (!v2 && الحالة === "COLLECTED") {
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
      // تسجيل سبب/تاريخ الإلغاء (بدون حذف السجل)، وتفريغه عند إعادة التسجيل
      if (الحالة === "CANCELLED") {
        await tx.cheque.update({ where: { id }, data: { cancelReason: خيارات.سبب_الإلغاء?.trim() || null, cancelledAt: new Date() } });
      } else if (شيك.status === "CANCELLED") {
        await tx.cheque.update({ where: { id }, data: { cancelReason: null, cancelledAt: null } });
      }
      await تسجيل_عملية(tx, {
        المستخدم: فاعل.id,
        العملية: "UPDATE",
        نوع_الكيان: "الشيك",
        معرف_الكيان: id,
        التفاصيل: { تغيير_الحالة: الحالة, من: شيك.status, ...(خيارات.معرف_المورد_للتظهير ? { تظهير_لمورد: خيارات.معرف_المورد_للتظهير } : {}), ...(الحالة === "CANCELLED" && خيارات.سبب_الإلغاء ? { سبب_الإلغاء: خيارات.سبب_الإلغاء } : {}) },
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

  const مُسدَّد = await مُسدَّد_تسوية(prisma, id);
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

/** جلب الشيكات الواردة المتاحة لتمويل تسوية شيك صادر (غير مستخدمة، ≤ المتبقّي). */
export async function اجلب_شيكات_متاحة_للتسوية(id: number): Promise<
  نتيجة<{ المتبقّي: number; الشيكات: { id: number; المبلغ: number; الاسم: string; رقم_الشيك: string | null; اسم_البنك: string | null; تاريخ_الاستحقاق: string }[] }>
> {
  await اطلب_المستخدم();
  const شيك = await prisma.cheque.findUnique({ where: { id }, select: { amount: true, direction: true } });
  if (!شيك) return فشل("الشيك غير موجود");
  if (شيك.direction !== "OUTGOING") return فشل("التسوية للشيكات الصادرة فقط");
  const مُسدَّد = await مُسدَّد_تسوية(prisma, id);
  const متبقٍ = د(شيك.amount).minus(مُسدَّد);
  if (متبقٍ.lessThanOrEqualTo(0)) return نجح({ المتبقّي: 0, الشيكات: [] });
  const شيكات = await prisma.cheque.findMany({
    where: {
      direction: "INCOMING",
      status: { in: ["REGISTERED", "PENDING"] },
      settlesChequeId: null,
      endorseLedgerEntryId: null,
      collectedTxnId: null,
      amount: { lte: متبقٍ },
    },
    orderBy: { dueDate: "asc" },
    select: { id: true, amount: true, drawerName: true, chequeNumber: true, bankName: true, dueDate: true, party: { select: { name: true } } },
  });
  return نجح({
    المتبقّي: Number(متبقٍ),
    الشيكات: شيكات.map((ش) => ({ id: ش.id, المبلغ: Number(ش.amount), الاسم: ش.party?.name ?? ش.drawerName, رقم_الشيك: ش.chequeNumber, اسم_البنك: ش.bankName, تاريخ_الاستحقاق: ش.dueDate.toISOString() })),
  });
}

/** تمويل دفعة تسوية شيك صادر بشيك وارد — يُعلَّم الشيك الوارد مستخدَماً بلا أثر على دفتر الأستاذ. */
export async function سدّد_تسوية_بشيك(id: number, معرف_الشيك_الوارد: number): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const [صادر, وارد] = await Promise.all([
    prisma.cheque.findUnique({ where: { id } }),
    prisma.cheque.findUnique({ where: { id: معرف_الشيك_الوارد } }),
  ]);
  if (!صادر) return فشل("الشيك الصادر غير موجود");
  if (!وارد) return فشل("الشيك الوارد غير موجود");
  if (صادر.direction !== "OUTGOING") return فشل("التسوية للشيكات الصادرة فقط");
  if (صادر.collectedTxnId) return فشل("الشيك الصادر تم صرفه من البنك — لا يمكن التسوية");
  if (!(["PENDING", "SETTLED"] as ChequeStatus[]).includes(صادر.status)) {
    return فشل(`لا يمكن التسوية في الحالة الحالية (${تسمية_حالة_الشيك[صادر.status]})`);
  }
  if (وارد.direction !== "INCOMING") return فشل("اختر شيكاً وارداً");
  if (وارد.settlesChequeId) return فشل("الشيك الوارد مستخدَم بالفعل في تسوية");
  if (!(["REGISTERED", "PENDING"] as ChequeStatus[]).includes(وارد.status) || وارد.endorseLedgerEntryId != null || وارد.collectedTxnId != null) {
    return فشل("الشيك الوارد غير متاح (مظهّر/مودع/محصّل)");
  }
  const مُسدَّد = await مُسدَّد_تسوية(prisma, id);
  const متبقٍ = د(صادر.amount).minus(مُسدَّد);
  if (د(وارد.amount).greaterThan(متبقٍ.plus(0.005))) {
    return فشل(`قيمة الشيك (${د(وارد.amount).toFixed(2)}) أكبر من المتبقّي (${متبقٍ.toFixed(2)})`);
  }
  const مكتمل = مُسدَّد.plus(وارد.amount).greaterThanOrEqualTo(د(صادر.amount).minus(0.005));
  try {
    await prisma.$transaction(async (tx) => {
      await tx.cheque.update({ where: { id: معرف_الشيك_الوارد }, data: { settlesChequeId: id, status: "ENDORSED", endorsedToId: صادر.partyId ?? null, updatedById: فاعل.id } });
      if (مكتمل && صادر.status !== "SETTLED") {
        await tx.cheque.update({ where: { id }, data: { status: "SETTLED", updatedById: فاعل.id } });
      }
      await تسجيل_عملية(tx, {
        المستخدم: فاعل.id,
        العملية: "UPDATE",
        نوع_الكيان: "الشيك",
        معرف_الكيان: id,
        التفاصيل: { دفعة_تسوية_بشيك_وارد: معرف_الشيك_الوارد, قيمة: وارد.amount.toString(), مظهّرة_للمورد: صادر.partyId ?? null, ...(مكتمل ? { تمت_التسوية: true } : {}) },
      });
    });
  } catch (e) {
    return فشل(e instanceof Error ? e.message : "خطأ أثناء التسوية بالشيك");
  }
  revalidatePath("/cheques");
  return نجح(undefined, مكتمل ? "تمت التسوية بالكامل" : "تم استخدام الشيك في التسوية");
}

/** تمويل تسوية شيك صادر بعدة شيكات واردة دفعة واحدة (معاملة ذرّية). */
export async function سدّد_تسوية_بشيكات(id: number, معرفات: number[]): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const فريدة = [...new Set(معرفات.filter((n) => Number.isFinite(n)))];
  if (فريدة.length === 0) return فشل("اختر شيكاً واحداً على الأقل");
  const صادر = await prisma.cheque.findUnique({ where: { id } });
  if (!صادر) return فشل("الشيك الصادر غير موجود");
  if (صادر.direction !== "OUTGOING") return فشل("التسوية للشيكات الصادرة فقط");
  if (صادر.collectedTxnId) return فشل("الشيك الصادر تم صرفه من البنك — لا يمكن التسوية");
  if (!(["PENDING", "SETTLED"] as ChequeStatus[]).includes(صادر.status)) {
    return فشل(`لا يمكن التسوية في الحالة الحالية (${تسمية_حالة_الشيك[صادر.status]})`);
  }
  const شيكات = await prisma.cheque.findMany({ where: { id: { in: فريدة } } });
  if (شيكات.length !== فريدة.length) return فشل("بعض الشيكات غير موجودة");
  for (const و of شيكات) {
    if (و.direction !== "INCOMING") return فشل(`الشيك ${و.chequeNumber ?? و.id} ليس وارداً`);
    if (و.settlesChequeId) return فشل(`الشيك ${و.chequeNumber ?? و.id} مستخدَم بالفعل في تسوية`);
    if (!(["REGISTERED", "PENDING"] as ChequeStatus[]).includes(و.status) || و.endorseLedgerEntryId != null || و.collectedTxnId != null) {
      return فشل(`الشيك ${و.chequeNumber ?? و.id} غير متاح (مظهّر/مودع/محصّل)`);
    }
  }
  const مُسدَّد = await مُسدَّد_تسوية(prisma, id);
  const متبقٍ = د(صادر.amount).minus(مُسدَّد);
  const إجمالي_الشيكات = شيكات.reduce((س, و) => س.plus(و.amount), د(0));
  if (إجمالي_الشيكات.greaterThan(متبقٍ.plus(0.005))) {
    return فشل(`إجمالي الشيكات (${إجمالي_الشيكات.toFixed(2)}) أكبر من المتبقّي (${متبقٍ.toFixed(2)})`);
  }
  const مكتمل = مُسدَّد.plus(إجمالي_الشيكات).greaterThanOrEqualTo(د(صادر.amount).minus(0.005));
  try {
    await prisma.$transaction(async (tx) => {
      // الشيكات الواردة → «مظهّرة» للمورد (صاحب الشيك الصادر) بلا أثر على دفتر الأستاذ
      await tx.cheque.updateMany({
        where: { id: { in: فريدة } },
        data: { settlesChequeId: id, status: "ENDORSED", endorsedToId: صادر.partyId ?? null, updatedById: فاعل.id },
      });
      if (مكتمل && صادر.status !== "SETTLED") {
        await tx.cheque.update({ where: { id }, data: { status: "SETTLED", updatedById: فاعل.id } });
      }
      await تسجيل_عملية(tx, {
        المستخدم: فاعل.id,
        العملية: "UPDATE",
        نوع_الكيان: "الشيك",
        معرف_الكيان: id,
        التفاصيل: { دفعة_تسوية_بشيكات: فريدة, عدد: فريدة.length, قيمة: إجمالي_الشيكات.toString(), مظهّرة_للمورد: صادر.partyId ?? null, ...(مكتمل ? { تمت_التسوية: true } : {}) },
      });
    });
  } catch (e) {
    return فشل(e instanceof Error ? e.message : "خطأ أثناء التسوية بالشيكات");
  }
  revalidatePath("/cheques");
  return نجح(undefined, مكتمل ? "تمت التسوية بالكامل" : `تم استخدام ${فريدة.length} شيك في التسوية`);
}

/** إزالة شيك وارد من تسوية شيك صادر — يرجع الشيك للمتاح ولخزنة الشيكات، ويُرجع الصادر «تحت الصرف» إن لزم. */
export async function احذف_دفعة_شيك(معرف_الشيك_الوارد: number): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "حذف");
  const وارد = await prisma.cheque.findUnique({ where: { id: معرف_الشيك_الوارد }, select: { settlesChequeId: true, accountingVersion: true } });
  if (!وارد?.settlesChequeId) return فشل("هذا الشيك ليس مستخدَماً في تسوية");
  const معرف_الصادر = وارد.settlesChequeId;
  const حالة_الرجوع: ChequeStatus = (وارد.accountingVersion ?? 1) >= 2 ? "REGISTERED" : "PENDING";
  try {
    await prisma.$transaction(async (tx) => {
      // يرجع الشيك الوارد للمتاح: يفكّ التظهير ويعود لخزنة الشيكات
      await tx.cheque.update({ where: { id: معرف_الشيك_الوارد }, data: { settlesChequeId: null, status: حالة_الرجوع, endorsedToId: null, updatedById: فاعل.id } });
      const صادر = await tx.cheque.findUniqueOrThrow({ where: { id: معرف_الصادر } });
      const مُسدَّد_جديد = await مُسدَّد_تسوية(tx, معرف_الصادر);
      if (صادر.status === "SETTLED" && مُسدَّد_جديد.lessThan(د(صادر.amount).minus(0.005))) {
        await tx.cheque.update({ where: { id: معرف_الصادر }, data: { status: "PENDING", updatedById: فاعل.id } });
      }
      await تسجيل_عملية(tx, {
        المستخدم: فاعل.id,
        العملية: "DELETE",
        نوع_الكيان: "الشيك",
        معرف_الكيان: معرف_الصادر,
        التفاصيل: { إزالة_شيك_من_التسوية: معرف_الشيك_الوارد },
      });
    });
  } catch (e) {
    return فشل(e instanceof Error ? e.message : "خطأ أثناء الإزالة");
  }
  revalidatePath("/cheques");
  return نجح(undefined, "تم إرجاع الشيك للمتاح");
}

/**
 * سداد مركب لمورد — معاملة واحدة: نقدي/تحويل من الخزنة + تظهير شيكات واردة.
 * الإجمالي يخصم من مديونية المورد مرة واحدة (النقدي/التحويل عبر قيد مدين + الشيكات كل واحد قيد تظهير مدين).
 * الشيكات تتحوّل «مُظهَّرة للمورد» بلا حركة نقدية (لسه ما اتحصلتش).
 */
export async function سداد_مركب_لمورد(مدخلات: {
  معرف_المورد: number;
  التاريخ?: string | null;
  البيان?: string | null;
  بنود_خزنة?: { معرف_الحساب: number; معرف_حساب_فرعي?: number | null; المبلغ: string | number }[];
  شيكات?: number[];
}): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");

  const مورد = await prisma.party.findUnique({ where: { id: مدخلات.معرف_المورد } });
  if (!مورد || مورد.type !== "SUPPLIER") return فشل("المورد غير موجود");
  const تاريخ = تحليل_تاريخ(مدخلات.التاريخ ?? null) ?? new Date();

  const بنود_خزنة = (مدخلات.بنود_خزنة ?? []).filter((ب) => د(String(ب.المبلغ).replace(/,/g, "")).greaterThan(0));
  const معرفات_الشيكات = مدخلات.شيكات ?? [];
  if (بنود_خزنة.length === 0 && معرفات_الشيكات.length === 0) {
    return فشل("أضف وسيلة دفع واحدة على الأقل (نقدي/تحويل أو شيك)");
  }

  // تحقق الشيكات: واردة وقابلة للتظهير ولم تُظهَّر بعد
  const شيكات = معرفات_الشيكات.length
    ? await prisma.cheque.findMany({ where: { id: { in: معرفات_الشيكات } } })
    : [];
  for (const ش of شيكات) {
    if (ش.direction !== "INCOMING") return فشل(`الشيك ${ش.chequeNumber ?? ش.id} ليس وارداً`);
    if (!انتقالات_الحالة[ش.status].includes("ENDORSED")) {
      return فشل(`الشيك ${ش.chequeNumber ?? ش.id} لا يمكن تظهيره (حالته: ${تسمية_حالة_الشيك[ش.status]})`);
    }
  }

  const حسابات = await prisma.treasuryAccount.findMany({ select: { id: true, type: true } });
  const نوع_الحساب = new Map(حسابات.map((h) => [h.id, h.type]));
  const إجمالي_خزنة = بنود_خزنة.reduce((س, ب) => س.plus(د(String(ب.المبلغ).replace(/,/g, ""))), د(0));
  const إجمالي_شيكات = شيكات.reduce((س, ش) => س.plus(ش.amount), د(0));
  const البيان = مدخلات.البيان?.trim() || `سداد مركب — ${مورد.name}`;

  try {
    await prisma.$transaction(async (tx) => {
      // 1) الجزء النقدي/التحويل → مدين على المورد + حركات خزنة (صرف)
      if (بنود_خزنة.length > 0) {
        await أنشئ_دفعة_موزعة(tx, {
          الاتجاه: "صرف",
          معرف_الطرف: مورد.id,
          اسم_الطرف: مورد.name,
          الإجمالي: إجمالي_خزنة,
          التاريخ: تاريخ,
          البيان,
          بنود: بنود_خزنة.map((ب) => {
            const نوع = نوع_الحساب.get(ب.معرف_الحساب);
            return {
              معرف_الحساب: ب.معرف_الحساب,
              معرف_حساب_فرعي: ب.معرف_حساب_فرعي ?? null,
              طريقة_الدفع: نوع ? تسمية_حساب_الخزنة[نوع] : null,
              المبلغ: د(String(ب.المبلغ).replace(/,/g, "")),
            };
          }),
          أنشأ: فاعل.id,
        });
      }
      // 2) الشيكات → تظهير لنفس المورد (كل شيك قيد مدين مستقل، بلا خزنة)
      for (const ش of شيكات) {
        await زامن_آثار_الشيك(tx, ش, "ENDORSED", { معرف_المورد_للتظهير: مورد.id }, فاعل.id);
      }
      await تسجيل_عملية(tx, {
        المستخدم: فاعل.id,
        العملية: "CREATE",
        نوع_الكيان: "الطرف",
        معرف_الكيان: مورد.id,
        التفاصيل: {
          سداد_مركب: true,
          إجمالي: إجمالي_خزنة.plus(إجمالي_شيكات).toString(),
          نقدي_تحويل: إجمالي_خزنة.toString(),
          شيكات: شيكات.map((ش) => ش.id),
        },
      });
    }, { timeout: 30000 });
  } catch (e) {
    return فشل(e instanceof Error ? e.message : "خطأ أثناء السداد المركب");
  }

  revalidatePath("/treasury");
  revalidatePath("/cheques");
  revalidatePath(مسار_صفحة_الطرف("SUPPLIER", مورد.id));
  return نجح(undefined, `تم السداد المركب — إجمالي ${إجمالي_خزنة.plus(إجمالي_شيكات).toFixed(2)}`);
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
      const مُسدَّد_جديد = await مُسدَّد_تسوية(tx, معرف_الشيك);
      if (شيك.status === "SETTLED" && مُسدَّد_جديد.lessThan(د(شيك.amount).minus(0.005))) {
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

/** جلب دفعات تسوية شيك (للعرض في الحوار) — تشمل دفعات الخزنة والشيكات الواردة. */
export async function اجلب_دفعات_التسوية(id: number): Promise<
  نتيجة<{ الإجمالي: number; المُسدَّد: number; الدفعات: { نوع: "خزنة" | "شيك"; id: number; المبلغ: number; الطريقة: string | null; التاريخ: string; البيان: string }[] }>
> {
  await اطلب_المستخدم();
  const [شيك, دفعات, شيكات] = await Promise.all([
    prisma.cheque.findUnique({ where: { id }, select: { amount: true } }),
    prisma.treasuryTxn.findMany({
      where: { chequeId: id, deletedAt: null },
      orderBy: { id: "asc" },
      select: { id: true, amount: true, method: true, date: true, description: true },
    }),
    prisma.cheque.findMany({
      where: { settlesChequeId: id },
      orderBy: { id: "asc" },
      select: { id: true, amount: true, chequeNumber: true, bankName: true, drawerName: true, dueDate: true, party: { select: { name: true } } },
    }),
  ]);
  if (!شيك) return فشل("الشيك غير موجود");
  const دفعات_خزنة = دفعات.map((د2) => ({ نوع: "خزنة" as const, id: د2.id, المبلغ: Number(د2.amount), الطريقة: د2.method, التاريخ: د2.date.toISOString(), البيان: د2.description }));
  const دفعات_شيك = شيكات.map((ش) => ({
    نوع: "شيك" as const,
    id: ش.id,
    المبلغ: Number(ش.amount),
    الطريقة: "شيك وارد",
    التاريخ: ش.dueDate.toISOString(),
    البيان: `شيك وارد${ش.chequeNumber ? " رقم " + ش.chequeNumber : ""} — ${ش.party?.name ?? ش.drawerName}`,
  }));
  const الدفعات = [...دفعات_خزنة, ...دفعات_شيك];
  return نجح({
    الإجمالي: Number(شيك.amount),
    المُسدَّد: الدفعات.reduce((س, د2) => س + د2.المبلغ, 0),
    الدفعات,
  });
}

// ============================================================
// المرحلة 4 — توزيع الشيك (الوارد) على فواتير العميل (تتبّع فقط، بلا قيود)
// ============================================================

/** جلب فواتير عميل الشيك مع ما غُطّي منها بشيكات + التوزيع الحالي لهذا الشيك. */
export async function اجلب_فواتير_الطرف_للتوزيع(معرف_الشيك: number): Promise<
  نتيجة<{
    قيمة_الشيك: number;
    اسم_الطرف: string | null;
    الفواتير: { id: number; رقم: number | null; التاريخ: string; الإجمالي: number; مغطّى_بشيكات_أخرى: number; المخصَّص_لهذا_الشيك: number }[];
  }>
> {
  await اطلب_المستخدم();
  const شيك = await prisma.cheque.findUnique({
    where: { id: معرف_الشيك },
    select: { id: true, amount: true, direction: true, partyId: true, party: { select: { name: true } } },
  });
  if (!شيك) return فشل("الشيك غير موجود");
  if (شيك.direction !== "INCOMING") return فشل("التوزيع على الفواتير للشيكات الواردة فقط");
  if (!شيك.partyId) return فشل("اربط الشيك بعميل أولاً لتوزيعه على فواتيره");

  const [فواتير, توزيع_حالي] = await Promise.all([
    prisma.invoice.findMany({
      where: { customerId: شيك.partyId, invoiceType: "SALE" },
      orderBy: { date: "desc" },
      select: { id: true, number: true, date: true, totalAmount: true },
    }),
    prisma.chequeInvoiceAllocation.findMany({ where: { chequeId: معرف_الشيك }, select: { invoiceId: true, amount: true } }),
  ]);
  const معرفات = فواتير.map((f) => f.id);
  // ما غُطّي من فواتير هذا العميل بشيكات أخرى (غير المرتد/الملغى وغير هذا الشيك)
  const بنود_أخرى = await prisma.chequeInvoiceAllocation.findMany({
    where: { invoiceId: { in: معرفات }, chequeId: { not: معرف_الشيك }, cheque: { status: { notIn: ["BOUNCED", "CANCELLED"] } } },
    select: { invoiceId: true, amount: true },
  });
  const غطاء_آخر = new Map<number, ReturnType<typeof د>>();
  for (const ب of بنود_أخرى) غطاء_آخر.set(ب.invoiceId, (غطاء_آخر.get(ب.invoiceId) ?? د(0)).plus(ب.amount));
  const حالي = new Map(توزيع_حالي.map((ب) => [ب.invoiceId, ب.amount]));

  return نجح({
    قيمة_الشيك: Number(شيك.amount),
    اسم_الطرف: شيك.party?.name ?? null,
    الفواتير: فواتير.map((f) => ({
      id: f.id,
      رقم: f.number,
      التاريخ: f.date.toISOString(),
      الإجمالي: Number(f.totalAmount),
      مغطّى_بشيكات_أخرى: Number(غطاء_آخر.get(f.id) ?? 0),
      المخصَّص_لهذا_الشيك: Number(حالي.get(f.id) ?? 0),
    })),
  });
}

/** حفظ توزيع شيك على فواتير — يستبدل التوزيع السابق بالكامل. تتبّع فقط، بلا أثر محاسبي. */
export async function حدّد_توزيع_شيك(
  معرف_الشيك: number,
  بنود: { معرف_الفاتورة: number; المبلغ: string | number }[]
): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const شيك = await prisma.cheque.findUnique({ where: { id: معرف_الشيك }, select: { id: true, amount: true, direction: true, partyId: true } });
  if (!شيك) return فشل("الشيك غير موجود");
  if (شيك.direction !== "INCOMING") return فشل("التوزيع على الفواتير للشيكات الواردة فقط");
  if (!شيك.partyId) return فشل("اربط الشيك بعميل أولاً");

  // تنظيف البنود: مبالغ موجبة فقط
  const نظيفة = بنود
    .map((ب) => ({ معرف_الفاتورة: ب.معرف_الفاتورة, المبلغ: د(String(ب.المبلغ).replace(/,/g, "")) }))
    .filter((ب) => ب.المبلغ.greaterThan(0));

  // منع تكرار نفس الفاتورة
  const مرئية = new Set<number>();
  for (const ب of نظيفة) {
    if (مرئية.has(ب.معرف_الفاتورة)) return فشل("فاتورة مكررة في التوزيع");
    مرئية.add(ب.معرف_الفاتورة);
  }

  const إجمالي = نظيفة.reduce((س, ب) => س.plus(ب.المبلغ), د(0));
  if (إجمالي.greaterThan(د(شيك.amount).plus(0.005))) {
    return فشل(`إجمالي التوزيع (${إجمالي.toFixed(2)}) أكبر من قيمة الشيك (${د(شيك.amount).toFixed(2)})`);
  }
  // التحقق أن كل الفواتير تخص عميل الشيك
  if (نظيفة.length) {
    const فواتير = await prisma.invoice.findMany({
      where: { id: { in: نظيفة.map((ب) => ب.معرف_الفاتورة) } },
      select: { id: true, customerId: true },
    });
    const خريطة = new Map(فواتير.map((f) => [f.id, f.customerId]));
    for (const ب of نظيفة) {
      if (!خريطة.has(ب.معرف_الفاتورة)) return فشل("فاتورة غير موجودة");
      if (خريطة.get(ب.معرف_الفاتورة) !== شيك.partyId) return فشل("فاتورة لا تخص عميل الشيك");
    }
  }

  try {
    await prisma.$transaction(async (tx) => {
      await tx.chequeInvoiceAllocation.deleteMany({ where: { chequeId: معرف_الشيك } });
      if (نظيفة.length) {
        await tx.chequeInvoiceAllocation.createMany({
          data: نظيفة.map((ب) => ({ chequeId: معرف_الشيك, invoiceId: ب.معرف_الفاتورة, amount: ب.المبلغ, createdById: فاعل.id })),
        });
      }
      await تسجيل_عملية(tx, {
        المستخدم: فاعل.id,
        العملية: "UPDATE",
        نوع_الكيان: "الشيك",
        معرف_الكيان: معرف_الشيك,
        التفاصيل: { توزيع_على_فواتير: نظيفة.map((ب) => ({ فاتورة: ب.معرف_الفاتورة, مبلغ: ب.المبلغ.toString() })), إجمالي_موزَّع: إجمالي.toString() },
      });
    });
  } catch (e) {
    return فشل(e instanceof Error ? e.message : "خطأ أثناء حفظ التوزيع");
  }
  revalidatePath("/cheques");
  return نجح(undefined, "تم حفظ توزيع الشيك على الفواتير");
}

export async function حذف_شيك(id: number): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "حذف");
  const ش = await prisma.cheque.findUnique({ where: { id } });
  if (!ش) return فشل("الشيك غير موجود");
  // الملغى: أثره اتعكس بالفعل عند الإلغاء، فحذفه آمن (سجل العمليات يحتفظ بكل الحركة).
  // غير الملغى: يُمنع الحذف لو دخل معاملة مالية (مودع/مظهّر/محصّل) — التصحيح بالإلغاء أولاً.
  if (ش.status !== "CANCELLED" && دخل_معاملة_مالية(ش)) {
    return فشل("لا يمكن حذف شيك دخل معاملة مالية — ألغِه أولاً (يرجع كل أثره)، وبعدها تقدر تحذفه لو حابب");
  }

  await prisma.$transaction(async (tx) => {
    // اعكس أي أثر محاسبي متبقٍ قبل الحذف (يرجع الأرصدة). للملغى تكون كلها فارغة أصلاً.
    if (ش.partyLedgerEntryId) await احذف_قيد_ناعم(tx, ش.partyLedgerEntryId);
    if (ش.endorseLedgerEntryId) await احذف_قيد_ناعم(tx, ش.endorseLedgerEntryId);
    if (ش.collectedTxnId) await احذف_حركة_خزنة_ناعم(tx, ش.collectedTxnId);
    const دفعات_تسوية = await tx.treasuryTxn.findMany({ where: { chequeId: id, deletedAt: null }, select: { id: true } });
    for (const د of دفعات_تسوية) await احذف_حركة_خزنة_ناعم(tx, د.id);
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
  revalidatePath("/treasury");
  if (ش.partyId) {
    revalidatePath(`/customers/${ش.partyId}`);
    revalidatePath(`/suppliers/${ش.partyId}`);
  }
  if (ش.endorsedToId) revalidatePath(`/suppliers/${ش.endorsedToId}`);
  return نجح(undefined, "تم حذف الشيك");
}
