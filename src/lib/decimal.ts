import { Prisma } from "@prisma/client";

/**
 * حسابات مالية دقيقة عبر Prisma.Decimal (decimal.js) — لا تُستخدم أرقام JS العائمة أبداً.
 * يُستورَد فقط في كود الخادم.
 */

export type رقم_عشري = Prisma.Decimal;
export type قيمة_عشرية = Prisma.Decimal.Value;

/** إنشاء Decimal من أي قيمة */
export function د(القيمة: قيمة_عشرية = 0): Prisma.Decimal {
  return new Prisma.Decimal(القيمة);
}

export function جمع(...القيم: قيمة_عشرية[]): Prisma.Decimal {
  return القيم.reduce<Prisma.Decimal>((م, ق) => م.add(ق), د(0));
}

export function طرح(أ: قيمة_عشرية, ب: قيمة_عشرية): Prisma.Decimal {
  return د(أ).sub(ب);
}

export function ضرب(أ: قيمة_عشرية, ب: قيمة_عشرية): Prisma.Decimal {
  return د(أ).mul(ب);
}

export function يساوي(أ: قيمة_عشرية, ب: قيمة_عشرية): boolean {
  return د(أ).equals(ب);
}

export function أكبر_من(أ: قيمة_عشرية, ب: قيمة_عشرية): boolean {
  return د(أ).greaterThan(ب);
}

export function أصغر_من(أ: قيمة_عشرية, ب: قيمة_عشرية): boolean {
  return د(أ).lessThan(ب);
}

export const صفر = () => د(0);
