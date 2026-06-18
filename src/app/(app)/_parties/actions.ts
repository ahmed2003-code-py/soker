"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { اطلب_المستخدم } from "@/lib/session";
import { تحقق_الصلاحية } from "@/lib/authz";
import { تسجيل_عملية } from "@/lib/activity";
import { أضف_قيد, أعد_حساب_سلسلة_الطرف } from "@/lib/ledger";
import { سجّل_عملية_مرتبطة } from "@/app/(app)/_integration/actions";
import { اعكس_عملية_مرتبطة } from "@/lib/integration";
import { نجح, فشل, type نتيجة } from "@/lib/result";
import { تحليل_تاريخ } from "@/lib/date";
import { مسار_قائمة_الطرف, مسار_صفحة_الطرف } from "@/lib/paths";
import {
  مخطط_طرف,
  مخطط_دفعة,
  مخطط_حركة_يدوية,
} from "@/lib/schemas/party";

export async function إنشاء_طرف(مدخلات: unknown): Promise<نتيجة<{ id: number }>> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_طرف.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;

  const طرف = await prisma.$transaction(async (tx) => {
    const p = await tx.party.create({
      data: {
        name: ب.الاسم,
        phone: ب.الهاتف || null,
        address: ب.العنوان || null,
        type: ب.النوع,
        creditLimit: ب.حد_الائتمان ?? null,
        notes: ب.ملاحظات || null,
        balance: 0,
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

  await prisma.$transaction(async (tx) => {
    await tx.party.update({
      where: { id },
      data: {
        name: ب.الاسم,
        phone: ب.الهاتف || null,
        address: ب.العنوان || null,
        type: ب.النوع,
        creditLimit: ب.حد_الائتمان ?? null,
        notes: ب.ملاحظات || null,
        updatedById: فاعل.id,
      },
    });
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

/** حذف مجموعة حركات يدوية دفعةً واحدة */
export async function حذف_حركات_متعددة(ids: number[]): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "حذف");
  if (!ids.length) return فشل("لم تُحدد أي حركات");

  const قيود = await prisma.ledgerEntry.findMany({
    where: { id: { in: ids } },
    include: { party: true },
  });
  if (قيود.length === 0) return فشل("لم يُعثر على الحركات");

  // تحقق: لا يوجد قيد مرتبط بفاتورة أو خزنة
  const مرتبطة = قيود.filter((ق) => ق.invoiceId || ق.treasuryTxnId);
  if (مرتبطة.length > 0)
    return فشل(`${مرتبطة.length} حركة مرتبطة بفاتورة/خزنة لا يمكن حذفها`);

  const معرفات_الأطراف = [...new Set(قيود.map((ق) => ق.partyId))];
  const نوع_الطرف = قيود[0].party.type;

  await prisma.$transaction(async (tx) => {
    await tx.ledgerEntry.deleteMany({ where: { id: { in: ids } } });
    for (const معرف of معرفات_الأطراف) {
      await أعد_حساب_سلسلة_الطرف(tx, معرف);
    }
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "DELETE",
      نوع_الكيان: "حركة_الحساب",
      معرف_الكيان: ids[0],
      التفاصيل: { عدد_المحذوفة: ids.length, المعرفات: ids },
    });
  });
  for (const معرف of معرفات_الأطراف) {
    revalidatePath(مسار_صفحة_الطرف(نوع_الطرف, معرف));
  }
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

/** حذف حركة حساب (يدوية/دفعة) مع إعادة حساب سلسلة الطرف */
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
