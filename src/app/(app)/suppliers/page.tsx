import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { مترجم_الخادم } from "@/lib/i18n/server";
import { قائمة_الأطراف } from "../_parties/list-client";

export const metadata = { title: "الموردون — سُكر" };

export default async function صفحة_الموردين() {
  const { t } = مترجم_الخادم();
  const أطراف = await prisma.party.findMany({
    where: { type: "SUPPLIER" },
    orderBy: [{ updatedAt: "desc" }, { name: "asc" }],
  });
  const بيانات = أطراف.map((p) => ({
    id: p.id,
    الاسم: p.name,
    الهاتف: p.phone,
    أرقام_الهواتف: (p.phones as { رقم: string; تسمية: string | null }[]) ?? [],
    العنوان: p.address,
    الرصيد: Number(p.balance),
    رصيد_ابتدائي: Number(p.openingBalance),
    حد_الائتمان: p.creditLimit != null ? Number(p.creditLimit) : null,
    ملاحظات: p.notes,
    آخر_تحديث: p.updatedAt.toISOString(),
  }));
  return (
    <div>
      <ترويسة_الصفحة العنوان={t("party.suppliers.title")} الوصف={t("party.suppliers.subtitle")} />
      <قائمة_الأطراف النوع="SUPPLIER" البيانات={بيانات} />
    </div>
  );
}
