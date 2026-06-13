"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { اطلب_المستخدم } from "@/lib/session";
import { تحقق_الصلاحية } from "@/lib/authz";
import { تسجيل_عملية } from "@/lib/activity";
import { نجح, فشل, type نتيجة } from "@/lib/result";
import { تحليل_تاريخ } from "@/lib/date";
import { د } from "@/lib/decimal";
import {
  احصل_رقم_فاتورة_جديد,
  احسب_إجماليات,
  رحّل_فاتورة_للعميل,
  اعكس_قيود_الفاتورة,
} from "@/lib/invoice";
import { مخطط_فاتورة } from "@/lib/schemas/invoice";

export async function إنشاء_فاتورة(مدخلات: unknown): Promise<نتيجة<{ id: number; الرقم: number }>> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_فاتورة.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  const عميل = await prisma.party.findUnique({ where: { id: ب.معرف_العميل } });
  if (!عميل || عميل.type !== "CUSTOMER") return فشل("العميل غير موجود");
  const تاريخ = تحليل_تاريخ(ب.التاريخ) ?? new Date();
  const { إجمالي_الكمية, إجمالي_الوزن, الإجمالي_المالي, بنود_محسوبة } = احسب_إجماليات(ب.البنود);

  const فاتورة = await prisma.$transaction(async (tx) => {
    const رقم = await احصل_رقم_فاتورة_جديد(tx);
    const f = await tx.invoice.create({
      data: {
        number: رقم,
        customerId: عميل.id,
        phone: ب.الهاتف || عميل.phone,
        date: تاريخ,
        totalQty: إجمالي_الكمية,
        totalWeight: إجمالي_الوزن,
        totalAmount: الإجمالي_المالي,
        notes: ب.ملاحظات || null,
        createdById: فاعل.id,
        lines: {
          create: بنود_محسوبة.map((x) => ({
            color: x.اللون,
            qty: x._كمية,
            weight: x._وزن,
            category: x.التصنيف,
            price: x.السعر != null && x.السعر !== "" ? د(x.السعر) : null,
            lineTotal: x._مجموع,
            notes: x.ملاحظات || null,
            createdById: فاعل.id,
          })),
        },
      },
    });
    await رحّل_فاتورة_للعميل(tx, {
      معرف_الفاتورة: f.id,
      رقم_الفاتورة: رقم,
      معرف_العميل: عميل.id,
      التاريخ: تاريخ,
      القيمة: الإجمالي_المالي,
      أنشأ: فاعل.id,
    });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "CREATE",
      نوع_الكيان: "الفاتورة",
      معرف_الكيان: f.id,
      التفاصيل: { الرقم: رقم, العميل: عميل.name, الإجمالي: الإجمالي_المالي.toString() },
    });
    return f;
  });

  revalidatePath("/invoices");
  revalidatePath(`/customers/${عميل.id}`);
  return نجح({ id: فاتورة.id, الرقم: فاتورة.number }, `تم إنشاء الفاتورة رقم ${فاتورة.number}`);
}

export async function تعديل_فاتورة(id: number, مدخلات: unknown): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_فاتورة.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  const حالية = await prisma.invoice.findUnique({ where: { id } });
  if (!حالية) return فشل("الفاتورة غير موجودة");
  const عميل = await prisma.party.findUnique({ where: { id: ب.معرف_العميل } });
  if (!عميل || عميل.type !== "CUSTOMER") return فشل("العميل غير موجود");
  const تاريخ = تحليل_تاريخ(ب.التاريخ) ?? new Date();
  const { إجمالي_الكمية, إجمالي_الوزن, الإجمالي_المالي, بنود_محسوبة } = احسب_إجماليات(ب.البنود);

  await prisma.$transaction(async (tx) => {
    // عكس القيد القديم على العميل القديم
    await اعكس_قيود_الفاتورة(tx, id, حالية.customerId);
    // استبدال البنود
    await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
    await tx.invoice.update({
      where: { id },
      data: {
        customerId: عميل.id,
        phone: ب.الهاتف || عميل.phone,
        date: تاريخ,
        totalQty: إجمالي_الكمية,
        totalWeight: إجمالي_الوزن,
        totalAmount: الإجمالي_المالي,
        notes: ب.ملاحظات || null,
        updatedById: فاعل.id,
        lines: {
          create: بنود_محسوبة.map((x) => ({
            color: x.اللون,
            qty: x._كمية,
            weight: x._وزن,
            category: x.التصنيف,
            price: x.السعر != null && x.السعر !== "" ? د(x.السعر) : null,
            lineTotal: x._مجموع,
            notes: x.ملاحظات || null,
            createdById: فاعل.id,
          })),
        },
      },
    });
    // إعادة ترحيل القيد بالقيمة الجديدة على العميل (قد يكون تغيّر)
    await رحّل_فاتورة_للعميل(tx, {
      معرف_الفاتورة: id,
      رقم_الفاتورة: حالية.number,
      معرف_العميل: عميل.id,
      التاريخ: تاريخ,
      القيمة: الإجمالي_المالي,
      أنشأ: فاعل.id,
    });
    // إن تغيّر العميل، أعد حساب رصيد العميل القديم أيضاً (تم داخل اعكس_قيود)
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "UPDATE",
      نوع_الكيان: "الفاتورة",
      معرف_الكيان: id,
      التفاصيل: { الرقم: حالية.number, الإجمالي_الجديد: الإجمالي_المالي.toString() },
    });
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath(`/customers/${عميل.id}`);
  revalidatePath(`/customers/${حالية.customerId}`);
  return نجح(undefined, "تم تعديل الفاتورة وتحديث رصيد العميل");
}

export async function حذف_فاتورة(id: number): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "حذف");
  const فاتورة = await prisma.invoice.findUnique({ where: { id } });
  if (!فاتورة) return فشل("الفاتورة غير موجودة");

  await prisma.$transaction(async (tx) => {
    await اعكس_قيود_الفاتورة(tx, id, فاتورة.customerId);
    await tx.invoice.delete({ where: { id } }); // البنود Cascade
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "DELETE",
      نوع_الكيان: "الفاتورة",
      معرف_الكيان: id,
      التفاصيل: { الرقم: فاتورة.number },
    });
  });

  revalidatePath("/invoices");
  revalidatePath(`/customers/${فاتورة.customerId}`);
  return نجح(undefined, "تم حذف الفاتورة وعكس قيدها");
}

/** التصنيفات الموجودة سابقاً (لاقتراحات قائمة الاختيار) */
export async function تصنيفات_مقترحة(): Promise<string[]> {
  await اطلب_المستخدم();
  const ص = await prisma.invoiceLine.findMany({
    distinct: ["category"],
    select: { category: true },
    take: 100,
  });
  return ص.map((x) => x.category).filter(Boolean);
}
