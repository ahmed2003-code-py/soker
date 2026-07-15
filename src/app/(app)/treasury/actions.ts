"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { اطلب_المستخدم } from "@/lib/session";
import { تحقق_الصلاحية } from "@/lib/authz";
import { تسجيل_عملية } from "@/lib/activity";
import { TxnKind } from "@prisma/client";
import { أضف_حركة_خزنة, أعد_حساب_حساب_الخزنة } from "@/lib/treasury";
import { أنشئ_عملية_مرتبطة, اعكس_عملية_مرتبطة, type اتجاه } from "@/lib/integration";
import { أضف_قيد } from "@/lib/ledger";
import { نجح, فشل, type نتيجة } from "@/lib/result";
import { تحليل_تاريخ } from "@/lib/date";
import { مسار_صفحة_الطرف } from "@/lib/paths";
import { تسمية_حساب_الخزنة } from "@/lib/enums";
import { مخطط_حركة_خزنة, مخطط_تحويل_خزنة, مخطط_دفع_مباشر } from "@/lib/schemas/treasury";

/** هل ستجعل الحركة رصيد الحساب سالباً؟ (للتنبيه فقط — مسموح) */
async function سيصبح_سالباً(معرف_الحساب: number): Promise<boolean> {
  const ح = await prisma.treasuryAccount.findUnique({ where: { id: معرف_الحساب } });
  return ح ? Number(ح.balance) < 0 : false;
}

export async function تسجيل_حركة(مدخلات: unknown): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_حركة_خزنة.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  const تاريخ = تحليل_تاريخ(ب.التاريخ) ?? new Date();

  // إذا كان الطرف عميلاً مسجّلاً → عملية مرتبطة (خزنة + دفتر أستاذ)
  if (ب.معرف_الطرف) {
    const طرف = await prisma.party.findUnique({ where: { id: ب.معرف_الطرف } });
    if (!طرف) return فشل("الطرف غير موجود");
    const الاتجاه: اتجاه = ب.النوع === "INCOME" ? "تحصيل" : "صرف";
    await prisma.$transaction(async (tx) => {
      const r = await أنشئ_عملية_مرتبطة(tx, {
        الاتجاه,
        معرف_الطرف: طرف.id,
        اسم_الطرف: طرف.name,
        المبلغ: ب.المبلغ!,
        التاريخ: تاريخ,
        معرف_الحساب: ب.معرف_الحساب,
        معرف_حساب_فرعي: ب.معرف_حساب_فرعي ?? null,
        طريقة_الدفع: null,
        البيان: ب.البيان,
        أنشأ: فاعل.id,
      });
      await تسجيل_عملية(tx, {
        المستخدم: فاعل.id,
        العملية: "CREATE",
        نوع_الكيان: "حركة_الخزنة",
        معرف_الكيان: r.معرف_حركة_الخزنة,
        التفاصيل: { النوع: ب.النوع, المبلغ: ب.المبلغ, الحساب: ب.معرف_الحساب, مرتبط: true },
      });
    });
    revalidatePath("/treasury");
    revalidatePath(مسار_صفحة_الطرف(طرف.type, طرف.id));
    return نجح(undefined, "تم التسجيل وتحديث حساب العميل/المورد");
  }

  // بدون طرف مسجّل → حركة خزنة عادية (مع اسم طرف خارجي اختياري)
  const حركة = await prisma.$transaction(async (tx) => {
    const h = await أضف_حركة_خزنة(tx, {
      التاريخ: تاريخ,
      النوع: ب.النوع,
      المبلغ: ب.المبلغ!,
      معرف_الحساب: ب.معرف_الحساب,
      معرف_حساب_فرعي: ب.معرف_حساب_فرعي ?? null,
      البيان: ب.البيان,
      معرف_الطرف: null,
      اسم_الطرف_الخارجي: ب.اسم_الطرف_الخارجي ?? null,
      طريقة_الدفع: null,
      أنشأ: فاعل.id,
    });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "CREATE",
      نوع_الكيان: "حركة_الخزنة",
      معرف_الكيان: h.id,
      التفاصيل: { النوع: ب.النوع, المبلغ: ب.المبلغ, الحساب: ب.معرف_الحساب },
    });
    return h;
  });

  revalidatePath("/treasury");
  const سالب = ب.النوع === "EXPENSE" && (await سيصبح_سالباً(ب.معرف_الحساب));
  return نجح(undefined, سالب ? "تم التسجيل (تنبيه: رصيد الحساب أصبح سالباً)" : "تم تسجيل الحركة");
}

export async function تعديل_حركة_خزنة(id: number, مدخلات: unknown): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_حركة_خزنة.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  const حالي = await prisma.treasuryTxn.findUnique({
    where: { id },
    include: { party: true },
  });
  if (!حالي) return فشل("الحركة غير موجودة");
  const تاريخ = تحليل_تاريخ(ب.التاريخ) ?? new Date();

  // هل الحركة الحالية مرتبطة بطرف؟
  const حالياً_مرتبط = !!حالي.partyId;
  // هل يريد المستخدم الربط بطرف (جديد أو نفس القديم)؟
  const مطلوب_ربط = !!ب.معرف_الطرف;

  // ─── الحالة 1 و 2: المستخدم يريد ربط الحركة بطرف (إضافة أو تغيير) ───────
  if (مطلوب_ربط) {
    const طرف = await prisma.party.findUnique({ where: { id: ب.معرف_الطرف! } });
    if (!طرف) return فشل("الطرف غير موجود");
    const الاتجاه: اتجاه = ب.النوع === "INCOME" ? "تحصيل" : "صرف";
    try {
      await prisma.$transaction(
        async (tx) => {
          // اعكس_عملية_مرتبطة تعمل على كلا الحالتين: مرتبطة (تحذف القيد والحركة) أو عادية (تحذف الحركة فقط)
          await اعكس_عملية_مرتبطة(tx, id);
          const r = await أنشئ_عملية_مرتبطة(tx, {
            الاتجاه,
            معرف_الطرف: طرف.id,
            اسم_الطرف: طرف.name,
            المبلغ: ب.المبلغ!,
            التاريخ: تاريخ,
            معرف_الحساب: ب.معرف_الحساب,
            معرف_حساب_فرعي: ب.معرف_حساب_فرعي ?? null,
            طريقة_الدفع: null,
            البيان: ب.البيان,
            أنشأ: فاعل.id,
          });
          await تسجيل_عملية(tx, {
            المستخدم: فاعل.id,
            العملية: "UPDATE",
            نوع_الكيان: "حركة_الخزنة",
            معرف_الكيان: r.معرف_حركة_الخزنة,
            التفاصيل: { عملية_مرتبطة: true, عكس_وإعادة_تطبيق: true, المبلغ: ب.المبلغ?.toString() },
          });
        },
        { timeout: 30000 }
      );
    } catch (e) {
      return فشل(e instanceof Error ? e.message : "خطأ أثناء تعديل الحركة");
    }
    revalidatePath("/treasury");
    revalidatePath(مسار_صفحة_الطرف(طرف.type, طرف.id));
    // لو تغيّر الطرف → revalidate الطرف القديم كمان
    if (حالياً_مرتبط && حالي.party && حالي.party.id !== طرف.id) {
      revalidatePath(مسار_صفحة_الطرف(حالي.party.type, حالي.party.id));
    }
    return نجح(undefined, "تم تعديل العملية وتحديث حساب العميل/المورد");
  }

  // ─── الحالة 3: كانت مرتبطة والآن بدون طرف → فك الربط وإنشاء حركة عادية ───
  if (حالياً_مرتبط) {
    try {
      await prisma.$transaction(
        async (tx) => {
          await اعكس_عملية_مرتبطة(tx, id);
          const h = await أضف_حركة_خزنة(tx, {
            التاريخ: تاريخ,
            النوع: ب.النوع,
            المبلغ: ب.المبلغ!,
            معرف_الحساب: ب.معرف_الحساب,
            معرف_حساب_فرعي: ب.معرف_حساب_فرعي ?? null,
            البيان: ب.البيان,
            معرف_الطرف: null,
            اسم_الطرف_الخارجي: ب.اسم_الطرف_الخارجي ?? null,
            طريقة_الدفع: null,
            أنشأ: فاعل.id,
          });
          await تسجيل_عملية(tx, {
            المستخدم: فاعل.id,
            العملية: "UPDATE",
            نوع_الكيان: "حركة_الخزنة",
            معرف_الكيان: h.id,
            التفاصيل: { فك_ربط: true, المبلغ: ب.المبلغ?.toString(), من: id },
          });
        },
        { timeout: 30000 }
      );
    } catch (e) {
      return فشل(e instanceof Error ? e.message : "خطأ أثناء تعديل الحركة");
    }
    revalidatePath("/treasury");
    if (حالي.party) revalidatePath(مسار_صفحة_الطرف(حالي.party.type, حالي.party.id));
    return نجح(undefined, "تم تعديل الحركة وإزالة ربطها بالطرف");
  }

  // ─── الحالة 4: بدون طرف قبل وبدون طرف بعد → تعديل بسيط ─────────────────
  try {
    await prisma.$transaction(
      async (tx) => {
        await tx.treasuryTxn.update({
          where: { id },
          data: {
            date: تاريخ,
            kind: ب.النوع,
            amount: ب.المبلغ!,
            accountId: ب.معرف_الحساب,
            subAccountId: ب.معرف_حساب_فرعي ?? null,
            description: ب.البيان,
            externalPartyName: ب.اسم_الطرف_الخارجي ?? null,
            method: null,
            updatedById: فاعل.id,
          },
        });
        if (حالي.accountId !== ب.معرف_الحساب) {
          await أعد_حساب_حساب_الخزنة(tx, حالي.accountId);
        }
        await أعد_حساب_حساب_الخزنة(tx, ب.معرف_الحساب);
        await تسجيل_عملية(tx, {
          المستخدم: فاعل.id,
          العملية: "UPDATE",
          نوع_الكيان: "حركة_الخزنة",
          معرف_الكيان: id,
          التفاصيل: {
            قبل: { النوع: حالي.kind, المبلغ: حالي.amount.toString(), الحساب: حالي.accountId },
            بعد: { النوع: ب.النوع, المبلغ: ب.المبلغ?.toString(), الحساب: ب.معرف_الحساب },
          },
        });
      },
      { timeout: 30000 }
    );
  } catch (e) {
    return فشل(e instanceof Error ? e.message : "خطأ أثناء تعديل الحركة");
  }
  revalidatePath("/treasury");
  return نجح(undefined, "تم تعديل الحركة وإعادة حساب الأرصدة");
}

export async function حذف_حركات_خزنة_متعددة(ids: number[]): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "حذف");
  if (!ids.length) return فشل("لم تُحدد أي حركات");

  const أطراف_متأثرة = new Set<string>();
  try {
    await prisma.$transaction(
      async (tx) => {
        for (const id of ids) {
          const حالي = await tx.treasuryTxn.findUnique({
            where: { id },
            include: { party: { select: { type: true, id: true } } },
          });
          if (!حالي) continue;
          if (حالي.party) أطراف_متأثرة.add(مسار_صفحة_الطرف(حالي.party.type, حالي.party.id));
          await اعكس_عملية_مرتبطة(tx, id);
          await تسجيل_عملية(tx, {
            المستخدم: فاعل.id,
            العملية: "DELETE",
            نوع_الكيان: "حركة_الخزنة",
            معرف_الكيان: id,
            التفاصيل: { حذف_جماعي: true, النوع: حالي.kind, المبلغ: حالي.amount.toString() },
          });
        }
      },
      { timeout: 60000 }
    );
  } catch (e) {
    const رسالة = e instanceof Error ? e.message : "خطأ أثناء الحذف الجماعي";
    return فشل(رسالة);
  }

  revalidatePath("/treasury");
  for (const مسار of أطراف_متأثرة) revalidatePath(مسار);
  return نجح(undefined, `تم حذف ${ids.length} حركة وإعادة حساب الأرصدة`);
}

export async function حذف_حركة_خزنة(id: number): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "حذف");

  const حالي = await prisma.treasuryTxn.findUnique({
    where: { id },
    include: { party: true },
  });
  if (!حالي) return فشل("الحركة غير موجودة");

  // تحقق مباشر من وجود قيد مرتبط (أكثر موثوقية من back-relation)
  const قيد_مرتبط = await prisma.ledgerEntry.findFirst({
    where: { treasuryTxnId: id, deletedAt: null },
    select: { id: true },
  });

  try {
    // اعكس_عملية_مرتبطة تتعامل مع الحالتين (مرتبط/غير مرتبط)
    await prisma.$transaction(
      async (tx) => {
        await اعكس_عملية_مرتبطة(tx, id);
        await تسجيل_عملية(tx, {
          المستخدم: فاعل.id,
          العملية: "DELETE",
          نوع_الكيان: "حركة_الخزنة",
          معرف_الكيان: id,
          التفاصيل: {
            النوع: حالي.kind,
            المبلغ: حالي.amount.toString(),
            الحساب: حالي.accountId,
            ...(قيد_مرتبط ? { عكس_كامل: true } : {}),
          },
        });
      },
      { timeout: 30000 }
    );
  } catch (e) {
    const رسالة = e instanceof Error ? e.message : "خطأ أثناء حذف الحركة";
    return فشل(رسالة);
  }

  revalidatePath("/treasury");
  if (حالي.party) revalidatePath(مسار_صفحة_الطرف(حالي.party.type, حالي.party.id));
  return نجح(
    undefined,
    قيد_مرتبط ? "تم حذف العملية وعكس قيدها من حساب الطرف" : "تم حذف الحركة وإعادة حساب الرصيد"
  );
}

/**
 * تحويل مبلغ بين حسابَي خزنة — معاملة ذرّية:
 * مصروف من الحساب المصدر + إيراد إلى الحساب الوجهة.
 */
export async function تحويل_بين_الخزائن(مدخلات: unknown): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_تحويل_خزنة.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  const تاريخ = تحليل_تاريخ(ب.التاريخ) ?? new Date();

  const [من, إلى, فرعي_من, فرعي_إلى] = await Promise.all([
    prisma.treasuryAccount.findUnique({ where: { id: ب.من_الحساب } }),
    prisma.treasuryAccount.findUnique({ where: { id: ب.إلى_الحساب } }),
    ب.معرف_حساب_فرعي_من ? prisma.subAccount.findUnique({ where: { id: ب.معرف_حساب_فرعي_من } }) : Promise.resolve(null),
    ب.معرف_حساب_فرعي_إلى ? prisma.subAccount.findUnique({ where: { id: ب.معرف_حساب_فرعي_إلى } }) : Promise.resolve(null),
  ]);
  if (!من || !إلى) return فشل("حساب غير موجود");

  const اسم_من = فرعي_من ? `${تسمية_حساب_الخزنة[من.type]} — ${فرعي_من.name}` : تسمية_حساب_الخزنة[من.type];
  const اسم_إلى = فرعي_إلى ? `${تسمية_حساب_الخزنة[إلى.type]} — ${فرعي_إلى.name}` : تسمية_حساب_الخزنة[إلى.type];
  const بيان_خروج = ب.البيان?.trim() || `تحويل إلى ${اسم_إلى}`;
  const بيان_دخول = ب.البيان?.trim() ? ب.البيان.trim() : `تحويل من ${اسم_من}`;

  try {
    await prisma.$transaction(async (tx) => {
      const خروج = await أضف_حركة_خزنة(tx, {
        التاريخ: تاريخ,
        النوع: TxnKind.EXPENSE,
        المبلغ: ب.المبلغ,
        معرف_الحساب: ب.من_الحساب,
        البيان: بيان_خروج,
        معرف_حساب_فرعي: ب.معرف_حساب_فرعي_من ?? null,
        أنشأ: فاعل.id,
      });
      const دخول = await أضف_حركة_خزنة(tx, {
        التاريخ: تاريخ,
        النوع: TxnKind.INCOME,
        المبلغ: ب.المبلغ,
        معرف_الحساب: ب.إلى_الحساب,
        البيان: بيان_دخول,
        معرف_حساب_فرعي: ب.معرف_حساب_فرعي_إلى ?? null,
        أنشأ: فاعل.id,
      });
      await تسجيل_عملية(tx, {
        المستخدم: فاعل.id,
        العملية: "CREATE",
        نوع_الكيان: "حركة_الخزنة",
        معرف_الكيان: خروج.id,
        التفاصيل: {
          نوع: "تحويل",
          من: اسم_من,
          إلى: اسم_إلى,
          المبلغ: String(ب.المبلغ),
          معرف_حركة_الدخول: دخول.id,
        },
      });
    });
  } catch (e) {
    return فشل(e instanceof Error ? e.message : "خطأ أثناء التحويل");
  }

  revalidatePath("/treasury");
  return نجح(undefined, `تم التحويل من ${اسم_من} إلى ${اسم_إلى} بنجاح`);
}

/**
 * دفع مباشر من عميل إلى مورد بدون المرور بالخزنة:
 * قيد دائن على العميل (يقلل مديونيته) + قيد مدين على المورد (يقلل مستحقاته).
 */
export async function دفع_مباشر_من_عميل_لمورد(مدخلات: unknown): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_دفع_مباشر.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  const تاريخ = تحليل_تاريخ(ب.التاريخ) ?? new Date();

  const [عميل, مورد] = await Promise.all([
    prisma.party.findUnique({ where: { id: ب.معرف_العميل } }),
    prisma.party.findUnique({ where: { id: ب.معرف_المورد } }),
  ]);
  if (!عميل || عميل.type !== "CUSTOMER") return فشل("العميل غير موجود");
  if (!مورد || مورد.type !== "SUPPLIER") return فشل("المورد غير موجود");

  const بيان = ب.البيان?.trim() || `دفع مباشر: ${عميل.name} ← ${مورد.name}`;

  try {
    await prisma.$transaction(async (tx) => {
      // دائن على العميل → يقلل ما يدين به لنا
      const قيد_عميل = await أضف_قيد(tx, {
        معرف_الطرف: عميل.id,
        التاريخ: تاريخ,
        البيان: بيان,
        دائن: ب.المبلغ,
        أنشأ: فاعل.id,
      });
      // مدين على المورد → يقلل ما نستحقه له
      const قيد_مورد = await أضف_قيد(tx, {
        معرف_الطرف: مورد.id,
        التاريخ: تاريخ,
        البيان: بيان,
        مدين: ب.المبلغ,
        أنشأ: فاعل.id,
      });
      await تسجيل_عملية(tx, {
        المستخدم: فاعل.id,
        العملية: "CREATE",
        نوع_الكيان: "حركة_الحساب",
        معرف_الكيان: قيد_عميل.id,
        التفاصيل: {
          نوع: "دفع_مباشر",
          عميل: عميل.name,
          مورد: مورد.name,
          المبلغ: String(ب.المبلغ),
          معرف_قيد_المورد: قيد_مورد.id,
        },
      });
    });
  } catch (e) {
    return فشل(e instanceof Error ? e.message : "خطأ أثناء الدفع المباشر");
  }

  revalidatePath("/treasury");
  revalidatePath(مسار_صفحة_الطرف("CUSTOMER", عميل.id));
  revalidatePath(مسار_صفحة_الطرف("SUPPLIER", مورد.id));
  return نجح(undefined, `تم الدفع المباشر — ${عميل.name} ✓ ${مورد.name}`);
}
