"use server";
import { revalidatePath } from "next/cache";
import { z } from "zod";
import { prisma } from "@/lib/prisma";
import { اطلب_المستخدم } from "@/lib/session";
import { تحقق_الصلاحية } from "@/lib/authz";
import { تسجيل_عملية } from "@/lib/activity";
import { نجح, فشل, type نتيجة } from "@/lib/result";
import { تحليل_مبلغ } from "@/lib/money";

const مخطط_عام = z.object({
  اسم_الشركة: z.string().trim().min(2, "اسم الشركة مطلوب"),
  حد_الائتمان_الافتراضي: z.string().optional().default("0"),
  طرق_الدفع: z.array(z.string().trim().min(1)).min(1, "اختر طريقة دفع واحدة على الأقل"),
});

const مخطط_حدود_الخزنة = z.record(z.string(), z.string()); // {accountId: minThreshold}

export type قيم_الإعدادات_العامة = z.infer<typeof مخطط_عام>;

/** تحديث الإعدادات العامة (اسم الشركة، حد الائتمان، طرق الدفع) */
export async function حفظ_الإعدادات_العامة(مدخلات: unknown): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "إدارة_الإعدادات");
  const تحليل = مخطط_عام.safeParse(مدخلات);
  if (!تحليل.success) return فشل(تحليل.error.errors[0].message);
  const ب = تحليل.data;

  const حد = تحليل_مبلغ(ب.حد_الائتمان_الافتراضي || "0");
  if (حد === null) return فشل("حد الائتمان غير صالح");

  await prisma.$transaction(async (tx) => {
    for (const [مفتاح, قيمة] of [
      ["اسم_الشركة", ب.اسم_الشركة],
      ["حد_الائتمان_الافتراضي", حد],
      ["طرق_الدفع", JSON.stringify(ب.طرق_الدفع)],
    ] as const) {
      await tx.setting.upsert({
        where: { key: مفتاح },
        update: { value: قيمة, updatedById: فاعل.id },
        create: { key: مفتاح, value: قيمة, updatedById: فاعل.id },
      });
    }
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "UPDATE",
      نوع_الكيان: "الإعدادات",
      التفاصيل: { اسم_الشركة: ب.اسم_الشركة, حد_الائتمان_الافتراضي: حد, طرق_الدفع: ب.طرق_الدفع },
    });
  });
  revalidatePath("/settings");
  revalidatePath("/treasury");
  revalidatePath("/invoices");
  return نجح(undefined, "تم حفظ الإعدادات");
}

/** رفع شعار الشركة (base64) — يُحفظ في الإعدادات ليظهر في الفواتير */
export async function حفظ_شعار_الشركة(base64: string | null): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "إدارة_الإعدادات");
  // يقبل data URL مباشرة أو إفراغ
  const قيمة = base64 ?? "";
  if (قيمة && !قيمة.startsWith("data:image/")) return فشل("الشعار يجب أن يكون صورة");
  if (قيمة.length > 2_000_000) return فشل("حجم الشعار كبير جداً (الحد 2MB تقريباً)");

  await prisma.$transaction(async (tx) => {
    await tx.setting.upsert({
      where: { key: "شعار_الشركة" },
      update: { value: قيمة, updatedById: فاعل.id },
      create: { key: "شعار_الشركة", value: قيمة, updatedById: فاعل.id },
    });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "UPDATE",
      نوع_الكيان: "الإعدادات",
      التفاصيل: { شعار_الشركة: قيمة ? "(تم تحديث الشعار)" : "(حذف الشعار)" },
    });
  });
  revalidatePath("/settings");
  revalidatePath("/invoices");
  return نجح(undefined, قيمة ? "تم حفظ الشعار" : "تم حذف الشعار");
}

/** حفظ الحدود الدنيا لكل حساب خزنة */
export async function حفظ_حدود_الخزنة(مدخلات: Record<string, string>): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "إدارة_الإعدادات");
  const تحليل = مخطط_حدود_الخزنة.safeParse(مدخلات);
  if (!تحليل.success) return فشل("مدخلات غير صالحة");
  const ب = تحليل.data;

  await prisma.$transaction(async (tx) => {
    for (const [id, قيمة] of Object.entries(ب)) {
      const حد = تحليل_مبلغ(قيمة);
      if (حد === null) throw new Error(`الحد غير صالح للحساب ${id}`);
      await tx.treasuryAccount.update({
        where: { id: Number(id) },
        data: { minThreshold: حد },
      });
    }
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "UPDATE",
      نوع_الكيان: "الإعدادات",
      التفاصيل: { حدود_الخزنة: ب },
    });
  });
  revalidatePath("/settings");
  revalidatePath("/treasury");
  revalidatePath("/dashboard");
  return نجح(undefined, "تم حفظ حدود الخزنة");
}
