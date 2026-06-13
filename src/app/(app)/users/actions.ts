"use server";
import { revalidatePath } from "next/cache";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { اطلب_المستخدم } from "@/lib/session";
import { تحقق_الصلاحية } from "@/lib/authz";
import { تسجيل_عملية } from "@/lib/activity";
import { نجح, فشل, type نتيجة } from "@/lib/result";
import {
  مخطط_إنشاء_مستخدم,
  مخطط_تعديل_مستخدم,
  مخطط_تغيير_كلمتي,
} from "./schema";

export async function إنشاء_مستخدم(مدخلات: unknown): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "إدارة_المستخدمين");
  const تحليل = مخطط_إنشاء_مستخدم.safeParse(مدخلات);
  if (!تحليل.success) return فشل(تحليل.error.errors[0].message);
  const ب = تحليل.data;

  const موجود = await prisma.user.findUnique({ where: { username: ب.اسم_المستخدم } });
  if (موجود) return فشل("اسم المستخدم مستخدم بالفعل");

  const hash = await bcrypt.hash(ب.كلمة_المرور, 10);
  await prisma.$transaction(async (tx) => {
    const مستخدم = await tx.user.create({
      data: {
        name: ب.الاسم,
        username: ب.اسم_المستخدم,
        passwordHash: hash,
        role: ب.الدور,
        active: true,
        mustChangePassword: true,
      },
    });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "CREATE",
      نوع_الكيان: "المستخدم",
      معرف_الكيان: مستخدم.id,
      التفاصيل: { الاسم: ب.الاسم, اسم_المستخدم: ب.اسم_المستخدم, الدور: ب.الدور },
    });
  });
  revalidatePath("/users");
  return نجح(undefined, "تم إنشاء المستخدم");
}

export async function تعديل_مستخدم(id: number, مدخلات: unknown): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "إدارة_المستخدمين");
  const تحليل = مخطط_تعديل_مستخدم.safeParse(مدخلات);
  if (!تحليل.success) return فشل(تحليل.error.errors[0].message);
  const ب = تحليل.data;

  const الحالي = await prisma.user.findUnique({ where: { id } });
  if (!الحالي) return فشل("المستخدم غير موجود");

  // منع إنزال آخر مدير نشط من رتبته
  if (الحالي.role === "ADMIN" && ب.الدور !== "ADMIN") {
    const عدد_المديرين = await prisma.user.count({
      where: { role: "ADMIN", active: true },
    });
    if (عدد_المديرين <= 1) return فشل("لا يمكن إنزال آخر مدير نشط");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { name: ب.الاسم, role: ب.الدور },
    });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "UPDATE",
      نوع_الكيان: "المستخدم",
      معرف_الكيان: id,
      التفاصيل: { قبل: { الاسم: الحالي.name, الدور: الحالي.role }, بعد: ب },
    });
  });
  revalidatePath("/users");
  return نجح(undefined, "تم حفظ التعديلات");
}

export async function تبديل_تفعيل_مستخدم(id: number): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "إدارة_المستخدمين");
  const الحالي = await prisma.user.findUnique({ where: { id } });
  if (!الحالي) return فشل("المستخدم غير موجود");

  if (الحالي.active && الحالي.role === "ADMIN") {
    const عدد = await prisma.user.count({ where: { role: "ADMIN", active: true } });
    if (عدد <= 1) return فشل("لا يمكن تعطيل آخر مدير نشط");
  }

  await prisma.$transaction(async (tx) => {
    await tx.user.update({ where: { id }, data: { active: !الحالي.active } });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "UPDATE",
      نوع_الكيان: "المستخدم",
      معرف_الكيان: id,
      التفاصيل: { تفعيل: !الحالي.active },
    });
  });
  revalidatePath("/users");
  return نجح(undefined, الحالي.active ? "تم تعطيل المستخدم" : "تم تفعيل المستخدم");
}

export async function إعادة_تعيين_كلمة(id: number, كلمة_جديدة: string): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  تحقق_الصلاحية(فاعل.role, "إدارة_المستخدمين");
  if (!كلمة_جديدة || كلمة_جديدة.length < 6)
    return فشل("كلمة المرور 6 أحرف على الأقل");
  const hash = await bcrypt.hash(كلمة_جديدة, 10);
  await prisma.$transaction(async (tx) => {
    await tx.user.update({
      where: { id },
      data: { passwordHash: hash, mustChangePassword: true },
    });
    await تسجيل_عملية(tx, {
      المستخدم: فاعل.id,
      العملية: "UPDATE",
      نوع_الكيان: "المستخدم",
      معرف_الكيان: id,
      التفاصيل: { إعادة_تعيين_كلمة_المرور: true },
    });
  });
  revalidatePath("/users");
  return نجح(undefined, "تمت إعادة تعيين كلمة المرور");
}

/** تغيير المستخدم لكلمة مروره (يلغي إجبار التغيير) */
export async function تغيير_كلمتي(مدخلات: unknown): Promise<نتيجة> {
  const فاعل = await اطلب_المستخدم();
  const تحليل = مخطط_تغيير_كلمتي.safeParse(مدخلات);
  if (!تحليل.success) return فشل(تحليل.error.errors[0].message);
  const ب = تحليل.data;

  const الحالي = await prisma.user.findUnique({ where: { id: فاعل.id } });
  if (!الحالي) return فشل("المستخدم غير موجود");
  const مطابق = await bcrypt.compare(ب.الحالية, الحالي.passwordHash);
  if (!مطابق) return فشل("كلمة المرور الحالية غير صحيحة");

  const hash = await bcrypt.hash(ب.الجديدة, 10);
  await prisma.user.update({
    where: { id: فاعل.id },
    data: { passwordHash: hash, mustChangePassword: false },
  });
  return نجح(undefined, "تم تغيير كلمة المرور");
}
