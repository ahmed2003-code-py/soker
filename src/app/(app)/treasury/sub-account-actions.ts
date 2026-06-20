"use server";
import { prisma } from "@/lib/prisma";
import { اطلب_المستخدم } from "@/lib/session";
import { تحقق_الصلاحية } from "@/lib/authz";
import { نجح, فشل, type نتيجة } from "@/lib/result";
import { TreasuryAccountType } from "@prisma/client";

export type حساب_فرعي = { id: number; الاسم: string; الرصيد: number };
export type خريطة_حسابات_فرعية = Record<TreasuryAccountType, حساب_فرعي[]>;

/** جلب جميع الحسابات الفرعية مجمّعةً حسب النوع */
export async function اجلب_خريطة_حسابات_فرعية(): Promise<خريطة_حسابات_فرعية> {
  const سجلات = await prisma.subAccount.findMany({
    where: { isActive: true },
    orderBy: { name: "asc" },
    select: { id: true, type: true, name: true, balance: true },
  });
  return {
    CASH: [],
    INSTAPAY: سجلات.filter((s) => s.type === "INSTAPAY").map(تحويل),
    VODAFONE: سجلات.filter((s) => s.type === "VODAFONE").map(تحويل),
    BANK: سجلات.filter((s) => s.type === "BANK").map(تحويل),
  };
}

function تحويل(s: { id: number; name: string; balance: { toString(): string } }): حساب_فرعي {
  return { id: s.id, الاسم: s.name, الرصيد: Number(s.balance) };
}

/** إنشاء حساب فرعي جديد أو إعادة معرّف الموجود */
export async function أنشئ_حساب_فرعي(
  النوع: TreasuryAccountType,
  الاسم: string
): Promise<نتيجة<{ id: number }>> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "كتابة");
  const اسم = الاسم.trim();
  if (!اسم) return فشل("الاسم مطلوب");
  if (النوع === "CASH") return فشل("النقدي لا يدعم الحسابات الفرعية");

  const موجود = await prisma.subAccount.findFirst({ where: { type: النوع, name: اسم } });
  if (موجود) return نجح({ id: موجود.id }, "الحساب موجود بالفعل");

  const جديد = await prisma.subAccount.create({ data: { type: النوع, name: اسم } });
  return نجح({ id: جديد.id }, `تمت إضافة "${اسم}"`);
}
