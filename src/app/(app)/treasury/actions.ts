"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { اطلب_المستخدم } from "@/lib/session";
import { تحقق_الصلاحية } from "@/lib/authz";
import { تسجيل_عملية } from "@/lib/activity";
import { TxnKind } from "@prisma/client";
import { أضف_حركة_خزنة, أعد_حساب_حساب_الخزنة } from "@/lib/treasury";
import { أنشئ_عملية_مرتبطة, اعكس_عملية_مرتبطة, حذف_دفع_مباشر, type اتجاه } from "@/lib/integration";
import { أضف_قيد } from "@/lib/ledger";
import { نجح, فشل, type نتيجة } from "@/lib/result";
import { تحليل_تاريخ } from "@/lib/date";
import { مسار_صفحة_الطرف } from "@/lib/paths";
import { تسمية_حساب_الخزنة } from "@/lib/enums";
import { مخطط_حركة_خزنة, مخطط_تحويل_خزنة, مخطط_دفع_مباشر, مخطط_تعديل_دفع_مباشر } from "@/lib/schemas/treasury";

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

  // ─── الحالة الجديدة: كانت مرتبطة والمستخدم يتحكم بالطرف صراحةً وأزال الربط ───
  // (من صفحة الخزنة: اختار "طرف خارجي" أو أزال العميل) → افصل القيد عن الطرف
  // القديم (يُعاد حساب رصيده) ثم أنشئ حركة خزنة عادية بلا طرف مسجّل.
  if (حالياً_مرتبط && ب.صريح_الطرف) {
    const طرف_قديم = حالي.party;
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
            التفاصيل: {
              فك_ربط: true,
              من_طرف: طرف_قديم?.id ?? null,
              المبلغ: ب.المبلغ?.toString(),
              اسم_طرف_خارجي: ب.اسم_الطرف_الخارجي ?? null,
            },
          });
        },
        { timeout: 30000 }
      );
    } catch (e) {
      return فشل(e instanceof Error ? e.message : "خطأ أثناء تعديل الحركة");
    }
    revalidatePath("/treasury");
    if (طرف_قديم) revalidatePath(مسار_صفحة_الطرف(طرف_قديم.type, طرف_قديم.id));
    return نجح(undefined, "تم فك ربط الحركة عن الطرف وتحديث حسابه");
  }

  // ─── الحالة 3: كانت مرتبطة والآن بدون طرف → أعد التطبيق بنفس الطرف القديم ───
  // (المحرر لا يرسل معرف_الطرف لأنه ضمني من صفحة الطرف — لا نفك الربط أبدًا تلقائيًا)
  if (حالياً_مرتبط) {
    const طرف = حالي.party;
    if (!طرف) return فشل("الطرف المرتبط غير موجود");
    const الاتجاه: اتجاه = ب.النوع === "INCOME" ? "تحصيل" : "صرف";
    try {
      await prisma.$transaction(
        async (tx) => {
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
            التفاصيل: { عملية_مرتبطة: true, حفظ_ربط_قديم: true, المبلغ: ب.المبلغ?.toString() },
          });
        },
        { timeout: 30000 }
      );
    } catch (e) {
      return فشل(e instanceof Error ? e.message : "خطأ أثناء تعديل الحركة");
    }
    revalidatePath("/treasury");
    revalidatePath(مسار_صفحة_الطرف(طرف.type, طرف.id));
    return نجح(undefined, "تم تعديل العملية وتحديث حساب الطرف");
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
  const مدفوعات_مباشرة_معالجة = new Set<number>();
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

          // دفع مباشر → عكس الثلاثي (مرة واحدة فقط لكل directPaymentId)
          if (حالي.directPaymentId && !مدفوعات_مباشرة_معالجة.has(حالي.directPaymentId)) {
            مدفوعات_مباشرة_معالجة.add(حالي.directPaymentId);
            const قيود = await tx.ledgerEntry.findMany({
              where: { directPaymentId: حالي.directPaymentId, deletedAt: null },
              include: { party: { select: { type: true, id: true } } },
            });
            for (const قيد of قيود) {
              أطراف_متأثرة.add(مسار_صفحة_الطرف(قيد.party.type, قيد.partyId));
            }
            await حذف_دفع_مباشر(tx, حالي.directPaymentId);
          } else if (!حالي.directPaymentId) {
            await اعكس_عملية_مرتبطة(tx, id);
          }
          await تسجيل_عملية(tx, {
            المستخدم: فاعل.id,
            العملية: "DELETE",
            نوع_الكيان: حالي.directPaymentId ? "دفع_مباشر" : "حركة_الخزنة",
            معرف_الكيان: حالي.directPaymentId ?? id,
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

  // ─── دفع مباشر: نعكس العملية الثلاثية كاملة ─────────────────────────────
  if (حالي.directPaymentId) {
    const معرف_الدفع = حالي.directPaymentId;
    const قيود = await prisma.ledgerEntry.findMany({
      where: { directPaymentId: معرف_الدفع, deletedAt: null },
      include: { party: { select: { type: true, id: true } } },
    });
    try {
      await prisma.$transaction(async (tx) => {
        await حذف_دفع_مباشر(tx, معرف_الدفع);
        await تسجيل_عملية(tx, {
          المستخدم: فاعل.id,
          العملية: "DELETE",
          نوع_الكيان: "دفع_مباشر",
          معرف_الكيان: معرف_الدفع,
          التفاصيل: { المبلغ: حالي.amount.toString(), من_خزنة: true },
        });
      }, { timeout: 30000 });
    } catch (e) {
      return فشل(e instanceof Error ? e.message : "خطأ أثناء حذف الدفع المباشر");
    }
    revalidatePath("/treasury");
    for (const قيد of قيود) revalidatePath(مسار_صفحة_الطرف(قيد.party.type, قيد.partyId));
    return نجح(undefined, "تم حذف الدفع المباشر وعكسه من العميل والمورد والخزنة");
  }

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
 * دفع مباشر من عميل إلى مورد — عملية ثلاثية مرتبطة:
 * قيد دائن على العميل + قيد مدين على المورد + إيراد في الخزنة.
 * الثلاثة مربوطة عبر DirectPayment — الحذف أو التعديل من أي جهة يُطبَّق على الكل.
 */
export async function دفع_مباشر_من_عميل_لمورد(مدخلات: unknown): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_دفع_مباشر.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  const تاريخ = تحليل_تاريخ(ب.التاريخ) ?? new Date();

  const عميل_خارجي = ب.اسم_العميل_الخارجي?.trim() || null;
  const [عميل, مورد, حساب] = await Promise.all([
    ب.معرف_العميل ? prisma.party.findUnique({ where: { id: ب.معرف_العميل } }) : Promise.resolve(null),
    prisma.party.findUnique({ where: { id: ب.معرف_المورد } }),
    prisma.treasuryAccount.findUnique({ where: { id: ب.معرف_الحساب } }),
  ]);
  // العميل: إمّا مسجّل صحيح، أو عابر بالاسم — أحدهما مطلوب
  if (ب.معرف_العميل && (!عميل || عميل.type !== "CUSTOMER")) return فشل("العميل غير موجود");
  if (!عميل && !عميل_خارجي) return فشل("اختر العميل أو اكتب اسمه");
  if (!مورد || مورد.type !== "SUPPLIER") return فشل("المورد غير موجود");
  if (!حساب) return فشل("حساب الخزنة غير موجود");

  const اسم_العميل = عميل?.name ?? عميل_خارجي!;
  const بيان = ب.البيان?.trim() || `دفع مباشر: ${اسم_العميل} ← ${مورد.name}`;

  try {
    await prisma.$transaction(async (tx) => {
      // 1. سجل الربط الثلاثي
      const رابط = await tx.directPayment.create({ data: {} });

      // 2. قيد دائن على العميل → يقلل مديونيته (فقط لو العميل مسجّل)
      let معرف_قيد_العميل: number | null = null;
      if (عميل) {
        const قيد_عميل = await أضف_قيد(tx, {
          معرف_الطرف: عميل.id,
          التاريخ: تاريخ,
          البيان: بيان,
          دائن: ب.المبلغ,
          أنشأ: فاعل.id,
        });
        await tx.ledgerEntry.update({
          where: { id: قيد_عميل.id },
          data: { directPaymentId: رابط.id },
        });
        معرف_قيد_العميل = قيد_عميل.id;
      }

      // 3. قيد مدين على المورد → يقلل المستحق له
      const قيد_مورد = await أضف_قيد(tx, {
        معرف_الطرف: مورد.id,
        التاريخ: تاريخ,
        البيان: بيان,
        مدين: ب.المبلغ,
        أنشأ: فاعل.id,
      });
      await tx.ledgerEntry.update({
        where: { id: قيد_مورد.id },
        data: { directPaymentId: رابط.id },
      });

      // 4. تسجيل التحويل في الخزنة (نوع TRANSFER = يظهر بدون تأثير على الرصيد)
      const حركة_خزنة = await أضف_حركة_خزنة(tx, {
        التاريخ: تاريخ,
        النوع: TxnKind.TRANSFER,
        المبلغ: ب.المبلغ,
        معرف_الحساب: ب.معرف_الحساب,
        معرف_حساب_فرعي: ب.معرف_حساب_فرعي ?? null,
        البيان: بيان,
        معرف_الطرف: عميل?.id ?? null,
        اسم_الطرف_الخارجي: عميل ? null : عميل_خارجي,
        أنشأ: فاعل.id,
      });
      await tx.treasuryTxn.update({
        where: { id: حركة_خزنة.id },
        data: { directPaymentId: رابط.id },
      });

      await تسجيل_عملية(tx, {
        المستخدم: فاعل.id,
        العملية: "CREATE",
        نوع_الكيان: "دفع_مباشر",
        معرف_الكيان: رابط.id,
        التفاصيل: {
          عميل: اسم_العميل,
          عميل_خارجي: !عميل,
          مورد: مورد.name,
          المبلغ: String(ب.المبلغ),
          الحساب: حساب.type,
          معرف_قيد_العميل,
          معرف_قيد_المورد: قيد_مورد.id,
          معرف_حركة_الخزنة: حركة_خزنة.id,
        },
      });
    });
  } catch (e) {
    return فشل(e instanceof Error ? e.message : "خطأ أثناء الدفع المباشر");
  }

  revalidatePath("/treasury");
  if (عميل) revalidatePath(مسار_صفحة_الطرف("CUSTOMER", عميل.id));
  revalidatePath(مسار_صفحة_الطرف("SUPPLIER", مورد.id));
  return نجح(undefined, `تم الدفع المباشر — ${اسم_العميل} ✓ ${مورد.name}`);
}

/**
 * تعديل دفع مباشر — يطبّق التغيير على قيد العميل وقيد المورد وحركة الخزنة معاً.
 * المعرّف هو معرّف LedgerEntry — نستخرج directPaymentId منه.
 */
export async function تعديل_دفع_مباشر(
  معرف_القيد: number,
  مدخلات: unknown
): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const t = مخطط_تعديل_دفع_مباشر.safeParse(مدخلات);
  if (!t.success) return فشل(t.error.errors[0].message);
  const ب = t.data;
  const تاريخ = تحليل_تاريخ(ب.التاريخ) ?? new Date();

  const قيد_حالي = await prisma.ledgerEntry.findUnique({
    where: { id: معرف_القيد },
    select: { directPaymentId: true },
  });
  if (!قيد_حالي?.directPaymentId) return فشل("هذه الحركة ليست دفعاً مباشراً");

  const معرف_الدفع = قيد_حالي.directPaymentId;

  const [قيود, حركات] = await Promise.all([
    prisma.ledgerEntry.findMany({
      where: { directPaymentId: معرف_الدفع, deletedAt: null },
      include: { party: { select: { type: true } } },
    }),
    prisma.treasuryTxn.findMany({
      where: { directPaymentId: معرف_الدفع, deletedAt: null },
      select: { id: true, accountId: true, partyId: true, externalPartyName: true },
    }),
  ]);

  const مورد_قيد = قيود.find((q) => Number(q.debit) > 0);
  if (!مورد_قيد) return فشل("هيكل الدفع المباشر غير مكتمل");
  // قيد العميل قد لا يوجد (عميل عابر بالاسم) — الاسم محفوظ في حركة الخزنة
  const عميل_قيد = قيود.find((q) => Number(q.credit) > 0) ?? null;
  const حركة_قديمة = حركات[0] ?? null;
  const اسم_عميل_خارجي = عميل_قيد ? null : (حركة_قديمة?.externalPartyName ?? null);

  const بيان = ب.البيان?.trim() || مورد_قيد.description;

  try {
    await prisma.$transaction(async (tx) => {
      // 1. حذف ناعم لكل السجلات القديمة + إعادة حساب أرصدة الجانبين
      await حذف_دفع_مباشر(tx, معرف_الدفع);

      // 2. إعادة إنشاء قيد العميل (فقط لو العميل مسجّل)
      if (عميل_قيد) {
        const قيد_عميل_جديد = await أضف_قيد(tx, {
          معرف_الطرف: عميل_قيد.partyId,
          التاريخ: تاريخ,
          البيان: بيان,
          دائن: ب.المبلغ,
          أنشأ: فاعل.id,
        });
        await tx.ledgerEntry.update({
          where: { id: قيد_عميل_جديد.id },
          data: { directPaymentId: معرف_الدفع },
        });
      }

      // 3. إعادة إنشاء قيد المورد
      const قيد_مورد_جديد = await أضف_قيد(tx, {
        معرف_الطرف: مورد_قيد.partyId,
        التاريخ: تاريخ,
        البيان: بيان,
        مدين: ب.المبلغ,
        أنشأ: فاعل.id,
      });
      await tx.ledgerEntry.update({
        where: { id: قيد_مورد_جديد.id },
        data: { directPaymentId: معرف_الدفع },
      });

      // 4. إعادة إنشاء حركة الخزنة (TRANSFER = بلا تأثير على الرصيد)
      const حركة_جديدة = await أضف_حركة_خزنة(tx, {
        التاريخ: تاريخ,
        النوع: TxnKind.TRANSFER,
        المبلغ: ب.المبلغ,
        معرف_الحساب: ب.معرف_الحساب,
        معرف_حساب_فرعي: ب.معرف_حساب_فرعي ?? null,
        البيان: بيان,
        معرف_الطرف: عميل_قيد?.partyId ?? null,
        اسم_الطرف_الخارجي: اسم_عميل_خارجي,
        أنشأ: فاعل.id,
      });
      await tx.treasuryTxn.update({
        where: { id: حركة_جديدة.id },
        data: { directPaymentId: معرف_الدفع },
      });

      await تسجيل_عملية(tx, {
        المستخدم: فاعل.id,
        العملية: "UPDATE",
        نوع_الكيان: "دفع_مباشر",
        معرف_الكيان: معرف_الدفع,
        التفاصيل: { المبلغ: ب.المبلغ?.toString(), التاريخ: ب.التاريخ },
      });
    }, { timeout: 30000 });
  } catch (e) {
    return فشل(e instanceof Error ? e.message : "خطأ أثناء تعديل الدفع المباشر");
  }

  revalidatePath("/treasury");
  if (عميل_قيد) revalidatePath(مسار_صفحة_الطرف(عميل_قيد.party.type, عميل_قيد.partyId));
  revalidatePath(مسار_صفحة_الطرف(مورد_قيد.party.type, مورد_قيد.partyId));
  return نجح(undefined, "تم تعديل الدفع المباشر وتحديث جميع الأطراف");
}

/**
 * تعديل دفع مباشر بدءاً من معرّف حركة الخزنة (للاستخدام من صفحة الخزنة).
 * يبحث عن قيد الأستاذ المرتبط ويُحيل إلى تعديل_دفع_مباشر.
 */
export async function تعديل_دفع_مباشر_من_خزنة(
  معرف_الحركة: number,
  مدخلات: unknown
): Promise<نتيجة> {
  const حركة = await prisma.treasuryTxn.findUnique({
    where: { id: معرف_الحركة },
    select: { directPaymentId: true },
  });
  if (!حركة?.directPaymentId) return فشل("هذه الحركة ليست دفعاً مباشراً");

  const قيد = await prisma.ledgerEntry.findFirst({
    where: { directPaymentId: حركة.directPaymentId, deletedAt: null },
    select: { id: true },
  });
  if (!قيد) return فشل("لم يُعثر على قيود الدفع المباشر");

  return تعديل_دفع_مباشر(قيد.id, مدخلات);
}
