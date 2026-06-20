"use server";
import { revalidatePath } from "next/cache";
import { prisma } from "@/lib/prisma";
import { اطلب_المستخدم } from "@/lib/session";
import { تحقق_الصلاحية } from "@/lib/authz";
import { تسجيل_عملية } from "@/lib/activity";
import { أضف_حركة_خزنة, أعد_حساب_حساب_الخزنة } from "@/lib/treasury";
import { أنشئ_عملية_مرتبطة, اعكس_عملية_مرتبطة, type اتجاه } from "@/lib/integration";
import { نجح, فشل, type نتيجة } from "@/lib/result";
import { تحليل_تاريخ } from "@/lib/date";
import { مسار_صفحة_الطرف } from "@/lib/paths";
import { مخطط_حركة_خزنة } from "@/lib/schemas/treasury";

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

  // تحقق مباشر من وجود قيد مرتبط (أكثر موثوقية من back-relation)
  const قيد_مرتبط = await prisma.ledgerEntry.findFirst({
    where: { treasuryTxnId: id, deletedAt: null },
    select: { id: true },
  });

  // عملية مرتبطة بطرف → عكس وإعادة تطبيق (الجانبان متّسقان)
  if (قيد_مرتبط && حالي.party) {
    const الاتجاه: اتجاه = ب.النوع === "INCOME" ? "تحصيل" : "صرف";
    try {
      await prisma.$transaction(
        async (tx) => {
          await اعكس_عملية_مرتبطة(tx, id);
          const r = await أنشئ_عملية_مرتبطة(tx, {
            الاتجاه,
            معرف_الطرف: حالي.party!.id,
            اسم_الطرف: حالي.party!.name,
            المبلغ: ب.المبلغ!,
            التاريخ: تاريخ,
            معرف_الحساب: ب.معرف_الحساب,
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
      const رسالة = e instanceof Error ? e.message : "خطأ أثناء تعديل الحركة";
      return فشل(رسالة);
    }
    revalidatePath("/treasury");
    revalidatePath(مسار_صفحة_الطرف(حالي.party.type, حالي.party.id));
    return نجح(undefined, "تم تعديل العملية المرتبطة (عكس وإعادة تطبيق)");
  }

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
    const رسالة = e instanceof Error ? e.message : "خطأ أثناء تعديل الحركة";
    return فشل(رسالة);
  }
  revalidatePath("/treasury");
  return نجح(undefined, "تم تعديل الحركة وإعادة حساب الأرصدة");
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
