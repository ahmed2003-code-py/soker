import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { مترجم_الخادم } from "@/lib/i18n/server";
import { نموذج_فاتورة } from "../form";

export const metadata = { title: "فاتورة جديدة — سُكر" };

export default async function صفحة_فاتورة_جديدة() {
  const { t } = مترجم_الخادم();
  const [عملاء, تصنيفات, شركات] = await Promise.all([
    prisma.party.findMany({
      where: { type: "CUSTOMER" },
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
    }),
    prisma.invoiceLine.findMany({ distinct: ["category"], select: { category: true }, take: 100 }),
    prisma.invoiceLine.findMany({
      distinct: ["company"],
      select: { company: true },
      where: { company: { not: null } },
      take: 100,
    }),
  ]);
  return (
    <div>
      <ترويسة_الصفحة العنوان={t("inv.new")} الوصف={t("inv.new_subtitle")} />
      <نموذج_فاتورة
        العملاء={عملاء}
        التصنيفات={تصنيفات.map((c) => c.category)}
        الشركات={شركات.map((c) => c.company as string)}
      />
    </div>
  );
}
