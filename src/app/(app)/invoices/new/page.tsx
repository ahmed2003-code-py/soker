import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { نموذج_فاتورة } from "../form";

export const metadata = { title: "فاتورة جديدة — سُكر" };

export default async function صفحة_فاتورة_جديدة() {
  const [عملاء, تصنيفات] = await Promise.all([
    prisma.party.findMany({
      where: { type: "CUSTOMER" },
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
    }),
    prisma.invoiceLine.findMany({ distinct: ["category"], select: { category: true }, take: 100 }),
  ]);
  return (
    <div>
      <ترويسة_الصفحة العنوان="فاتورة جديدة" الوصف="أدخل بنود الفاتورة — التسعير بالوزن" />
      <نموذج_فاتورة العملاء={عملاء} التصنيفات={تصنيفات.map((c) => c.category)} />
    </div>
  );
}
