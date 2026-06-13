import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { قائمة_الأطراف } from "../_parties/list-client";

export const metadata = { title: "الموردون — سُكر" };

export default async function صفحة_الموردين() {
  const أطراف = await prisma.party.findMany({
    where: { type: "SUPPLIER" },
    orderBy: { name: "asc" },
  });
  const بيانات = أطراف.map((p) => ({
    id: p.id,
    الاسم: p.name,
    الهاتف: p.phone,
    العنوان: p.address,
    الرصيد: Number(p.balance),
    حد_الائتمان: p.creditLimit != null ? Number(p.creditLimit) : null,
    ملاحظات: p.notes,
  }));
  return (
    <div>
      <ترويسة_الصفحة العنوان="الموردون" الوصف="إدارة الموردين وكشوف حساباتهم" />
      <قائمة_الأطراف النوع="SUPPLIER" البيانات={بيانات} />
    </div>
  );
}
