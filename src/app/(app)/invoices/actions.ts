"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { اطلب_المستخدم } from "@/lib/session";
import { تحقق_الصلاحية } from "@/lib/authz";
import { تسجيل_عملية } from "@/lib/activity";
import { نجح, فشل, type نتيجة } from "@/lib/result";
import { تحليل_تاريخ } from "@/lib/date";
import { د, جمع, طرح } from "@/lib/decimal";
import { تنسيق_مبلغ } from "@/lib/money";
import type { Prisma } from "@prisma/client";
import {
  احصل_رقم_فاتورة_جديد,
  احسب_إجماليات,
  احسب_المصروفات,
  صفوف_المصروفات_للإنشاء,
  اقفل_الفاتورة,
  المحصّل_على_الفاتورة,
  فاتورة_زائر,
  متابَعة_التحصيل,
  رسالة_خطأ_الفاتورة,
  امنع_رقم_مكرر,
  رحّل_فاتورة_للعميل,
  رحّل_مرتجع_للعميل,
  رحّل_فاتورة_للمورد,
  اعكس_قيود_الفاتورة,
} from "@/lib/invoice";
import { سجّل_دفعة_فاتورة, اعكس_دفعات_الفاتورة } from "@/lib/integration";
import { مخطط_فاتورة, مخطط_تحصيل_فاتورة } from "@/lib/schemas/invoice";
import { رحّل_مخزن_الفاتورة, اعكس_مخزن_الفاتورة, امنع_عكس_غير_آمن } from "@/lib/invoice-stock";

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

  // وضع العميل المؤقت: بيع فقط، بلا طرف مسجّل — يُنشأ له حساب مؤقت داخل المعاملة
  const وضع_مؤقت = !!ب.عميل_مؤقت && !طرف && !هو_مورد;

  // فاتورة غير مسعّرة تلقائياً: بيع لعميل مسجّل/مؤقت وفيه بند واحد على الأقل بلا سعر
  // ⇒ تُحفظ على حساب العميل بلا أثر مالي حتى تكتمل الأسعار (تُسعَّر عند التعديل).
  const غير_مسعّرة = !هو_مورد && (!!طرف || وضع_مؤقت) && ب.البنود.some((x) => x.السعر == null);

  // التحقق من تطابق نوع الفاتورة مع نوع الطرف
  if (طرف) {
    if (!هو_مورد && طرف.type !== "CUSTOMER") return فشل("هذا النوع من الفواتير يتطلب اختيار عميل");
    if (هو_مورد && طرف.type !== "SUPPLIER") return فشل("هذا النوع من الفواتير يتطلب اختيار مورد");
  }

  // العميل الزائر فقط في فواتير البيع. بلا دفعة ⇒ تُحفظ «معلّقة» وتُحصَّل لاحقاً من صفحة الفاتورة.
  if (!طرف && هو_مورد) return فشل("فواتير المورد تتطلب اختيار مورد مسجّل");
  const زائر = !طرف && !وضع_مؤقت;

  const تاريخ = تحليل_تاريخ(ب.التاريخ) ?? new Date();
  // نحفظ الأسعار الجزئية كما أُدخِلت (بلا تجريد)؛ الترحيل يُمنَع طالما الفاتورة غير مسعّرة
  const { إجمالي_الكمية, إجمالي_الوزن, الإجمالي_المالي, إجمالي_المبيعات, إجمالي_المرتجعات, بنود_محسوبة } =
    احسب_إجماليات(ب.البنود);
  // الإجمالي النهائي = صافي البنود + المصروفات الإضافية (يُحسب هنا — لا نثق في إجمالي الواجهة)
  const { إجمالي_المصروفات, صفوف: صفوف_المصروفات } = احسب_المصروفات(ب.المصروفات_الإضافية);
  const الإجمالي_النهائي = جمع(الإجمالي_المالي, إجمالي_المصروفات);
  const إجمالي_الدفعة_المدخلة = ب.الدفعة
    ? ب.الدفعة.بنود.reduce((س, بند) => س.plus(د(بند.المبلغ!)), د(0))
    : د(0);
  // الزائر: المحصّل أكبر من الإجمالي مقبول (مثلاً حوّل 1200 وحسابه 1190) — المبلغ كله يدخل الخزنة

  let فاتورة: { id: number; number: number | null; customerId: number | null };
  try {
  فاتورة = await prisma.$transaction(async (tx) => {
    // عميل مؤقت: أنشئ حساباً مؤقتاً (اسم مُدخَل أو مُولّد تلقائياً) داخل نفس المعاملة
    let طرف_فعلي = طرف;
    if (وضع_مؤقت) {
      const اسم_مؤقت = ب.اسم_الزائر?.trim() ||
        `عميل مؤقت رقم ${(await tx.party.count({ where: { isTemporary: true } })) + 1}`;
      طرف_فعلي = await tx.party.create({
        data: {
          name: اسم_مؤقت,
          type: "CUSTOMER",
          isTemporary: true,
          phone: ب.الهاتف || null,
          openingBalance: "0",
          balance: "0",
          createdById: فاعل.id,
        },
      });
    }

    // فواتير الشراء: لا ترقيم سيستم — رقم المورد يُخزَّن في externalRef
    let رقم: number | null = null;
    if (ب.نوع_الفاتورة !== "PURCHASE") {
      if (ب.رقم_الفاتورة_المحدد) {
        رقم = ب.رقم_الفاتورة_المحدد;
        await امنع_رقم_مكرر(tx, رقم);
        await tx.$executeRaw`
          UPDATE settings SET value = ${String(رقم)}
          WHERE key = 'عداد_الفواتير' AND value::int < ${رقم}
        `;
      } else {
        رقم = await احصل_رقم_فاتورة_جديد(tx);
      }
    }
    const f = await tx.invoice.create({
      data: {
        number: رقم,
        invoiceType: ب.نوع_الفاتورة,
        unpriced: غير_مسعّرة,
        goodsDestination: ب.نوع_الفاتورة === "PURCHASE" ? (ب.وجهة_البضاعة ?? "WAREHOUSE") : null,
        externalRef: ب.مرجع_خارجي || null,
        customerId: طرف_فعلي?.id ?? null,
        guestName: !طرف_فعلي ? (ب.اسم_الزائر?.trim() || null) : null,
        paymentTracked: زائر, // فواتير الزائر الجديدة تدخل متابعة التحصيل
        phone: ب.الهاتف || طرف_فعلي?.phone,
        date: تاريخ,
        totalQty: إجمالي_الكمية,
        totalWeight: إجمالي_الوزن,
        totalAmount: الإجمالي_النهائي, // صافي (المبيعات − المرتجعات) + المصروفات الإضافية
        expensesTotal: إجمالي_المصروفات,
        notes: ب.ملاحظات || null,
        shareToken: crypto.randomUUID(),
        createdById: فاعل.id,
        expenses: { create: صفوف_المصروفات_للإنشاء(صفوف_المصروفات, فاعل.id) },
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

    // ── ترحيل المخزن (لا يعمل إلا لو متغير التشغيل مفعّل) ──
    const بنود_منشأة = await tx.invoiceLine.findMany({
      where: { invoiceId: f.id }, orderBy: { id: "asc" },
      select: { id: true, category: true, color: true, company: true, qty: true, weight: true, lineType: true },
    });
    await رحّل_مخزن_الفاتورة(tx, {
      معرف_الفاتورة: f.id,
      نوع_الفاتورة: ب.نوع_الفاتورة,
      وجهة_البضاعة: ب.وجهة_البضاعة ?? null,
      التاريخ: تاريخ,
      معرف_المورد: هو_مورد ? (طرف_فعلي?.id ?? null) : null,
      مرجع: ب.مرجع_خارجي ?? null,
      وصف: `فاتورة ${رقم ?? ب.مرجع_خارجي ?? ""} — ${طرف_فعلي?.name ?? "عميل نقدي"}`,
      البنود: بنود_منشأة.map((س, i) => ({
        معرف_البند: س.id,
        التصنيف: س.category, اللون: س.color, الشركة: س.company,
        الكمية: س.qty, الوزن: س.weight,
        نوع_البند: (س.lineType === "RETURN" ? "RETURN" : "SALE") as "SALE" | "RETURN",
        معرف_اللط: ب.البنود[i]?.معرف_اللط ?? null,
        رقم_اللط: ب.البنود[i]?.رقم_اللط ?? null,
      })),
      أنشأ: فاعل.id,
    });

    // ترحيل القيود على حساب الطرف
    if (هو_مورد && طرف_فعلي) {
      await رحّل_فاتورة_للمورد(tx, {
        معرف_الفاتورة: f.id,
        رقم_الفاتورة: رقم,
        مرجع_خارجي: ب.مرجع_خارجي || null,
        معرف_المورد: طرف_فعلي.id,
        التاريخ: تاريخ,
        القيمة: الإجمالي_النهائي,
        النوع: ب.نوع_الفاتورة as "PURCHASE" | "SUPPLIER_RETURN",
        أنشأ: فاعل.id,
      });
    } else if (طرف_فعلي && !غير_مسعّرة) {
      // عميل مسجّل أو مؤقت — مدين للمبيعات (+ المصروفات الإضافية) + دائن للمرتجعات (يُمنَع للفاتورة غير المسعّرة)
      const مدين_الفاتورة = جمع(إجمالي_المبيعات, إجمالي_المصروفات);
      if (مدين_الفاتورة.greaterThan(0)) {
        await رحّل_فاتورة_للعميل(tx, {
          معرف_الفاتورة: f.id,
          رقم_الفاتورة: رقم!, // SALE: guaranteed non-null
          معرف_العميل: طرف_فعلي.id,
          التاريخ: تاريخ,
          القيمة: مدين_الفاتورة,
          أنشأ: فاعل.id,
        });
      }
      if (إجمالي_المرتجعات.greaterThan(0)) {
        await رحّل_مرتجع_للعميل(tx, {
          معرف_الفاتورة: f.id,
          رقم_الفاتورة: رقم!, // SALE: guaranteed non-null
          معرف_العميل: طرف_فعلي.id,
          التاريخ: تاريخ,
          القيمة: إجمالي_المرتجعات,
          أنشأ: فاعل.id,
        });
      }
    }
    // عميل زائر (بلا حساب): لا قيود على دفتر الأستاذ — فقط حركة خزنة أدناه

    // دفعة فورية مع الفاتورة (لا تُسجَّل على فاتورة غير مسعّرة) — وسيلة واحدة أو موزّعة
    if (ب.الدفعة && !غير_مسعّرة) {
      const اتجاه_الدفعة = ب.نوع_الفاتورة === "PURCHASE" ? "صرف" : "تحصيل";
      const مرجع_عرض = ب.مرجع_خارجي || String(رقم ?? "");
      const بيان_الدفعة = ب.الدفعة.ملاحظات ||
        (طرف_فعلي
          ? (اتجاه_الدفعة === "صرف"
              ? `دفع فاتورة مورد رقم ${مرجع_عرض} — ${طرف_فعلي.name}`
              : `تحصيل فاتورة رقم ${مرجع_عرض} — ${طرف_فعلي.name}`)
          : `بيع نقدي رقم ${رقم}${ب.اسم_الزائر ? ` — ${ب.اسم_الزائر}` : ""}`);
      await سجّل_دفعة_فاتورة(tx, {
        الاتجاه: اتجاه_الدفعة,
        طرف: طرف_فعلي ? { id: طرف_فعلي.id, name: طرف_فعلي.name } : null,
        اسم_الطرف_الخارجي: ب.اسم_الزائر || null,
        بنود: ب.الدفعة.بنود.map((بند) => ({
          معرف_الحساب: بند.معرف_الحساب,
          معرف_حساب_فرعي: بند.معرف_حساب_فرعي ?? null,
          المبلغ: د(بند.المبلغ!),
        })),
        الإجمالي: إجمالي_الدفعة_المدخلة,
        التاريخ: تاريخ,
        البيان: بيان_الدفعة,
        رقم_الفاتورة: مرجع_عرض,
        معرف_الفاتورة: f.id,
        أنشأ: فاعل.id,
      });
    }

    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "CREATE",
      نوع_الكيان: "الفاتورة",
      معرف_الكيان: f.id,
      التفاصيل: {
        الرقم: رقم,
        النوع: ب.نوع_الفاتورة,
        الطرف: طرف_فعلي?.name ?? (ب.اسم_الزائر || "عميل زائر"),
        عميل_مؤقت: وضع_مؤقت,
        الإجمالي: الإجمالي_النهائي.toString(),
        ...(إجمالي_المصروفات.greaterThan(0) ? { المصروفات_الإضافية: إجمالي_المصروفات.toString() } : {}),
        ...(زائر && إجمالي_الدفعة_المدخلة.lessThan(الإجمالي_النهائي) ? { معلّقة: true } : {}),
        ...(ب.الدفعة ? { دفعة: ب.الدفعة.بنود.reduce((س, بند) => س + Number(بند.المبلغ), 0) } : {}),
      },
    });
    return f;
  });
  } catch (e) {
    return فشل(رسالة_خطأ_الفاتورة(e, "خطأ أثناء إنشاء الفاتورة"));
  }

  revalidatePath("/invoices");
  revalidatePath("/inventory");
  if (طرف) {
    if (هو_مورد) revalidatePath(`/suppliers/${طرف.id}`);
    else revalidatePath(`/customers/${طرف.id}`);
  } else if (فاتورة.customerId) {
    // عميل مؤقت أُنشئ للتوّ
    revalidatePath(`/customers/${فاتورة.customerId}`);
    revalidatePath("/customers");
  }
  if (ب.الدفعة) revalidatePath("/treasury");
  const عرض_الرقم = فاتورة.number ? String(فاتورة.number).padStart(7, "0") : (ب.مرجع_خارجي ?? "");
  const معلّقة = زائر && إجمالي_الدفعة_المدخلة.lessThan(الإجمالي_النهائي);
  return نجح(
    { id: فاتورة.id, الرقم: فاتورة.number ?? 0 },
    معلّقة
      ? `تم حفظ الفاتورة ${عرض_الرقم} معلّقة — المتبقي ${تنسيق_مبلغ(طرح(الإجمالي_النهائي, إجمالي_الدفعة_المدخلة))} يُحصَّل لاحقاً`
      : `تم إنشاء الفاتورة ${عرض_الرقم}`
  );
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
  // كشف تلقائي: بيع لعميل مسجّل وفيه بند بلا سعر ⇒ غير مسعّرة (بلا أثر مالي حتى تكتمل الأسعار)
  const غير_مسعّرة = !هو_مورد && !!طرف && ب.البنود.some((x) => x.السعر == null);
  // زائر قبل وبعد التعديل (بيع بلا حساب) — يقبل البقاء معلّقاً
  const زائر = !طرف && !هو_مورد && فاتورة_زائر(حالية);

  const تاريخ = تحليل_تاريخ(ب.التاريخ) ?? new Date();
  const { إجمالي_الكمية, إجمالي_الوزن, الإجمالي_المالي, إجمالي_المبيعات, إجمالي_المرتجعات, بنود_محسوبة } =
    احسب_إجماليات(ب.البنود);
  const { إجمالي_المصروفات, صفوف: صفوف_المصروفات } = احسب_المصروفات(ب.المصروفات_الإضافية);
  const الإجمالي_النهائي = جمع(الإجمالي_المالي, إجمالي_المصروفات);

  // فواتير الشراء: لا ترقيم سيستم — رقم null دائماً
  const هو_شراء_جديد = ب.نوع_الفاتورة === "PURCHASE";
  const رقم_الجديد: number | null = هو_شراء_جديد
    ? null
    : (ب.رقم_الفاتورة_المحدد ?? حالية.number);
  if (!هو_شراء_جديد && رقم_الجديد !== null && رقم_الجديد !== حالية.number) {
    const مكرر = await prisma.invoice.findFirst({
      where: { number: رقم_الجديد, id: { not: id } },
    });
    if (مكرر) return فشل(`رقم الفاتورة ${رقم_الجديد} مستخدم بالفعل`);
  }

  let إعادة_فتح = false;
  try {
  await prisma.$transaction(async (tx) => {
    // قفل الفاتورة: لا تحصيل/حذف متزامن أثناء العكس وإعادة التطبيق
    if (!(await اقفل_الفاتورة(tx, id))) throw new Error("الفاتورة غير موجودة");
    // المخزن: امنع التعديل لو البضاعة الواردة اتصرفت (يُطلب مرتجع/تسوية)
    const مانع = await امنع_عكس_غير_آمن(tx, id);
    if (مانع) throw new Error(مانع);
    await اعكس_مخزن_الفاتورة(tx, id);

    // الزائر: لو وسائل الدفع لم تتغير نُبقي حركاته كما هي (تاريخ التحصيل الفعلي/البيان/المنشئ)
    // بدل إعادة إنشائها بتاريخ الفاتورة — مهم للتحصيل اللاحق للفواتير المعلّقة (KI-08).
    const حركات_حالية = await tx.treasuryTxn.findMany({
      where: { invoiceId: id, deletedAt: null },
      select: { amount: true, accountId: true, subAccountId: true, kind: true },
    });
    const إبقاء_الدفعات = زائر && دفعات_مطابقة(حركات_حالية, ب.الدفعة?.بنود ?? []);
    // فاتورة مُنهاة (تحصيل وإنهاء): لو اتغير الإجمالي أو الدفعات يبطل الإنهاء والمسامحة
    // وترجع معلّقة بالمتبقي الجديد — لا مسامحة قديمة على أرقام اتغيرت.
    إعادة_فتح =
      !!حالية.settledAt && (!زائر || !إبقاء_الدفعات || !حالية.totalAmount.equals(الإجمالي_النهائي));

    // عكس حركات الخزنة المرتبطة بالفاتورة القديمة (دفعات + مبيعات نقدية) — وسيلة
    // واحدة أو موزّعة على عدة وسائل — بلا قيود يتيمة
    if (!إبقاء_الدفعات) await اعكس_دفعات_الفاتورة(tx, id);
    await اعكس_قيود_الفاتورة(tx, id, حالية.customerId);
    await tx.invoiceLine.deleteMany({ where: { invoiceId: id } });
    await tx.invoiceExpense.deleteMany({ where: { invoiceId: id } });
    await tx.invoice.update({
      where: { id },
      data: {
        number: رقم_الجديد,
        invoiceType: ب.نوع_الفاتورة,
        unpriced: غير_مسعّرة,
        goodsDestination: ب.نوع_الفاتورة === "PURCHASE" ? (ب.وجهة_البضاعة ?? "WAREHOUSE") : null,
        externalRef: ب.مرجع_خارجي || null,
        customerId: طرف?.id ?? null,
        guestName: !طرف ? (ب.اسم_الزائر?.trim() || null) : null,
        phone: ب.الهاتف || طرف?.phone,
        date: تاريخ,
        totalQty: إجمالي_الكمية,
        totalWeight: إجمالي_الوزن,
        totalAmount: الإجمالي_النهائي,
        expensesTotal: إجمالي_المصروفات,
        notes: ب.ملاحظات || null,
        updatedById: فاعل.id,
        ...(إعادة_فتح ? { settledAt: null, settledById: null, writeOffAmount: 0 } : {}),
        expenses: { create: صفوف_المصروفات_للإنشاء(صفوف_المصروفات, فاعل.id) },
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
    if (!هو_شراء_جديد && رقم_الجديد !== null && رقم_الجديد !== حالية.number) {
      await tx.$executeRaw`
        UPDATE settings SET value = ${String(رقم_الجديد)}
        WHERE key = 'عداد_الفواتير' AND value::int < ${رقم_الجديد}
      `;
    }

    // ── إعادة ترحيل المخزن بالبنود الجديدة ──
    const بنود_محدثة = await tx.invoiceLine.findMany({
      where: { invoiceId: id }, orderBy: { id: "asc" },
      select: { id: true, category: true, color: true, company: true, qty: true, weight: true, lineType: true },
    });
    await رحّل_مخزن_الفاتورة(tx, {
      معرف_الفاتورة: id,
      نوع_الفاتورة: ب.نوع_الفاتورة,
      وجهة_البضاعة: ب.وجهة_البضاعة ?? null,
      التاريخ: تاريخ,
      معرف_المورد: هو_مورد ? (طرف?.id ?? null) : null,
      مرجع: ب.مرجع_خارجي ?? null,
      وصف: `فاتورة ${رقم_الجديد ?? ب.مرجع_خارجي ?? ""} — ${طرف?.name ?? "عميل نقدي"}`,
      البنود: بنود_محدثة.map((س, i) => ({
        معرف_البند: س.id,
        التصنيف: س.category, اللون: س.color, الشركة: س.company,
        الكمية: س.qty, الوزن: س.weight,
        نوع_البند: (س.lineType === "RETURN" ? "RETURN" : "SALE") as "SALE" | "RETURN",
        معرف_اللط: ب.البنود[i]?.معرف_اللط ?? null,
        رقم_اللط: ب.البنود[i]?.رقم_اللط ?? null,
      })),
      أنشأ: فاعل.id,
    });

    if (هو_مورد && طرف) {
      await رحّل_فاتورة_للمورد(tx, {
        معرف_الفاتورة: id,
        رقم_الفاتورة: رقم_الجديد,
        مرجع_خارجي: ب.مرجع_خارجي || null,
        معرف_المورد: طرف.id,
        التاريخ: تاريخ,
        القيمة: الإجمالي_النهائي,
        النوع: ب.نوع_الفاتورة as "PURCHASE" | "SUPPLIER_RETURN",
        أنشأ: فاعل.id,
      });
    } else if (طرف && !غير_مسعّرة) {
      const مدين_الفاتورة = جمع(إجمالي_المبيعات, إجمالي_المصروفات);
      if (مدين_الفاتورة.greaterThan(0)) {
        await رحّل_فاتورة_للعميل(tx, {
          معرف_الفاتورة: id,
          رقم_الفاتورة: رقم_الجديد!, // SALE: non-null
          معرف_العميل: طرف.id,
          التاريخ: تاريخ,
          القيمة: مدين_الفاتورة,
          أنشأ: فاعل.id,
        });
      }
      if (إجمالي_المرتجعات.greaterThan(0)) {
        await رحّل_مرتجع_للعميل(tx, {
          معرف_الفاتورة: id,
          رقم_الفاتورة: رقم_الجديد!, // SALE: non-null
          معرف_العميل: طرف.id,
          التاريخ: تاريخ,
          القيمة: إجمالي_المرتجعات,
          أنشأ: فاعل.id,
        });
      }
    }

    if (ب.الدفعة && !غير_مسعّرة && !إبقاء_الدفعات) {
      const اتجاه_الدفعة = ب.نوع_الفاتورة === "PURCHASE" ? "صرف" : "تحصيل";
      const مرجع_عرض_ت = ب.مرجع_خارجي || String(رقم_الجديد ?? "");
      const بيان_الدفعة = ب.الدفعة.ملاحظات ||
        (طرف
          ? (اتجاه_الدفعة === "صرف"
              ? `دفع فاتورة مورد رقم ${مرجع_عرض_ت} — ${طرف.name}`
              : `تحصيل فاتورة رقم ${مرجع_عرض_ت} — ${طرف.name}`)
          : `بيع نقدي رقم ${رقم_الجديد ?? ""}${ب.اسم_الزائر ? ` — ${ب.اسم_الزائر}` : ""}`);
      const إجمالي_الدفعة_ت = ب.الدفعة.بنود.reduce((س, بند) => س.plus(د(بند.المبلغ!)), د(0));
      await سجّل_دفعة_فاتورة(tx, {
        الاتجاه: اتجاه_الدفعة,
        طرف: طرف ? { id: طرف.id, name: طرف.name } : null,
        اسم_الطرف_الخارجي: ب.اسم_الزائر || null,
        بنود: ب.الدفعة.بنود.map((بند) => ({
          معرف_الحساب: بند.معرف_الحساب,
          معرف_حساب_فرعي: بند.معرف_حساب_فرعي ?? null,
          المبلغ: د(بند.المبلغ!),
        })),
        الإجمالي: إجمالي_الدفعة_ت,
        التاريخ: تاريخ,
        البيان: بيان_الدفعة,
        رقم_الفاتورة: مرجع_عرض_ت,
        معرف_الفاتورة: id,
        أنشأ: فاعل.id,
      });
    }

    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "UPDATE",
      نوع_الكيان: "الفاتورة",
      معرف_الكيان: id,
      التفاصيل: {
        قبل: {
          الرقم: حالية.number,
          الإجمالي: حالية.totalAmount.toString(),
          المصروفات_الإضافية: حالية.expensesTotal.toString(),
        },
        بعد: {
          الرقم: رقم_الجديد,
          النوع: ب.نوع_الفاتورة,
          الإجمالي: الإجمالي_النهائي.toString(),
          المصروفات_الإضافية: إجمالي_المصروفات.toString(),
          ...(إبقاء_الدفعات ? { الدفعات: "بلا تغيير" } : {}),
          ...(إعادة_فتح ? { أُعيد_فتحها: true, المسامح_الملغى: حالية.writeOffAmount.toString() } : {}),
          ...(ب.الدفعة ? { دفعة: ب.الدفعة.بنود.reduce((س, بند) => س + Number(بند.المبلغ), 0) } : {}),
        },
      },
    });
  });
  } catch (e) {
    return فشل(رسالة_خطأ_الفاتورة(e, "خطأ أثناء تعديل الفاتورة"));
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/inventory");
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
  return نجح(
    undefined,
    إعادة_فتح
      ? "تم تعديل الفاتورة — اتغيّر إجماليها/دفعاتها فأُلغي إنهاؤها ورجعت معلّقة بالمتبقي الجديد"
      : "تم تعديل الفاتورة وتحديث الرصيد"
  );
}

/** هل وسائل الدفع المرسَلة = حركات الخزنة الحالية للفاتورة (حساب + فرعي + مبلغ، بلا ترتيب)؟ */
function دفعات_مطابقة(
  حالية: { amount: Prisma.Decimal; accountId: number; subAccountId: number | null; kind: string }[],
  مرسلة: { المبلغ: string | null; معرف_الحساب: number; معرف_حساب_فرعي?: number | null }[]
): boolean {
  if (حالية.some((ح) => ح.kind !== "INCOME")) return false;
  if (حالية.length !== مرسلة.length) return false;
  const مفتاح = (حساب: number, فرعي: number | null | undefined, مبلغ: Prisma.Decimal.Value) =>
    `${حساب}|${فرعي ?? ""}|${د(مبلغ).toFixed(4)}`;
  const أ = حالية.map((ح) => مفتاح(ح.accountId, ح.subAccountId, ح.amount)).sort();
  const ب = مرسلة.map((م) => مفتاح(م.معرف_الحساب, م.معرف_حساب_فرعي, م.المبلغ ?? 0)).sort();
  return أ.every((x, i) => x === ب[i]);
}

/**
 * تحصيل فاتورة زائر معلّقة في تاريخ لاحق (وسيلة واحدة أو موزّعة حتى 4) — الخزنة تسجّل المبلغ
 * المحصّل فعلاً دائماً:
 *  - تحصيل: أي مبلغ؛ الأقل من المتبقي يسيبها معلّقة بالباقي، والأكبر زيادته تدخل الخزنة.
 *  - إنهاء (إنهاء=true): نفس التحصيل + قفل الفاتورة (settledAt)؛ النقص مسامحة (writeOffAmount).
 * منع التكرار: قفل صف الفاتورة + رفض أي تحصيل بعد السداد/الإنهاء + مفتاح_العملية (نفس المفتاح
 * مرتين = ضغطة مكررة تُرفض). فواتير الزائر الجديدة فقط (paymentTracked).
 */
export async function حصّل_فاتورة_معلقة(
  id: number,
  مدخلات: unknown
): Promise<نتيجة<{ المحصّل: string; المسامح: string }>> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  if (!Number.isInteger(id) || id <= 0) return فشل("الفاتورة غير موجودة");
  const t = مخطط_تحصيل_فاتورة.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  const تاريخ = تحليل_تاريخ(ب.التاريخ);
  if (!تاريخ) return فشل("تاريخ التحصيل غير صالح");
  const الإجمالي = ب.بنود.reduce((س, بند) => س.plus(د(بند.المبلغ!)), د(0));
  let المسامح = د(0);
  let الزيادة = د(0);
  let الباقي = د(0);

  try {
    await prisma.$transaction(async (tx) => {
      if (!(await اقفل_الفاتورة(tx, id))) throw new Error("الفاتورة غير موجودة");
      const ف = await tx.invoice.findUniqueOrThrow({ where: { id } });
      if (!فاتورة_زائر(ف)) {
        throw new Error("التحصيل اللاحق متاح لفواتير العميل الزائر فقط — فواتير العملاء المسجّلين تُحصَّل من حساب العميل");
      }
      if (!متابَعة_التحصيل(ف)) {
        throw new Error("فاتورة قديمة (قبل نظام الفواتير المعلّقة) — تحصيلها مسجّل خارج المتابعة");
      }
      if (ف.settledAt) throw new Error("الفاتورة منتهية بالفعل — لا تحصيل بعد الإنهاء");
      if (ب.مفتاح_العملية) {
        const مكرر = await tx.activityLog.findFirst({
          where: { entityType: "الفاتورة", entityId: id, details: { path: ["مفتاح_العملية"], equals: ب.مفتاح_العملية } },
          select: { id: true },
        });
        if (مكرر) throw new Error("التحصيل ده اتسجّل بالفعل (ضغطة مكررة) — مفيش حاجة اتسجّلت تاني");
      }
      // نقارن اليوم التقويمي كما يخزّنه عمود DATE (جزء UTC) — لا الطابع الزمني الخام
      const يوم = (x: Date) => x.toISOString().slice(0, 10);
      if (يوم(تاريخ) < يوم(ف.date)) throw new Error("تاريخ التحصيل لا يمكن أن يسبق تاريخ الفاتورة");

      const محصّل = await المحصّل_على_الفاتورة(tx, id);
      const متبقي = طرح(ف.totalAmount, محصّل);
      if (!متبقي.greaterThan(0)) throw new Error("الفاتورة محصّلة بالكامل بالفعل");
      // أي مبلغ مقبول: الأكبر زيادته تدخل الخزنة، والأقل يسيب باقي — إلا مع الإنهاء فيبقى مسامحة
      if (ب.إنهاء && !محصّل.plus(الإجمالي).greaterThan(0)) {
        throw new Error("لا يمكن إنهاء فاتورة بدون أي تحصيل — لو البيعة اتلغت احذف الفاتورة");
      }
      الزيادة = الإجمالي.greaterThan(متبقي) ? طرح(الإجمالي, متبقي) : د(0);
      الباقي = الإجمالي.lessThan(متبقي) ? طرح(متبقي, الإجمالي) : د(0);
      if (ب.إنهاء) المسامح = الباقي;

      // الحسابات موجودة والحساب الفرعي من نفس نوع حساب الخزنة
      const حسابات = await tx.treasuryAccount.findMany({
        where: { id: { in: ب.بنود.map((x) => x.معرف_الحساب) } },
        select: { id: true, type: true },
      });
      for (const بند of ب.بنود) {
        const حساب = حسابات.find((h) => h.id === بند.معرف_الحساب);
        if (!حساب) throw new Error("حساب الخزنة غير موجود");
        if (بند.معرف_حساب_فرعي) {
          const فرعي = await tx.subAccount.findUnique({ where: { id: بند.معرف_حساب_فرعي }, select: { type: true } });
          if (!فرعي || فرعي.type !== حساب.type) throw new Error("الحساب الفرعي لا يتبع حساب الخزنة المختار");
        }
      }

      const رقم = ف.number != null ? String(ف.number) : "";
      if (ب.بنود.length > 0) {
        await سجّل_دفعة_فاتورة(tx, {
          الاتجاه: "تحصيل",
          طرف: null,
          اسم_الطرف_الخارجي: ف.guestName,
          بنود: ب.بنود.map((بند) => ({
            معرف_الحساب: بند.معرف_الحساب,
            معرف_حساب_فرعي: بند.معرف_حساب_فرعي ?? null,
            المبلغ: د(بند.المبلغ!),
          })),
          الإجمالي,
          التاريخ: تاريخ,
          البيان: ب.ملاحظات || `تحصيل فاتورة نقدية معلّقة رقم ${رقم}${ف.guestName ? ` — ${ف.guestName}` : ""}`,
          رقم_الفاتورة: رقم,
          معرف_الفاتورة: id,
          أنشأ: فاعل.id,
        });
      }
      if (ب.إنهاء) {
        await tx.invoice.update({
          where: { id },
          data: { settledAt: new Date(), settledById: فاعل.id, writeOffAmount: المسامح, updatedById: فاعل.id },
        });
      }

      await تسجيل_عملية(tx, {
        المستخدم: فاعل.id,
        العملية: "UPDATE",
        نوع_الكيان: "الفاتورة",
        معرف_الكيان: id,
        التفاصيل: {
          تحصيل_فاتورة_معلقة: true,
          ...(ب.إنهاء ? { إنهاء: true, المسامح: المسامح.toString() } : {}),
          ...(الزيادة.greaterThan(0) ? { الزيادة: الزيادة.toString() } : {}),
          الرقم: ف.number,
          المبلغ: الإجمالي.toString(),
          المتبقي_قبل: متبقي.toString(),
          المتبقي_بعد: ب.إنهاء ? "0" : الباقي.toString(),
          ...(ب.مفتاح_العملية ? { مفتاح_العملية: ب.مفتاح_العملية } : {}),
          عدد_الوسائل: ب.بنود.length,
          تاريخ_التحصيل: ب.التاريخ,
        },
      });
    });
  } catch (e) {
    return فشل(e instanceof Error ? e.message : "خطأ أثناء تحصيل الفاتورة");
  }

  revalidatePath("/invoices");
  revalidatePath(`/invoices/${id}`);
  revalidatePath("/treasury");
  revalidatePath("/dashboard");
  return نجح(
    { المحصّل: الإجمالي.toString(), المسامح: المسامح.toString() },
    المسامح.greaterThan(0)
      ? `تم تحصيل ${تنسيق_مبلغ(الإجمالي)} وإنهاء الفاتورة — مسامحة ${تنسيق_مبلغ(المسامح)}`
      : الزيادة.greaterThan(0)
        ? `تم تحصيل ${تنسيق_مبلغ(الإجمالي)} وإقفال الفاتورة — زيادة ${تنسيق_مبلغ(الزيادة)} دخلت الخزنة`
        : !ب.إنهاء && الباقي.greaterThan(0)
          ? `تم تحصيل ${تنسيق_مبلغ(الإجمالي)} — المتبقي ${تنسيق_مبلغ(الباقي)} والفاتورة لسه معلّقة`
          : ب.إنهاء
            ? `تم تحصيل ${تنسيق_مبلغ(الإجمالي)} وإنهاء الفاتورة`
            : `تم تحصيل ${تنسيق_مبلغ(الإجمالي)} وإقفال الفاتورة`
  );
}

/**
 * ملخص ارتباطات الفاتورة — يُعرض في حوار التأكيد قبل الحذف حتى يرى المستخدم
 * ما الذي سيُعكَس (قيود دفتر الأستاذ + حركات الخزنة) قبل أن يؤكد.
 */
export type ملخص_ارتباطات = {
  الطرف: string | null;
  عدد_القيود: number;
  إجمالي_القيود: number;
  عدد_حركات_الخزنة: number;
  إجمالي_حركات_الخزنة: number;
};
export async function اجلب_ارتباطات_الفاتورة(id: number): Promise<ملخص_ارتباطات> {
  await اطلب_المستخدم();
  const أساسية = await prisma.invoice.findUnique({
    where: { id },
    select: { directInvoiceId: true },
  });
  // الفاتورة المباشرة: الحذف يمسّ الجهتين ⇒ الملخص يعدّ ارتباطات الفاتورتين
  const معرفات = أساسية?.directInvoiceId
    ? (
        await prisma.invoice.findMany({
          where: { directInvoiceId: أساسية.directInvoiceId },
          select: { id: true },
        })
      ).map((f) => f.id)
    : [id];
  const [فاتورة, قيود, حركات] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      select: { customer: { select: { name: true } }, guestName: true },
    }),
    prisma.ledgerEntry.findMany({
      where: { invoiceId: { in: معرفات }, deletedAt: null },
      select: { debit: true, credit: true },
    }),
    prisma.treasuryTxn.findMany({
      where: { invoiceId: { in: معرفات }, deletedAt: null },
      select: { amount: true },
    }),
  ]);
  return {
    الطرف: فاتورة?.customer?.name ?? فاتورة?.guestName ?? null,
    عدد_القيود: قيود.length,
    إجمالي_القيود: قيود.reduce((s, q) => s + Number(q.debit) + Number(q.credit), 0),
    عدد_حركات_الخزنة: حركات.length,
    إجمالي_حركات_الخزنة: حركات.reduce((s, h) => s + Number(h.amount), 0),
  };
}

export async function حذف_فاتورة(id: number): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "حذف");
  const فاتورة = await prisma.invoice.findUnique({ where: { id } });
  if (!فاتورة) return فشل("الفاتورة غير موجودة");

  // الفاتورة المباشرة (مورد ← عميل): الجهتان تُحذفان معاً — لا يصح ترك جهة بلا الأخرى
  const مجموعة = فاتورة.directInvoiceId
    ? await prisma.invoice.findMany({ where: { directInvoiceId: فاتورة.directInvoiceId } })
    : [فاتورة];

  try {
  await prisma.$transaction(async (tx) => {
    for (const ف of مجموعة) {
      // قفل الفاتورة: تحصيل متزامن ينتظر الحذف ثم يجدها غير موجودة (لا حركة خزنة يتيمة)
      if (!(await اقفل_الفاتورة(tx, ف.id))) throw new Error("الفاتورة غير موجودة");
      // المخزن: امنع الحذف لو البضاعة الواردة اتصرفت
      const مانع = await امنع_عكس_غير_آمن(tx, ف.id);
      if (مانع) throw new Error(مانع);
      await اعكس_مخزن_الفاتورة(tx, ف.id);
      // عكس حركات الخزنة المرتبطة بهذه الفاتورة (دفعات + مبيعات نقدية) — وسيلة
      // واحدة أو موزّعة على عدة وسائل — فلا يبقى قيد دفعة يتيم
      await اعكس_دفعات_الفاتورة(tx, ف.id);
      await اعكس_قيود_الفاتورة(tx, ف.id, ف.customerId);
      await tx.invoice.delete({ where: { id: ف.id } }); // البنود Cascade
      await تسجيل_عملية(tx, {
        المستخدم: فاعل.id,
        العملية: "DELETE",
        نوع_الكيان: "الفاتورة",
        معرف_الكيان: ف.id,
        التفاصيل: {
          الرقم: ف.number,
          ...(فاتورة.directInvoiceId ? { مباشرة: true, النوع: ف.invoiceType } : {}),
        },
      });
    }
    if (فاتورة.directInvoiceId) {
      await tx.directInvoice.delete({ where: { id: فاتورة.directInvoiceId } });
    }
    await tx.$executeRaw`
      UPDATE settings
      SET value = COALESCE((SELECT MAX(number)::text FROM invoices), '0')
      WHERE key = 'عداد_الفواتير'
    `;
  });
  } catch (e) {
    return فشل(e instanceof Error ? e.message : "خطأ أثناء حذف الفاتورة");
  }

  revalidatePath("/invoices");
  revalidatePath("/inventory");
  for (const ف of مجموعة) {
    if (!ف.customerId) continue;
    revalidatePath(`/customers/${ف.customerId}`);
    revalidatePath(`/suppliers/${ف.customerId}`);
  }
  return نجح(
    undefined,
    فاتورة.directInvoiceId
      ? "تم حذف الفاتورة المباشرة بجهتيها (المورد والعميل) وعكس قيودها"
      : "تم حذف الفاتورة وعكس قيدها"
  );
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
