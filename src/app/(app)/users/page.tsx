import { redirect } from "next/navigation";
import { المستخدم_الحالي } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { قائمة_المستخدمين } from "./client";

export const metadata = { title: "المستخدمون — سُكر" };

export default async function صفحة_المستخدمين() {
  const م = await المستخدم_الحالي();
  if (!م) redirect("/login");
  if (م.role !== "ADMIN") redirect("/");

  const مستخدمون = await prisma.user.findMany({ orderBy: { createdAt: "asc" } });
  const بيانات = مستخدمون.map((u) => ({
    id: u.id,
    الاسم: u.name,
    اسم_المستخدم: u.username,
    الدور: u.role,
    نشط: u.active,
    يجب_تغيير_الكلمة: u.mustChangePassword,
  }));

  return (
    <div>
      <ترويسة_الصفحة
        العنوان="المستخدمون"
        الوصف="إدارة مستخدمي النظام وأدوارهم (للمديرين فقط)"
      />
      <قائمة_المستخدمين البيانات={بيانات} />
    </div>
  );
}
