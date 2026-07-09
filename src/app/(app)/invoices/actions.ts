"use server";
import { revalidatePath } from "next/cache";
import { TxnKind } from "@prisma/client";
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
  رحّل_مرتجع_للعميل,
  رحّل_فاتورة_للمورد,
  اعكس_قيود_الفاتورة,
} from "@/lib/invoice";
import { أنشئ_عملية_مرتبطة } from "@/lib/integration";
import { أضف_حركة_خزنة, احذف_حركة_خزنة_ناعم } from "@/lib/treasury";
import { مخطط_فاتورة } from "@/lib/schemas/invoice";

/** يُرجع رقم الفاتورة التالي دون تعديل العدّاد (للعرض المبدئي في النموذج) */
export async function احصل_رقم_الفاتورة_التالي(): Promise<number> {
  const r = await prisma.$queryRaw<{ max: number | null }[]>`
    SELECT MAX(number) AS max FROM invoices
  `;
  return (r[0]?.max ?? 0) + 1;
}

export async function إنشاء_فاتورة(مدخلات: unknown): Promise<نتيجة<{ id: number; الرقم: number }>> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_فاتورة.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;

  const أنواع_المورد = ["PURCHASE", "SUPPLIER_RETURN"];
  const هو_مورد = أنواع_المورد.includes(ب.نوع_الفاتورة);

  // جلب الطرف (إن وُجد)
  const طرف = ب.معرف_العميل
    ? await prisma.party.findUnique({ where: { id: ب.معرف_العميل } })
    : null;
  if (ب.معرف_العميل && !طرف) return فشل("الطرف غير موجود");

  // التحقق من تطابق نوع الفاتورة مع نوع الطرف
  if (طرف) {
    if (!هو_مورد && طرف.type !== "CUSTOMER") return فشل("هذا النوع من الفواتير يتطلب اختيار عميل");
    if (هو_مورد && طرف.type !== "SUPPLIER") return فشل("هذا النوع من الفواتير يتطلب اختيار مورد");
  }

  // العميل الزائر فقط في فواتير البيع + يجب أن يكون معه تحصيل فوري
  if (!طرف && هو_مورد) return فشل("فواتير المورد تتطلب اختيار مورد مسجّل");
  if (!طرف && !ب.الدفعة) return فشل("العميل الزائر يتطلب تحصيل فوري — أضف الدفعة");

  const تاريخ = تحليل_تاريخ(ب.التاريخ) ?? new Date();
  const { إجمالي_الكمية, إجمالي_الوزن, الإجمالي_المالي, إجمالي_المبيعات, إجمالي_المرتجعات, بنود_محسوبة } =
    احسب_إجماليات(ب.البنود);

  const فاتورة = await prisma.$transaction(async (tx) => {
    let رقم: number;
    if (ب.رقم_الفاتورة_المحدد) {
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
        invoiceType: ب.نوع_الفاتورة,
        externalRef: ب.مرجع_خارجي || null,
        customerId: طرف?.id ?? null,
        guestName: !طرف ? (ب.اسم_الزائر?.trim() || null) : null,
        phone: ب.الهاتف || طرف?.phone,
        date: تاريخ,
        totalQty: إجمالي_الكمية,
        totalWeight: إجمالي_الوزن,
        totalAmount: الإجمالي_المالي, // صافي = المبيعات − المرتجعات
        notes: ب.ملاحظات || null,
        shareToken: crypto.randomUUID(),
        createdById: فاعل.id,
        lines: {
          create: بنود_محسوبة.map((x) => ({
            lineType: x.نوع_البند ?? "SALE",
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

    // ترحيل القيود على حساب الطرف
    if (هو_مورد && طرف) {
      await رحّل_فاتورة_للمورد(tx, {
        معرف_الفاتورة: f.id,
        رقم_الفاتورة: رقم,
        مرجع_خارجي: ب.مرجع_خارجي || null,
        معرف_المورد: طرف.id,
        التاريخ: تاريخ,
        القيمة: الإجمالي_المالي,
        النوع: ب.نوع_الفاتورة as "PURCHASE" | "SUPPLIER_RETURN",
        أنشأ: فاعل.id,
      });
    } else if (طرف) {
      // عميل مسجّل — مدين للمبيعات + دائن للمرتجعات
      if (إجمالي_المبيعات.greaterThan(0)) {
        await رحّل_فاتورة_للعميل(tx, {
          معرف_الفاتورة: f.id,
          رقم_الفاتورة: رقم,
          معرف_العميل: طرف.id,
          التاريخ: تاريخ,
          القيمة: إجمالي_المبيعات,
          أنشأ: فاعل.id,
        });
      }
      if (إجمالي_المرتجعات.greaterThan(0)) {
        await رحّل_مرتجع_للعميل(tx, {
          معرف_الفاتورة: f.id,
          رقم_الفاتورة: رقم,
          معرف_العميل: طرف.id,
          التاريخ: تاريخ,
          القيمة: إجمالي_المرتجعات,
          أنشأ: فاعل.id,
        });
      }
    }
    // عميل زائر: لا قيود على دفتر الأستاذ — فقط حركة خزنة أدناه

    // دفعة فورية مع الفاتورة
    if (ب.الدفعة) {
      if (طرف) {
        // طرف مسجّل → عملية مرتبطة بدفتر الأستاذ
        const اتجاه_الدفعة = ب.نوع_الفاتورة === "PURCHASE" ? "صرف" : "تحصيل";
        const بيان_الدفعة = ب.الدفعة.ملاحظات ||
          (اتجاه_الدفعة === "صرف"
            ? `دفع فاتورة مورد رقم ${ب.مرجع_خارجي || رقم} — ${طرف.name}`
            : `تحصيل فاتورة رقم ${رقم} — ${طرف.name}`);
        await أنشئ_عملية_مرتبطة(tx, {
          الاتجاه: اتجاه_الدفعة,
          معرف_الطرف: طرف.id,
          اسم_الطرف: طرف.name,
          المبلغ: د(ب.الدفعة.المبلغ!),
          التاريخ: تاريخ,
          معرف_الحساب: ب.الدفعة.معرف_الحساب,
          معرف_حساب_فرعي: ب.الدفعة.معرف_حساب_فرعي ?? null,
          رقم_الفاتورة: String(رقم),
          معرف_الفاتورة: f.id,
          البيان: بيان_الدفعة,
          أنشأ: فاعل.id,
        });
      } else {
        // عميل زائر → تحصيل مباشر في الخزنة (بلا قيد على دفتر الأستاذ)
        const بيان_الدفعة = ب.الدفعة.ملاحظات ||
          `بيع نقدي رقم ${رقم}${ب.اسم_الزائر ? ` — ${ب.اسم_الزائر}` : ""}`;
        await أضف_حركة_خزنة(tx, {
          التاريخ: تاريخ,
          النوع: TxnKind.INCOME,
          المبلغ: د(ب.الدفعة.المبلغ!),
          معرف_الحساب: ب.الدفعة.معرف_الحساب,
          معرف_حساب_فرعي: ب.الدفعة.معرف_حساب_فرعي ?? null,
          البيان: بيان_الدفعة,
          معرف_الطرف: null,
          اسم_الطرف_الخارجي: ب.اسم_الزائر || null,
          معرف_الفاتورة: f.id,
          أنشأ: فاعل.id,
        });
      }
    }

    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "CREATE",
      نوع_الكيان: "الفاتورة",
      معرف_الكيان: f.id,
      التفاصيل: {
        الرقم: رقم,
        النوع: ب.نوع_الفاتورة,
        الطرف: طرف?.name ?? (ب.اسم_الزائر || "عميل زائر"),
        الإجمالي: الإجمالي_المالي.toString(),
        ...(ب.الدفعة ? { دفعة: ب.الدفعة.المبلغ } : {}),
      },
    });
    return f;
  });

  revalidatePath("/invoices");
  if (طرف) {
    if (هو_مورد) revalidatePath(`/suppliers/${طرف.id}`);
    else revalidatePath(`/customers/${طرف.id}`);
  }
  if (ب.الدفعة) revalidatePath("/treasury");
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

  const أنواع_المورد_ت = ["PURCHASE", "SUPPLIER_RETURN"];
  const هو_مورد = أنواع_المورد_ت.includes(ب.نوع_الفاتورة);

  const طرف = ب.معرف_العميل
    ? await prisma.party.findUnique({ where: { id: ب.معرف_العميل } })
    : null;
  if (ب.معرف_العميل && !طرف) return فشل("الطرف غير موجود");
  if (طرف) {
    if (!هو_مورد && طرف.type !== "CUSTOMER") return فشل("هذا النوع يتطلب اختيار عميل");
    if (هو_مورد && طرف.type !== "SUPPLIER") return فشل("هذا النوع يتطلب اختيار مورد");
  }
  if (!طرف && هو_مورد) return فشل("فواتير المورد تتطلب اختيار مورد مسجّل");
  if (!طرف && !ب.الدفعة) return فشل("العميل الزائر يتطلب تحصيل فوري");

  const تاريخ = تحليل_تاريخ(ب.التاريخ) ?? new Date();
  const { إجمالي_الكمية, إجمالي_الوزن, الإجمالي_المالي, إجمالي_المبيعات, إجمالي_المرتجعات, بنود_محسوبة } =
    احسب_إجماليات(ب.البنود);

  const رقم_الجديد = ب.رقم_الفاتورة_المحدد ?? حالية.number;
  if (رقم_الجديد !== حالية.number) {
    const مكرر = await prisma.invoice.findFirst({
      where: { number: رقم_الجديد, id: { not: id } },
    });
    if (مكرر) return فشل(`رقم الفاتورة ${رقم_الجديد} مستخدم بالفعل`);
  }

  await prisma.$transaction(async (tx) => {
    // عكس حركات الخزنة المرتبطة بالفاتورة القديمة (دفعات + مبيعات نقدية)
    const حركات_قديمة = await tx.treasuryTxn.findMany({
      where: { invoiceId: id, deletedAt: null },
      select: { id: true },
    });
    for (const ح of حركات_قديمة) {
      await احذف_حركة_خزنة_ناعم(tx, ح.id);
    }
    await اعكس_قيود_الفاتورة(tx, id, حالية.customerId);
    await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
    await tx.invoice.update({
      where: { id },
      data: {
        number: رقم_الجديد,
        invoiceType: ب.نوع_الفاتورة,
        externalRef: ب.مرجع_خارجي || null,
        customerId: طرف?.id ?? null,
        guestName: !طرف ? (ب.اسم_الزائر?.trim() || null) : null,
        phone: ب.الهاتف || طرف?.phone,
        date: تاريخ,
        totalQty: إجمالي_الكمية,
        totalWeight: إجمالي_الوزن,
        totalAmount: الإجمالي_المالي,
        notes: ب.ملاحظات || null,
        updatedById: فاعل.id,
        lines: {
          create: بنود_محسوبة.map((x) => ({
            lineType: x.نوع_البند ?? "SALE",
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
    if (رقم_الجديد !== حالية.number) {
      await tx.$executeRaw`
        UPDATE settings SET value = ${String(رقم_الجديد)}
        WHERE key = 'عداد_الفواتير' AND value::int < ${رقم_الجديد}
      `;
    }

    if (هو_مورد && طرف) {
      await رحّل_فاتورة_للمورد(tx, {
        معرف_الفاتورة: id,
        رقم_الفاتورة: رقم_الجديد,
        مرجع_خارجي: ب.مرجع_خارجي || null,
        معرف_المورد: طرف.id,
        التاريخ: تاريخ,
        القيمة: الإجمالي_المالي,
        النوع: ب.نوع_الفاتورة as "PURCHASE" | "SUPPLIER_RETURN",
        أنشأ: فاعل.id,
      });
    } else if (طرف) {
      if (إجمالي_المبيعات.greaterThan(0)) {
        await رحّل_فاتورة_للعميل(tx, {
          معرف_الفاتورة: id,
          رقم_الفاتورة: رقم_الجديد,
          معرف_العميل: طرف.id,
          التاريخ: تاريخ,
          القيمة: إجمالي_المبيعات,
          أنشأ: فاعل.id,
        });
      }
      if (إجمالي_المرتجعات.greaterThan(0)) {
        await رحّل_مرتجع_للعميل(tx, {
          معرف_الفاتورة: id,
          رقم_الفاتورة: رقم_الجديد,
          معرف_العميل: طرف.id,
          التاريخ: تاريخ,
          القيمة: إجمالي_المرتجعات,
          أنشأ: فاعل.id,
        });
      }
    }

    if (ب.الدفعة) {
      if (طرف) {
        const اتجاه_الدفعة = ب.نوع_الفاتورة === "PURCHASE" ? "صرف" : "تحصيل";
        const بيان_الدفعة = ب.الدفعة.ملاحظات ||
          (اتجاه_الدفعة === "صرف"
            ? `دفع فاتورة مورد رقم ${ب.مرجع_خارجي || رقم_الجديد} — ${طرف.name}`
            : `تحصيل فاتورة رقم ${رقم_الجديد} — ${طرف.name}`);
        await أنشئ_عملية_مرتبطة(tx, {
          الاتجاه: اتجاه_الدفعة,
          معرف_الطرف: طرف.id,
          اسم_الطرف: طرف.name,
          المبلغ: د(ب.الدفعة.المبلغ!),
          التاريخ: تاريخ,
          معرف_الحساب: ب.الدفعة.معرف_الحساب,
          معرف_حساب_فرعي: ب.الدفعة.معرف_حساب_فرعي ?? null,
          رقم_الفاتورة: String(رقم_الجديد),
          معرف_الفاتورة: id,
          البيان: بيان_الدفعة,
          أنشأ: فاعل.id,
        });
      } else {
        const بيان_الدفعة = ب.الدفعة.ملاحظات ||
          `بيع نقدي رقم ${رقم_الجديد}${ب.اسم_الزائر ? ` — ${ب.اسم_الزائر}` : ""}`;
        await أضف_حركة_خزنة(tx, {
          التاريخ: تاريخ,
          النوع: TxnKind.INCOME,
          المبلغ: د(ب.الدفعة.المبلغ!),
          معرف_الحساب: ب.الدفعة.معرف_الحساب,
          معرف_حساب_فرعي: ب.الدفعة.معرف_حساب_فرعي ?? null,
          البيان: بيان_الدفعة,
          معرف_الطرف: null,
          اسم_الطرف_الخارجي: ب.اسم_الزائر || null,
          معرف_الفاتورة: id,
          أنشأ: فاعل.id,
        });
      }
    }

    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "UPDATE",
      نوع_الكيان: "الفاتورة",
      معرف_الكيان: id,
      التفاصيل: {
        قبل: { الرقم: حالية.number },
        بعد: {
          الرقم: رقم_الجديد,
          النوع: ب.نوع_الفاتورة,
          الإجمالي: الإجمالي_المالي.toString(),
          ...(ب.الدفعة ? { دفعة: ب.الدفعة.المبلغ } : {}),
        },
      },
    });
  });

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  if (طرف) {
    if (هو_مورد) {
      revalidatePath(`/suppliers/${طرف.id}`);
      if (حالية.customerId) revalidatePath(`/suppliers/${حالية.customerId}`);
    } else {
      revalidatePath(`/customers/${طرف.id}`);
      if (حالية.customerId) revalidatePath(`/customers/${حالية.customerId}`);
    }
  }
  if (ب.الدفعة) revalidatePath("/treasury");
  return نجح(undefined, "تم تعديل الفاتورة وتحديث الرصيد");
}

export async function حذف_فاتورة(id: number): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "حذف");
  const فاتورة = await prisma.invoice.findUnique({ where: { id } });
  if (!فاتورة) return فشل("الفاتورة غير موجودة");

  await prisma.$transaction(async (tx) => {
    // عكس حركات الخزنة المرتبطة بهذه الفاتورة (دفعات + مبيعات نقدية)
    const حركات_الخزنة = await tx.treasuryTxn.findMany({
      where: { invoiceId: id, deletedAt: null },
      select: { id: true },
    });
    for (const ح of حركات_الخزنة) {
      await احذف_حركة_خزنة_ناعم(tx, ح.id);
    }
    await اعكس_قيود_الفاتورة(tx, id, فاتورة.customerId);
    await tx.invoice.delete({ where: { id } }); // البنود Cascade
    await tx.$executeRaw`
      UPDATE settings
      SET value = COALESCE((SELECT MAX(number)::text FROM invoices), '0')
      WHERE key = 'عداد_الفواتير'
    `;
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "DELETE",
      نوع_الكيان: "الفاتورة",
      معرف_الكيان: id,
      التفاصيل: { الرقم: فاتورة.number },
    });
  });

  revalidatePath("/invoices");
  if (فاتورة.customerId) {
    revalidatePath(`/customers/${فاتورة.customerId}`);
  }
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

export async function احذف_تصنيف_DB(قيمة: string): Promise<نتيجة> {
  await اطلب_المستخدم();
  const قائمة = (await قرأ_القائمة(مفتاح_تصنيفات)) ?? [];
  await حفظ_القائمة(مفتاح_تصنيفات, قائمة.filter((x) => x !== قيمة));
  return نجح(undefined, "تم الحذف");
}

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

export async function احذف_شركة_DB(قيمة: string): Promise<نتيجة> {
  await اطلب_المستخدم();
  const قائمة = (await قرأ_القائمة(مفتاح_شركات)) ?? [];
  await حفظ_القائمة(مفتاح_شركات, قائمة.filter((x) => x !== قيمة));
  return نجح(undefined, "تم الحذف");
}

export async function أضف_للقائمة_DB(نوع: "تصنيف" | "شركة", قيمة: string): Promise<void> {
  const مفتاح = نوع === "تصنيف" ? مفتاح_تصنيفات : مفتاح_شركات;
  const قائمة = (await قرأ_القائمة(مفتاح)) ?? [];
  if (!قائمة.includes(قيمة)) {
    await حفظ_القائمة(مفتاح, [...قائمة, قيمة]);
  }
}

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
