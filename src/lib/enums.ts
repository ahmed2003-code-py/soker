/**
 * خرائط القيم الثابتة: مفتاح ASCII (مخزّن في القاعدة) ↔ تسمية عربية (للعرض).
 * تُستخدم لبناء قوائم الاختيار وعرض الشارات.
 */
import {
  Role,
  PartyType,
  TreasuryAccountType,
  TxnKind,
  ChequeStatus,
  ActivityAction,
} from "@prisma/client";

export const تسمية_الدور: Record<Role, string> = {
  ADMIN: "مدير",
  ACCOUNTANT: "محاسب",
  READONLY: "قراءة فقط",
};

export const تسمية_نوع_الطرف: Record<PartyType, string> = {
  CUSTOMER: "عميل",
  SUPPLIER: "مورد",
};

export const تسمية_حساب_الخزنة: Record<TreasuryAccountType, string> = {
  INSTAPAY: "إنستا باي",
  CASH: "نقدي",
  BANK: "بنك",
  VODAFONE: "فودافون كاش",
};

export const تسمية_نوع_الحركة: Record<TxnKind, string> = {
  INCOME: "إيراد",
  EXPENSE: "مصروف",
  TRANSFER: "تحويل مباشر",
};

export const تسمية_حالة_الشيك: Record<ChequeStatus, string> = {
  PENDING: "منتظر",
  COLLECTED: "محصّل",
  BOUNCED: "مرتجع",
};

export const تسمية_العملية: Record<ActivityAction, string> = {
  CREATE: "إضافة",
  UPDATE: "تعديل",
  DELETE: "حذف",
};

/** تحويل خريطة تسميات إلى خيارات قائمة اختيار */
export function خيارات_من<T extends string>(
  خريطة: Record<T, string>
): { القيمة: T; التسمية: string }[] {
  return (Object.keys(خريطة) as T[]).map((k) => ({ القيمة: k, التسمية: خريطة[k] }));
}

export { Role, PartyType, TreasuryAccountType, TxnKind, ChequeStatus, ActivityAction };
