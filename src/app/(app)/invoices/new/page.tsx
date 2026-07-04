import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { مترجم_الخادم } from "@/lib/i18n/server";
import { نموذج_فاتورة } from "../form";
import { احصل_قوائم_الفواتير } from "../actions";

export const metadata = { title: "فاتورة جديدة — سُكر" };

export default async function صفحة_فاتورة_جديدة() {
  const { t } = مترجم_الخادم();
  const [عملاء, { تصنيفات, شركات }] = await Promise.all([
    prisma.party.findMany({
      where: { type: "CUSTOMER" },
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
    }),
    احصل_قوائم_الفواتير(),
  ]);
  return (
    <div>
      <ترويسة_الصفحة العنوان={t("inv.new")} الوصف={t("inv.new_subtitle")} />
      <نموذج_فاتورة
        العملاء={عملاء}
        التصنيفات={تصنيفات}
        الشركات={شركات}
      />
    </div>
  );
}
