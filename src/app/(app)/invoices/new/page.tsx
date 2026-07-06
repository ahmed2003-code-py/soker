import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { مترجم_الخادم } from "@/lib/i18n/server";
import { نموذج_فاتورة } from "../form";
import { احصل_قوائم_الفواتير } from "../actions";
import { تسمية_حساب_الخزنة } from "@/lib/enums";

export const metadata = { title: "فاتورة جديدة — سُكر" };

export default async function صفحة_فاتورة_جديدة() {
  const { t } = مترجم_الخادم();
  const [عملاء, { تصنيفات, شركات }, حسابات] = await Promise.all([
    prisma.party.findMany({
      where: { type: "CUSTOMER" },
      select: { id: true, name: true, phone: true, balance: true },
      orderBy: { name: "asc" },
    }),
    احصل_قوائم_الفواتير(),
    prisma.treasuryAccount.findMany({ orderBy: { id: "asc" } }),
  ]);
  return (
    <div>
      <ترويسة_الصفحة العنوان={t("inv.new")} الوصف={t("inv.new_subtitle")} />
      <نموذج_فاتورة
        العملاء={عملاء.map((c) => ({ ...c, balance: Number(c.balance) }))}
        التصنيفات={تصنيفات}
        الشركات={شركات}
        حسابات_الخزنة={حسابات.map((h) => ({ id: h.id, التسمية: تسمية_حساب_الخزنة[h.type] }))}
      />
    </div>
  );
}
