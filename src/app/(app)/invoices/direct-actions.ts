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
  رحّل_فاتورة_مباشرة,
  اعكس_قيود_الفاتورة,
} from "@/lib/invoice";
import { أنشئ_عملية_مرتبطة, اعكس_عملية_مرتبطة } from "@/lib/integration";
import { مخطط_فاتورة_مباشرة, type مدخلات_فاتورة_مباشرة } from "@/lib/schemas/invoice";

/**
 * الفاتورة المباشرة (مورد ← عميل): البضاعة تروح من المورد للعميل على طول،
 * فبدل ما تتسجّل مرتين (شراء ثم بيع) بتتسجّل مرة واحدة وتتحط على الحسابين:
 *  - فاتورة شراء على المورد  → قيد دائن (بنستحق له القيمة)
 *  - فاتورة بيع على العميل   → قيد مدين (العميل مدين لنا بالقيمة)
 * الفاتورتان مربوطتان بمجموعة واحدة (DirectInvoice)، والتعديل/الحذف يمسّ الجهتين معاً.
 * السعر واحد للجهتين (تمرير بالتكلفة) — يعني قيمة الفاتورتين متساوية.
 */

type بنود_محسوبة = ReturnType<typeof احسب_إجماليات>["بنود_محسوبة"];

/** بنود الفاتورة المباشرة كلها بيع (لا مرتجعات في التمرير المباشر). */
function بنود_للإنشاء(بنود: بنود_محسوبة, أنشأ: number) {
  return بنود.map((x) => ({
    lineType: "SALE",
    color: x.اللون,
    company: x.الشركة || null,
    qty: x._كمية,
    weight: x._وزن,
    category: x.التصنيف,
    price: x.السعر != null && x.السعر !== "" ? د(x.السعر) : null,
    lineTotal: x._مجموع,
    notes: x.ملاحظات || null,
    createdById: أنشأ,
  }));
}

/** تجهيز مشترك بين الإنشاء والتعديل: تحقق من الطرفين + حساب الإجماليات. */
async function جهّز(مدخلات: unknown) {
  const t = مخطط_فاتورة_مباشرة.safeParse(مدخلات);
  if (!t.success) return { سليم: false, خطأ: t.error.errors[0].message } as const;
  const ب: مدخلات_فاتورة_مباشرة = t.data;

  const [مورد, عميل] = await Promise.all([
    prisma.party.findUnique({ where: { id: ب.معرف_المورد } }),
    prisma.party.findUnique({ where: { id: ب.معرف_العميل } }),
  ]);
  if (!مورد || مورد.type !== "SUPPLIER") return { سليم: false, خطأ: "اختر مورداً مسجّلاً" } as const;
  if (!عميل || عميل.type !== "CUSTOMER") return { سليم: false, خطأ: "اختر عميلاً مسجّلاً" } as const;

  // كل البنود بيع (نتجاهل نوع البند القادم من النموذج)
  const بنود = ب.البنود.map((x) => ({ ...x, نوع_البند: "SALE" as const }));
  const إجماليات = احسب_إجماليات(بنود);

  // غير مسعّرة: فيه صنف بلا سعر ⇒ الفاتورتان تُحفظان بلا أثر مالي حتى تكتمل الأسعار
  const غير_مسعّرة = بنود.some((x) => x.السعر == null);
  if (غير_مسعّرة && (ب.دفعة_العميل || ب.دفعة_المورد)) {
    return { سليم: false, خطأ: "فاتورة غير مسعّرة — لا يمكن تسجيل دفعة قبل اكتمال الأسعار" } as const;
  }

  const تاريخ = تحليل_تاريخ(ب.التاريخ) ?? new Date();
  return { سليم: true, ب, مورد, عميل, تاريخ, غير_مسعّرة, ...إجماليات } as const;
}

export async function إنشاء_فاتورة_مباشرة(
  مدخلات: unknown
): Promise<نتيجة<{ id: number; معرف_فاتورة_المورد: number; الرقم: number }>> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const ج = await جهّز(مدخلات);
  if (!ج.سليم) return فشل(ج.خطأ);
  const { ب, مورد, عميل, تاريخ, غير_مسعّرة } = ج;

  if (ب.رقم_الفاتورة_المحدد) {
    const مكرر = await prisma.invoice.findFirst({ where: { number: ب.رقم_الفاتورة_المحدد } });
    if (مكرر) return فشل(`رقم الفاتورة ${ب.رقم_الفاتورة_المحدد} مستخدم بالفعل`);
  }

  const نتيجة_المعاملة = await prisma.$transaction(async (tx) => {
    const مجموعة = await tx.directInvoice.create({ data: {} });

    // رقم فاتورة العميل (تسلسلي أو محدد) — فاتورة المورد بلا رقم سيستم
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
    const مرجع_المورد = ب.مرجع_خارجي?.trim() || String(رقم);

    // ── فاتورة الشراء على المورد ──
    const فاتورة_المورد = await tx.invoice.create({
      data: {
        number: null,
        invoiceType: "PURCHASE",
        unpriced: غير_مسعّرة,
        externalRef: ب.مرجع_خارجي?.trim() || null,
        customerId: مورد.id,
        phone: مورد.phone,
        date: تاريخ,
        totalQty: ج.إجمالي_الكمية,
        totalWeight: ج.إجمالي_الوزن,
        totalAmount: ج.الإجمالي_المالي,
        notes: ب.ملاحظات || null,
        shareToken: crypto.randomUUID(),
        directInvoiceId: مجموعة.id,
        createdById: فاعل.id,
        lines: { create: بنود_للإنشاء(ج.بنود_محسوبة, فاعل.id) },
      },
    });

    // ── فاتورة البيع على العميل ──
    const فاتورة_العميل = await tx.invoice.create({
      data: {
        number: رقم,
        invoiceType: "SALE",
        unpriced: غير_مسعّرة,
        customerId: عميل.id,
        phone: ب.الهاتف || عميل.phone,
        date: تاريخ,
        totalQty: ج.إجمالي_الكمية,
        totalWeight: ج.إجمالي_الوزن,
        totalAmount: ج.الإجمالي_المالي,
        notes: ب.ملاحظات || null,
        shareToken: crypto.randomUUID(),
        directInvoiceId: مجموعة.id,
        createdById: فاعل.id,
        lines: { create: بنود_للإنشاء(ج.بنود_محسوبة, فاعل.id) },
      },
    });

    // ── القيود على الحسابين (تُمنَع طالما الفاتورة غير مسعّرة) ──
    if (!غير_مسعّرة && ج.الإجمالي_المالي.greaterThan(0)) {
      await رحّل_فاتورة_مباشرة(tx, {
        معرف_فاتورة_المورد: فاتورة_المورد.id,
        معرف_فاتورة_العميل: فاتورة_العميل.id,
        معرف_المورد: مورد.id,
        معرف_العميل: عميل.id,
        اسم_المورد: مورد.name,
        اسم_العميل: عميل.name,
        رقم_الفاتورة: رقم,
        مرجع_المورد,
        التاريخ: تاريخ,
        القيمة: ج.الإجمالي_المالي,
        أنشأ: فاعل.id,
      });
    }

    // ── الدفعتان (كل واحدة اختيارية ومستقلة) ──
    await سجّل_الدفعات(tx, {
      ب,
      مورد,
      عميل,
      تاريخ,
      غير_مسعّرة,
      معرف_فاتورة_المورد: فاتورة_المورد.id,
      معرف_فاتورة_العميل: فاتورة_العميل.id,
      رقم,
      مرجع_المورد,
      أنشأ: فاعل.id,
    });

    for (const [معرف, جهة] of [
      [فاتورة_المورد.id, `مورد: ${مورد.name}`],
      [فاتورة_العميل.id, `عميل: ${عميل.name}`],
    ] as const) {
      await تسجيل_عملية(tx, {
        المستخدم: فاعل.id,
        العملية: "CREATE",
        نوع_الكيان: "الفاتورة",
        معرف_الكيان: معرف as number,
        التفاصيل: {
          النوع: "DIRECT",
          مباشرة: true,
          الرقم: رقم,
          الجهة: جهة,
          المورد: مورد.name,
          العميل: عميل.name,
          الإجمالي: ج.الإجمالي_المالي.toString(),
          ...(ب.دفعة_العميل ? { تحصيل_من_العميل: ب.دفعة_العميل.المبلغ } : {}),
          ...(ب.دفعة_المورد ? { دفع_للمورد: ب.دفعة_المورد.المبلغ } : {}),
        },
      });
    }

    return { id: فاتورة_العميل.id, معرف_فاتورة_المورد: فاتورة_المورد.id, الرقم: رقم };
  });

  أعد_التحقق(مورد.id, عميل.id, نتيجة_المعاملة.id, نتيجة_المعاملة.معرف_فاتورة_المورد, !!(ب.دفعة_العميل || ب.دفعة_المورد));
  return نجح(
    نتيجة_المعاملة,
    `تم إنشاء الفاتورة المباشرة ${String(نتيجة_المعاملة.الرقم).padStart(7, "0")} على حساب ${مورد.name} و${عميل.name}`
  );
}

export async function تعديل_فاتورة_مباشرة(id: number, مدخلات: unknown): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");

  const حالية = await prisma.invoice.findUnique({ where: { id } });
  if (!حالية) return فشل("الفاتورة غير موجودة");
  if (!حالية.directInvoiceId) return فشل("هذه ليست فاتورة مباشرة");
  const مجموعة = await prisma.invoice.findMany({
    where: { directInvoiceId: حالية.directInvoiceId },
  });
  const ف_مورد = مجموعة.find((x) => x.invoiceType === "PURCHASE");
  const ف_عميل = مجموعة.find((x) => x.invoiceType === "SALE");
  if (!ف_مورد || !ف_عميل) return فشل("الفاتورة المباشرة ناقصة — لا يمكن تعديلها");

  const ج = await جهّز(مدخلات);
  if (!ج.سليم) return فشل(ج.خطأ);
  const { ب, مورد, عميل, تاريخ, غير_مسعّرة } = ج;

  const رقم_الجديد = ب.رقم_الفاتورة_المحدد ?? ف_عميل.number;
  if (رقم_الجديد == null) return فشل("رقم الفاتورة مطلوب");
  if (رقم_الجديد !== ف_عميل.number) {
    const مكرر = await prisma.invoice.findFirst({
      where: { number: رقم_الجديد, id: { not: ف_عميل.id } },
    });
    if (مكرر) return فشل(`رقم الفاتورة ${رقم_الجديد} مستخدم بالفعل`);
  }
  const مرجع_المورد = ب.مرجع_خارجي?.trim() || String(رقم_الجديد);

  await prisma.$transaction(async (tx) => {
    // ── عكس الجهتين بالكامل (دفعات + قيود) ثم إعادة التطبيق ──
    for (const ف of [ف_مورد, ف_عميل]) {
      const حركات_قديمة = await tx.treasuryTxn.findMany({
        where: { invoiceId: ف.id, deletedAt: null },
        select: { id: true },
      });
      for (const ح of حركات_قديمة) await اعكس_عملية_مرتبطة(tx, ح.id);
      await اعكس_قيود_الفاتورة(tx, ف.id, ف.customerId);
      await tx.invoiceLine.deleteMany({ where: { invoiceId: ف.id } });
    }

    await tx.invoice.update({
      where: { id: ف_مورد.id },
      data: {
        invoiceType: "PURCHASE",
        number: null,
        unpriced: غير_مسعّرة,
        externalRef: ب.مرجع_خارجي?.trim() || null,
        customerId: مورد.id,
        phone: مورد.phone,
        date: تاريخ,
        totalQty: ج.إجمالي_الكمية,
        totalWeight: ج.إجمالي_الوزن,
        totalAmount: ج.الإجمالي_المالي,
        notes: ب.ملاحظات || null,
        updatedById: فاعل.id,
        lines: { create: بنود_للإنشاء(ج.بنود_محسوبة, فاعل.id) },
      },
    });
    await tx.invoice.update({
      where: { id: ف_عميل.id },
      data: {
        invoiceType: "SALE",
        number: رقم_الجديد,
        unpriced: غير_مسعّرة,
        customerId: عميل.id,
        phone: ب.الهاتف || عميل.phone,
        date: تاريخ,
        totalQty: ج.إجمالي_الكمية,
        totalWeight: ج.إجمالي_الوزن,
        totalAmount: ج.الإجمالي_المالي,
        notes: ب.ملاحظات || null,
        updatedById: فاعل.id,
        lines: { create: بنود_للإنشاء(ج.بنود_محسوبة, فاعل.id) },
      },
    });
    if (رقم_الجديد !== ف_عميل.number) {
      await tx.$executeRaw`
        UPDATE settings SET value = ${String(رقم_الجديد)}
        WHERE key = 'عداد_الفواتير' AND value::int < ${رقم_الجديد}
      `;
    }

    if (!غير_مسعّرة && ج.الإجمالي_المالي.greaterThan(0)) {
      await رحّل_فاتورة_مباشرة(tx, {
        معرف_فاتورة_المورد: ف_مورد.id,
        معرف_فاتورة_العميل: ف_عميل.id,
        معرف_المورد: مورد.id,
        معرف_العميل: عميل.id,
        اسم_المورد: مورد.name,
        اسم_العميل: عميل.name,
        رقم_الفاتورة: رقم_الجديد,
        مرجع_المورد,
        التاريخ: تاريخ,
        القيمة: ج.الإجمالي_المالي,
        أنشأ: فاعل.id,
      });
    }

    await سجّل_الدفعات(tx, {
      ب,
      مورد,
      عميل,
      تاريخ,
      غير_مسعّرة,
      معرف_فاتورة_المورد: ف_مورد.id,
      معرف_فاتورة_العميل: ف_عميل.id,
      رقم: رقم_الجديد,
      مرجع_المورد,
      أنشأ: فاعل.id,
    });

    for (const معرف of [ف_مورد.id, ف_عميل.id]) {
      await تسجيل_عملية(tx, {
        المستخدم: فاعل.id,
        العملية: "UPDATE",
        نوع_الكيان: "الفاتورة",
        معرف_الكيان: معرف,
        التفاصيل: {
          قبل: { الرقم: ف_عميل.number, الإجمالي: ف_عميل.totalAmount.toString() },
          بعد: {
            النوع: "DIRECT",
            مباشرة: true,
            الرقم: رقم_الجديد,
            المورد: مورد.name,
            العميل: عميل.name,
            الإجمالي: ج.الإجمالي_المالي.toString(),
          },
        },
      });
    }
  });

  أعد_التحقق(مورد.id, عميل.id, ف_عميل.id, ف_مورد.id, true);
  if (ف_مورد.customerId && ف_مورد.customerId !== مورد.id) revalidatePath(`/suppliers/${ف_مورد.customerId}`);
  if (ف_عميل.customerId && ف_عميل.customerId !== عميل.id) revalidatePath(`/customers/${ف_عميل.customerId}`);
  return نجح(undefined, "تم تعديل الفاتورة المباشرة وتحديث حساب المورد والعميل");
}

/** الدفعتان المستقلتان: تحصيل من العميل (إيراد) + دفع للمورد (مصروف). */
async function سجّل_الدفعات(
  tx: Parameters<typeof أنشئ_عملية_مرتبطة>[0],
  م: {
    ب: مدخلات_فاتورة_مباشرة;
    مورد: { id: number; name: string };
    عميل: { id: number; name: string };
    تاريخ: Date;
    غير_مسعّرة: boolean;
    معرف_فاتورة_المورد: number;
    معرف_فاتورة_العميل: number;
    رقم: number;
    مرجع_المورد: string;
    أنشأ: number;
  }
) {
  if (م.غير_مسعّرة) return;
  if (م.ب.دفعة_العميل) {
    await أنشئ_عملية_مرتبطة(tx, {
      الاتجاه: "تحصيل",
      معرف_الطرف: م.عميل.id,
      اسم_الطرف: م.عميل.name,
      المبلغ: د(م.ب.دفعة_العميل.المبلغ!),
      التاريخ: م.تاريخ,
      معرف_الحساب: م.ب.دفعة_العميل.معرف_الحساب,
      معرف_حساب_فرعي: م.ب.دفعة_العميل.معرف_حساب_فرعي ?? null,
      رقم_الفاتورة: String(م.رقم),
      معرف_الفاتورة: م.معرف_فاتورة_العميل,
      البيان:
        م.ب.دفعة_العميل.ملاحظات ||
        `تحصيل فاتورة مباشرة رقم ${م.رقم} — ${م.عميل.name}`,
      أنشأ: م.أنشأ,
    });
  }
  if (م.ب.دفعة_المورد) {
    await أنشئ_عملية_مرتبطة(tx, {
      الاتجاه: "صرف",
      معرف_الطرف: م.مورد.id,
      اسم_الطرف: م.مورد.name,
      المبلغ: د(م.ب.دفعة_المورد.المبلغ!),
      التاريخ: م.تاريخ,
      معرف_الحساب: م.ب.دفعة_المورد.معرف_الحساب,
      معرف_حساب_فرعي: م.ب.دفعة_المورد.معرف_حساب_فرعي ?? null,
      رقم_الفاتورة: م.مرجع_المورد,
      معرف_الفاتورة: م.معرف_فاتورة_المورد,
      البيان:
        م.ب.دفعة_المورد.ملاحظات ||
        `دفع فاتورة مباشرة رقم ${م.مرجع_المورد} — ${م.مورد.name}`,
      أنشأ: م.أنشأ,
    });
  }
}

function أعد_التحقق(
  معرف_المورد: number,
  معرف_العميل: number,
  معرف_فاتورة_العميل: number,
  معرف_فاتورة_المورد: number,
  دفعات: boolean
) {
  revalidatePath("/invoices");
  revalidatePath(`/invoices/${معرف_فاتورة_العميل}`);
  revalidatePath(`/invoices/${معرف_فاتورة_المورد}`);
  revalidatePath(`/suppliers/${معرف_المورد}`);
  revalidatePath(`/customers/${معرف_العميل}`);
  if (دفعات) revalidatePath("/treasury");
}
