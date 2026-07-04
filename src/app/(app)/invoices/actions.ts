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

/** يُرجع رقم الفاتورة التالي دون تعديل العدّاد (للعرض المبدئي في النموذج) */
export async function احصل_رقم_الفاتورة_التالي(): Promise<number> {
  const r = await prisma.$queryRaw<{ value: string }[]>`
    SELECT (value::int + 1)::text AS value FROM settings WHERE key = 'عداد_الفواتير'
  `;
  return r[0] ? Number(r[0].value) : 1;
}

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
    let رقم: number;
    if (ب.رقم_الفاتورة_المحدد) {
      // رقم يدوي → نستخدمه مباشرة ونحدّث العدّاد إن كان أكبر
      رقم = ب.رقم_الفاتورة_المحدد;
      await tx.$executeRaw`
        UPDATE settings SET value = ${String(رقم)}
        WHERE key = 'عداد_الفواتير' AND value::int < ${رقم}
      `;
    } else {
      رقم = await احصل_رقم_فاتورة_جديد(tx);
    }
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
            company: x.الشركة || null,
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

  // التحقق من تعارض رقم الفاتورة الجديد (إن تغيّر)
  const رقم_الجديد = ب.رقم_الفاتورة_المحدد ?? حالية.number;
  if (رقم_الجديد !== حالية.number) {
    const مكرر = await prisma.invoice.findFirst({
      where: { number: رقم_الجديد, id: { not: id } },
    });
    if (مكرر) return فشل(`رقم الفاتورة ${رقم_الجديد} مستخدم بالفعل`);
  }

  await prisma.$transaction(async (tx) => {
    // عكس القيد القديم على العميل القديم
    await اعكس_قيود_الفاتورة(tx, id, حالية.customerId);
    // استبدال البنود وتحديث الفاتورة
    await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
    await tx.invoice.update({
      where: { id },
      data: {
        number: رقم_الجديد,
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
            company: x.الشركة || null,
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
    // تحديث العدّاد إن كان الرقم الجديد أكبر
    if (رقم_الجديد !== حالية.number) {
      await tx.$executeRaw`
        UPDATE settings SET value = ${String(رقم_الجديد)}
        WHERE key = 'عداد_الفواتير' AND value::int < ${رقم_الجديد}
      `;
    }
    // إعادة ترحيل القيد بالقيمة والرقم الجديدين على العميل
    await رحّل_فاتورة_للعميل(tx, {
      معرف_الفاتورة: id,
      رقم_الفاتورة: رقم_الجديد,
      معرف_العميل: عميل.id,
      التاريخ: تاريخ,
      القيمة: الإجمالي_المالي,
      أنشأ: فاعل.id,
    });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "UPDATE",
      نوع_الكيان: "الفاتورة",
      معرف_الكيان: id,
      التفاصيل: {
        قبل: { الرقم: حالية.number },
        بعد: { الرقم: رقم_الجديد, الإجمالي: الإجمالي_المالي.toString() },
      },
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

// ─── قوائم التصنيفات والشركات (مخزنة في settings) ──────────
const مفتاح_تصنيفات = "قائمة_التصنيفات";
const مفتاح_شركات   = "قائمة_الشركات";

async function قرأ_القائمة(مفتاح: string): Promise<string[] | null> {
  const s = await prisma.setting.findUnique({ where: { key: مفتاح } });
  if (!s) return null;
  try { return JSON.parse(s.value) as string[]; } catch { return null; }
}

async function حفظ_القائمة(مفتاح: string, قائمة: string[]): Promise<void> {
  await prisma.setting.upsert({
    where:  { key: مفتاح },
    update: { value: JSON.stringify(قائمة) },
    create: { key: مفتاح, value: JSON.stringify(قائمة) },
  });
}

/**
 * يُرجع قوائم التصنيفات والشركات المخزنة في settings.
 * إن لم تكن مُهيأة بعد يقرأهما من invoice_lines ويحفظهما تلقائياً.
 */
export async function احصل_قوائم_الفواتير(): Promise<{ تصنيفات: string[]; شركات: string[] }> {
  const [تص, شر] = await Promise.all([
    قرأ_القائمة(مفتاح_تصنيفات),
    قرأ_القائمة(مفتاح_شركات),
  ]);

  // إذا كانت القائمة غير موجودة → نبذرها من البيانات الموجودة
  const [تصنيفات, شركات] = await Promise.all([
    تص !== null
      ? Promise.resolve(تص)
      : prisma.invoiceLine
          .findMany({ distinct: ["category"], select: { category: true }, take: 500 })
          .then((r) => {
            const q = r.map((x) => x.category).filter(Boolean);
            void حفظ_القائمة(مفتاح_تصنيفات, q);
            return q;
          }),
    شر !== null
      ? Promise.resolve(شر)
      : prisma.invoiceLine
          .findMany({ distinct: ["company"], select: { company: true }, where: { company: { not: null } }, take: 500 })
          .then((r) => {
            const q = r.map((x) => x.company as string).filter(Boolean);
            void حفظ_القائمة(مفتاح_شركات, q);
            return q;
          }),
  ]);

  return { تصنيفات, شركات };
}

/** تعديل اسم تصنيف في القائمة فقط (لا يُعدّل الفواتير القديمة) */
export async function عدّل_تصنيف_DB(قديم: string, جديد: string): Promise<نتيجة> {
  await اطلب_المستخدم();
  const نظيف = جديد.trim();
  if (!نظيف) return فشل("اسم التصنيف لا يمكن أن يكون فارغاً");
  const قائمة = (await قرأ_القائمة(مفتاح_تصنيفات)) ?? [];
  const محدّثة = قائمة.map((x) => (x === قديم ? نظيف : x));
  if (!محدّثة.includes(نظيف)) محدّثة.push(نظيف);
  await حفظ_القائمة(مفتاح_تصنيفات, محدّثة);
  return نجح(undefined, "تم تعديل التصنيف");
}

/** حذف تصنيف من القائمة فقط (لا يُعدّل الفواتير القديمة) */
export async function احذف_تصنيف_DB(قيمة: string): Promise<نتيجة> {
  await اطلب_المستخدم();
  const قائمة = (await قرأ_القائمة(مفتاح_تصنيفات)) ?? [];
  await حفظ_القائمة(مفتاح_تصنيفات, قائمة.filter((x) => x !== قيمة));
  return نجح(undefined, "تم الحذف");
}

/** تعديل اسم شركة في القائمة فقط (لا يُعدّل الفواتير القديمة) */
export async function عدّل_شركة_DB(قديم: string, جديد: string): Promise<نتيجة> {
  await اطلب_المستخدم();
  const نظيف = جديد.trim();
  if (!نظيف) return فشل("اسم الشركة لا يمكن أن يكون فارغاً");
  const قائمة = (await قرأ_القائمة(مفتاح_شركات)) ?? [];
  const محدّثة = قائمة.map((x) => (x === قديم ? نظيف : x));
  if (!محدّثة.includes(نظيف)) محدّثة.push(نظيف);
  await حفظ_القائمة(مفتاح_شركات, محدّثة);
  return نجح(undefined, "تم تعديل الشركة");
}

/** حذف شركة من القائمة فقط (لا يُعدّل الفواتير القديمة) */
export async function احذف_شركة_DB(قيمة: string): Promise<نتيجة> {
  await اطلب_المستخدم();
  const قائمة = (await قرأ_القائمة(مفتاح_شركات)) ?? [];
  await حفظ_القائمة(مفتاح_شركات, قائمة.filter((x) => x !== قيمة));
  return نجح(undefined, "تم الحذف");
}

/** إضافة عنصر جديد للقائمة عند إنشائه أول مرة */
export async function أضف_للقائمة_DB(نوع: "تصنيف" | "شركة", قيمة: string): Promise<void> {
  const مفتاح = نوع === "تصنيف" ? مفتاح_تصنيفات : مفتاح_شركات;
  const قائمة = (await قرأ_القائمة(مفتاح)) ?? [];
  if (!قائمة.includes(قيمة)) {
    await حفظ_القائمة(مفتاح, [...قائمة, قيمة]);
  }
}

/**
 * يُرجع آخر سعر مُستخدم لكل تصنيف مع عميل معين (من أحدث فاتورة).
 * يُستخدم لملء السعر تلقائياً عند اختيار العميل أو التصنيف.
 */
export async function احصل_آخر_أسعار(
  معرف_عميل: number,
  تصنيفات: string[]
): Promise<Record<string, string>> {
  if (!معرف_عميل || !تصنيفات.length) return {};
  const نتائج = await Promise.all(
    تصنيفات.map(async (cat) => {
      const سطر = await prisma.invoiceLine.findFirst({
        where: {
          category: cat,
          price: { not: null },
          invoice: { customerId: معرف_عميل },
        },
        orderBy: [{ invoice: { date: "desc" } }, { invoice: { id: "desc" } }],
        select: { price: true },
      });
      const قيمة = سطر?.price != null ? String(Number(سطر.price)) : null;
      return [cat, قيمة] as const;
    })
  );
  return Object.fromEntries(
    نتائج.filter((x): x is [string, string] => x[1] !== null && x[1] !== "0")
  );
}
