"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { اطلب_المستخدم } from "@/lib/session";
import { تحقق_الصلاحية } from "@/lib/authz";
import { تسجيل_عملية } from "@/lib/activity";
import { أضف_قيد, أعد_حساب_سلسلة_الطرف } from "@/lib/ledger";
import { سجّل_عملية_مرتبطة } from "@/app/(app)/_integration/actions";
import { اعكس_عملية_مرتبطة, حذف_دفع_مباشر } from "@/lib/integration";
import { اعكس_قيود_الفاتورة } from "@/lib/invoice";
import { نجح, فشل, type نتيجة } from "@/lib/result";
import { تحليل_تاريخ } from "@/lib/date";
import { مسار_قائمة_الطرف, مسار_صفحة_الطرف } from "@/lib/paths";
import {
  مخطط_طرف,
  مخطط_دفعة,
  مخطط_حركة_يدوية,
} from "@/lib/schemas/party";


/** تعيين الرصيد الابتدائي للطرف وإعادة حساب السلسلة */
export async function تعديل_الرصيد_الابتدائي(معرف_الطرف: number, رصيد_جديد: string): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const طرف = await prisma.party.findUnique({ where: { id: معرف_الطرف } });
  if (!طرف) return فشل("الطرف غير موجود");

  const قيمة = isNaN(Number(رصيد_جديد)) ? "0" : String(Number(رصيد_جديد));

  await prisma.$transaction(async (tx) => {
    await tx.party.update({
      where: { id: معرف_الطرف },
      data: { openingBalance: قيمة, updatedById: فاعل.id },
    });
    await أعد_حساب_سلسلة_الطرف(tx, معرف_الطرف);
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "UPDATE",
      نوع_الكيان: "الطرف",
      معرف_الكيان: معرف_الطرف,
      التفاصيل: {
        تغيير: "الرصيد_الابتدائي",
        قبل: String(طرف.openingBalance),
        بعد: قيمة,
      },
    });
  });

  revalidatePath(مسار_صفحة_الطرف(طرف.type, معرف_الطرف));
  return نجح(undefined, "تم تحديث الرصيد الابتدائي وإعادة حساب الرصيد");
}

export async function إنشاء_طرف(مدخلات: unknown): Promise<نتيجة<{ id: number }>> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_طرف.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;

  const طرف = await prisma.$transaction(async (tx) => {
    const أرقام = (ب.أرقام_الهواتف ?? []).filter((h) => h.رقم.trim());
    const p = await tx.party.create({
      data: {
        name: ب.الاسم,
        phone: أرقام[0]?.رقم || ب.الهاتف || null,
        phones: أرقام as object[],
        address: ب.العنوان || null,
        type: ب.النوع,
        creditLimit: ب.حد_الائتمان ?? null,
        openingBalance: ب.رصيد_ابتدائي ?? "0",
        balance: ب.رصيد_ابتدائي ?? "0",
        notes: ب.ملاحظات || null,
        createdById: فاعل.id,
      },
    });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "CREATE",
      نوع_الكيان: "الطرف",
      معرف_الكيان: p.id,
      التفاصيل: { الاسم: ب.الاسم, النوع: ب.النوع },
    });
    return p;
  });

  revalidatePath(مسار_قائمة_الطرف(ب.النوع));
  return نجح({ id: طرف.id }, "تمت إضافة الطرف");
}

export async function تعديل_طرف(id: number, مدخلات: unknown): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_طرف.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  const حالي = await prisma.party.findUnique({ where: { id } });
  if (!حالي) return فشل("الطرف غير موجود");

  const رصيد_ابتدائي_تغيّر = ب.رصيد_ابتدائي !== undefined &&
    Number(ب.رصيد_ابتدائي) !== Number(حالي.openingBalance);

  await prisma.$transaction(async (tx) => {
    const أرقام = (ب.أرقام_الهواتف ?? []).filter((h) => h.رقم.trim());
    await tx.party.update({
      where: { id },
      data: {
        name: ب.الاسم,
        phone: أرقام[0]?.رقم || ب.الهاتف || null,
        phones: أرقام as object[],
        address: ب.العنوان || null,
        type: ب.النوع,
        creditLimit: ب.حد_الائتمان ?? null,
        openingBalance: ب.رصيد_ابتدائي ?? حالي.openingBalance,
        notes: ب.ملاحظات || null,
        updatedById: فاعل.id,
      },
    });
    // لو تغيّر الرصيد الابتدائي → أعد حساب سلسلة الحركات كاملاً
    if (رصيد_ابتدائي_تغيّر) {
      await أعد_حساب_سلسلة_الطرف(tx, id);
    }
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "UPDATE",
      نوع_الكيان: "الطرف",
      معرف_الكيان: id,
      التفاصيل: { قبل: { الاسم: حالي.name }, بعد: { الاسم: ب.الاسم } },
    });
  });
  revalidatePath(مسار_قائمة_الطرف(ب.النوع));
  revalidatePath(مسار_صفحة_الطرف(ب.النوع, id));
  return نجح(undefined, "تم حفظ التعديلات");
}

/**
 * تحويل حساب مؤقت إلى عميل دائم — يحافظ على كل الفواتير والحركات والرصيد.
 * التحويل = رفع علم isTemporary وإلغاء الأرشفة على نفس السجل، فتبقى كل الروابط كما هي.
 */
export async function حوّل_مؤقت_لدائم(
  id: number,
  مدخلات: unknown
): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const حالي = await prisma.party.findUnique({ where: { id } });
  if (!حالي) return فشل("الطرف غير موجود");
  if (!حالي.isTemporary) return فشل("هذا العميل دائم بالفعل");
  const t = مخطط_طرف.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  if (ب.النوع !== "CUSTOMER") return فشل("الحساب المؤقت يُحوَّل إلى عميل فقط");

  await prisma.$transaction(async (tx) => {
    const أرقام = (ب.أرقام_الهواتف ?? []).filter((h) => h.رقم.trim());
    await tx.party.update({
      where: { id },
      data: {
        name: ب.الاسم,
        phone: أرقام[0]?.رقم || ب.الهاتف || null,
        phones: أرقام as object[],
        address: ب.العنوان || null,
        creditLimit: ب.حد_الائتمان ?? null,
        notes: ب.ملاحظات || null,
        isTemporary: false,
        archivedAt: null,
        updatedById: فاعل.id,
      },
    });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "UPDATE",
      نوع_الكيان: "الطرف",
      معرف_الكيان: id,
      التفاصيل: { تحويل: "مؤقت→دائم", الاسم: ب.الاسم },
    });
  });

  revalidatePath(مسار_قائمة_الطرف("CUSTOMER"));
  revalidatePath(مسار_صفحة_الطرف("CUSTOMER", id));
  return نجح(undefined, "تم تحويل الحساب المؤقت إلى عميل دائم");
}

export async function حذف_طرف(id: number): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "حذف");
  const طرف = await prisma.party.findUnique({
    where: { id },
    include: { _count: { select: { ledgerEntries: true, invoices: true } } },
  });
  if (!طرف) return فشل("الطرف غير موجود");
  if (طرف._count.ledgerEntries > 0 || طرف._count.invoices > 0) {
    return فشل("لا يمكن حذف طرف له حركات أو فواتير. يمكنك تعطيله بدلاً من ذلك.");
  }
  await prisma.$transaction(async (tx) => {
    await tx.party.delete({ where: { id } });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "DELETE",
      نوع_الكيان: "الطرف",
      معرف_الكيان: id,
      التفاصيل: { الاسم: طرف.name },
    });
  });
  revalidatePath(مسار_قائمة_الطرف(طرف.type));
  return نجح(undefined, "تم حذف الطرف");
}

/**
 * تسجيل دفعة — يفوّض الآن إلى الخدمة الموحّدة (المرحلة 9):
 * يربط الجانبين ذرّياً (خزنة + دفتر أستاذ الطرف) دون تكرار المنطق.
 * عميل → تحصيل (إيراد + دائن). مورد → صرف (مصروف + مدين).
 */
export async function سجل_دفعة(
  مدخلات: unknown
): Promise<نتيجة<{ معرف_حركة_الخزنة: number }>> {
  const r = await سجّل_عملية_مرتبطة(مدخلات);
  if (r.نجاح) {
    const ب = مخطط_دفعة.safeParse(مدخلات);
    if (ب.success) {
      const طرف = await prisma.party.findUnique({ where: { id: ب.data.معرف_الطرف } });
      if (طرف) revalidatePath(مسار_صفحة_الطرف(طرف.type, طرف.id));
    }
  }
  return r;
}

/** حركة يدوية (رصيد افتتاحي / تسوية) — مدين أو دائن مباشرة */
export async function أضف_حركة_يدوية(مدخلات: unknown): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_حركة_يدوية.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  const طرف = await prisma.party.findUnique({ where: { id: ب.معرف_الطرف } });
  if (!طرف) return فشل("الطرف غير موجود");
  if (Number(ب.مدين) === 0 && Number(ب.دائن) === 0)
    return فشل("أدخل قيمة في مدين أو دائن");
  const تاريخ = تحليل_تاريخ(ب.التاريخ) ?? new Date();

  await prisma.$transaction(async (tx) => {
    const قيد = await أضف_قيد(tx, {
      معرف_الطرف: طرف.id,
      التاريخ: تاريخ,
      البيان: ب.البيان,
      مدين: ب.مدين!,
      دائن: ب.دائن!,
      أنشأ: فاعل.id,
    });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "CREATE",
      نوع_الكيان: "حركة_الحساب",
      معرف_الكيان: قيد.id,
      التفاصيل: { يدوية: true, مدين: ب.مدين, دائن: ب.دائن, البيان: ب.البيان },
    });
  });
  revalidatePath(مسار_صفحة_الطرف(طرف.type, طرف.id));
  return نجح(undefined, "تمت إضافة الحركة");
}

/** تعديل حركة حساب يدوية (لا تكون مرتبطة بفاتورة أو خزنة) */
export async function تعديل_حركة(
  id: number,
  مدخلات: unknown
): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_حركة_يدوية.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  const قيد = await prisma.ledgerEntry.findUnique({
    where: { id },
    include: { party: true },
  });
  if (!قيد) return فشل("الحركة غير موجودة");
  if (قيد.invoiceId)
    return فشل("هذه الحركة مرتبطة بفاتورة — عدّل الفاتورة بدلاً من ذلك");
  if (قيد.treasuryTxnId)
    return فشل("هذه الحركة مرتبطة بالخزنة — عدّلها من الخزنة");
  const تاريخ = تحليل_تاريخ(ب.التاريخ) ?? new Date();

  await prisma.$transaction(async (tx) => {
    await tx.ledgerEntry.update({
      where: { id },
      data: {
        date: تاريخ,
        description: ب.البيان,
        debit: ب.مدين ?? "0",
        credit: ب.دائن ?? "0",
        updatedById: فاعل.id,
      },
    });
    await أعد_حساب_سلسلة_الطرف(tx, قيد.partyId);
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "UPDATE",
      نوع_الكيان: "حركة_الحساب",
      معرف_الكيان: id,
      التفاصيل: {
        قبل: { مدين: قيد.debit, دائن: قيد.credit, البيان: قيد.description },
        بعد: { مدين: ب.مدين, دائن: ب.دائن, البيان: ب.البيان },
      },
    });
  });
  revalidatePath(مسار_صفحة_الطرف(قيد.party.type, قيد.partyId));
  return نجح(undefined, "تم تعديل الحركة وإعادة حساب الرصيد");
}

/** حذف مجموعة حركات مختلطة (يدوية + مرتبطة بخزنة + مرتبطة بفاتورة) */
export async function حذف_حركات_مختلطة(ids: number[]): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "حذف");
  if (!ids.length) return فشل("لم تُحدد أي حركات");

  const قيود = await prisma.ledgerEntry.findMany({
    where: { id: { in: ids } },
    include: { party: { select: { type: true } } },
  });
  if (قيود.length === 0) return فشل("لم يُعثر على الحركات");

  const نوع_الطرف = قيود[0].party.type;
  const معرفات_الأطراف = [...new Set(قيود.map((ق) => ق.partyId))];

  // تجميع حسب النوع
  const معرفات_الفواتير = [...new Set(
    قيود.filter((ق) => ق.invoiceId).map((ق) => ق.invoiceId!)
  )];
  const معرفات_الخزنة = [...new Set(
    قيود.filter((ق) => ق.treasuryTxnId && !ق.invoiceId).map((ق) => ق.treasuryTxnId!)
  )];
  const معرفات_دفع_مباشر = [...new Set(
    قيود.filter((ق) => ق.directPaymentId && !ق.invoiceId && !ق.treasuryTxnId)
      .map((ق) => ق.directPaymentId!)
  )];
  const يدوية_ids = قيود
    .filter((ق) => !ق.invoiceId && !ق.treasuryTxnId && !ق.directPaymentId)
    .map((ق) => ق.id);

  await prisma.$transaction(async (tx) => {
    // فواتير → عكس قيودها ثم حذف الفاتورة (البنود تُحذف cascade)
    for (const invoiceId of معرفات_الفواتير) {
      const فاتورة = await tx.invoice.findUnique({ where: { id: invoiceId } });
      if (!فاتورة) continue;
      await اعكس_قيود_الفاتورة(tx, invoiceId, فاتورة.customerId);
      await tx.invoice.delete({ where: { id: invoiceId } });
    }

    // خزنة → عكس كامل (يحذف القيد + حركة الخزنة + يعيد الحساب)
    for (const خزنة_id of معرفات_الخزنة) {
      await اعكس_عملية_مرتبطة(tx, خزنة_id);
    }

    // دفع مباشر → حذف ثلاثي (قيد عميل + قيد مورد + خزنة)
    for (const dpId of معرفات_دفع_مباشر) {
      await حذف_دفع_مباشر(tx, dpId);
    }

    // يدوية → حذف مباشر + إعادة حساب
    if (يدوية_ids.length > 0) {
      await tx.ledgerEntry.deleteMany({ where: { id: { in: يدوية_ids } } });
      for (const معرف of معرفات_الأطراف) {
        await أعد_حساب_سلسلة_الطرف(tx, معرف);
      }
    }

    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "DELETE",
      نوع_الكيان: "حركة_الحساب",
      معرف_الكيان: ids[0],
      التفاصيل: { عدد_المحذوفة: ids.length, المعرفات: ids },
    });
  }, { timeout: 30000, maxWait: 10000 });

  for (const معرف of معرفات_الأطراف) {
    revalidatePath(مسار_صفحة_الطرف(نوع_الطرف, معرف));
  }
  if (معرفات_الفواتير.length > 0) revalidatePath("/invoices");
  return نجح(undefined, `تم حذف ${ids.length} حركة وإعادة حساب الأرصدة`);
}

/** حذف حركة مرتبطة بخزنة — يعكس حركة الخزنة وقيد الأستاذ معاً */
export async function حذف_حركة_مرتبطة_بخزنة(id: number): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "حذف");
  const قيد = await prisma.ledgerEntry.findUnique({
    where: { id },
    include: { party: true },
  });
  if (!قيد) return فشل("الحركة غير موجودة");
  if (!قيد.treasuryTxnId) return فشل("هذه الحركة ليست مرتبطة بالخزنة");

  const معرف_خزنة = قيد.treasuryTxnId;
  await prisma.$transaction(async (tx) => {
    await اعكس_عملية_مرتبطة(tx, معرف_خزنة);
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "DELETE",
      نوع_الكيان: "حركة_الحساب",
      معرف_الكيان: id,
      التفاصيل: { مرتبط_بخزنة: معرف_خزنة, مدين: قيد.debit, دائن: قيد.credit, البيان: قيد.description },
    });
  });
  revalidatePath(مسار_صفحة_الطرف(قيد.party.type, قيد.partyId));
  return نجح(undefined, "تم حذف الحركة وعكسها من الخزنة");
}

/** حذف حركة حساب (يدوية/دفعة/دفع مباشر) مع إعادة حساب سلسلة الطرف */
export async function حذف_حركة(id: number): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "حذف");
  const قيد = await prisma.ledgerEntry.findUnique({
    where: { id },
    include: { party: true },
  });
  if (!قيد) return فشل("الحركة غير موجودة");
  if (قيد.invoiceId)
    return فشل("هذه الحركة مرتبطة بفاتورة — عدّل/احذف الفاتورة بدلاً من ذلك");
  if (قيد.treasuryTxnId)
    return فشل("هذه الحركة مرتبطة بحركة خزنة — تُدار من التكامل (المرحلة 9)");

  // ─── دفع مباشر: نعكس العملية الثلاثية كاملة ─────────────────────────────
  if (قيد.directPaymentId) {
    const معرف_الدفع = قيد.directPaymentId;
    const قيود_كل = await prisma.ledgerEntry.findMany({
      where: { directPaymentId: معرف_الدفع, deletedAt: null },
      include: { party: { select: { type: true, id: true } } },
    });
    await prisma.$transaction(async (tx) => {
      await حذف_دفع_مباشر(tx, معرف_الدفع);
      await تسجيل_عملية(tx, {
        المستخدم: فاعل.id,
        العملية: "DELETE",
        نوع_الكيان: "دفع_مباشر",
        معرف_الكيان: معرف_الدفع,
        التفاصيل: { مدين: قيد.debit, دائن: قيد.credit, البيان: قيد.description, من_حساب: true },
      });
    }, { timeout: 30000 });
    revalidatePath("/treasury");
    for (const ق of قيود_كل) revalidatePath(مسار_صفحة_الطرف(ق.party.type, ق.partyId));
    return نجح(undefined, "تم حذف الدفع المباشر وعكسه من جميع الأطراف والخزنة");
  }

  await prisma.$transaction(async (tx) => {
    await tx.ledgerEntry.delete({ where: { id } });
    await أعد_حساب_سلسلة_الطرف(tx, قيد.partyId);
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "DELETE",
      نوع_الكيان: "حركة_الحساب",
      معرف_الكيان: id,
      التفاصيل: { مدين: قيد.debit, دائن: قيد.credit, البيان: قيد.description },
    });
  });
  revalidatePath(مسار_صفحة_الطرف(قيد.party.type, قيد.partyId));
  return نجح(undefined, "تم حذف الحركة وإعادة حساب الرصيد");
}
