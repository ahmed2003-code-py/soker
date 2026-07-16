import type { Prisma, PrismaClient, ActivityAction } from "@prisma/client";
import { prisma } from "@/lib/prisma";

type عميل_معاملة = Prisma.TransactionClient | PrismaClient;

export type نوع_الكيان =
  | "الطرف"
  | "الفاتورة"
  | "بند_الفاتورة"
  | "حركة_الحساب"
  | "حركة_الخزنة"
  | "دفع_مباشر"
  | "الشيك"
  | "المستخدم"
  | "الإعدادات";

/**
 * تسجيل عملية في سجل العمليات (append-only).
 * يُستدعى داخل نفس الـ $transaction للعملية لضمان الذرّية.
 */
export async function تسجيل_عملية(
  tx: عميل_معاملة,
  معطيات: {
    المستخدم: number;
    العملية: ActivityAction;
    نوع_الكيان: نوع_الكيان;
    معرف_الكيان?: number | null;
    التفاصيل?: Prisma.InputJsonValue;
  }
) {
  return tx.activityLog.create({
    data: {
      userId: معطيات.المستخدم,
      action: معطيات.العملية,
      entityType: معطيات.نوع_الكيان,
      entityId: معطيات.معرف_الكيان ?? null,
      details: معطيات.التفاصيل ?? {},
    },
  });
}

/** جلب سجل عمليات كيان محدد (المسار الزمني/التاريخ) */
export async function سجل_الكيان(نوع: نوع_الكيان, معرف: number) {
  return prisma.activityLog.findMany({
    where: { entityType: نوع, entityId: معرف },
    include: { user: { select: { id: true, name: true } } },
    orderBy: { createdAt: "desc" },
  });
}
