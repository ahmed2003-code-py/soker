import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { قائمة_الأطراف } from "../_parties/list-client";

export const metadata = { title: "العملاء — سُكر" };

export default async function صفحة_العملاء() {
  const أطراف = await prisma.party.findMany({
    where: { type: "CUSTOMER" },
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
      <ترويسة_الصفحة العنوان="العملاء" الوصف="إدارة العملاء وكشوف حساباتهم" />
      <قائمة_الأطراف النوع="CUSTOMER" البيانات={بيانات} />
    </div>
  );
}
