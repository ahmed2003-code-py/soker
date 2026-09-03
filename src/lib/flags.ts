import type { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * مفاتيح تشغيل الميزات.
 *
 * المخزن: مقفول افتراضياً — النظام يشتغل بالسلوك القديم بالظبط (فواتير بلا لطات
 * وبلا أثر مخزني). التفعيل والإقفال من صفحة **الإعدادات** بضغطة زر، والقيمة
 * محفوظة في جدول الإعدادات فبتسري فوراً على الخادم والواجهة بلا إعادة نشر.
 */
export const مفتاح_المخزن = "المخزن_مفعّل";

/** هل المخزن مفعّل؟ (اقرأها داخل المعاملة بتمرير tx للاتساق) */
export async function المخزن_مفعّل(
  tx?: Prisma.TransactionClient
): Promise<boolean> {
  const عميل = tx ?? prisma;
  const س = await عميل.setting.findUnique({ where: { key: مفتاح_المخزن } });
  return س?.value === "true";
}
