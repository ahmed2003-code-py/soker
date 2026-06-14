import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { الزر } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { مترجم_الخادم } from "@/lib/i18n/server";
import { قائمة_الفواتير } from "./list-client";

export const metadata = { title: "الفواتير — سُكر" };

export default async function صفحة_الفواتير() {
  const { t } = مترجم_الخادم();
  const فواتير = await prisma.invoice.findMany({
    orderBy: { number: "desc" },
    take: 500,
    include: { customer: { select: { name: true } } },
  });
  const بيانات = فواتير.map((f) => ({
    id: f.id,
    الرقم: f.number,
    العميل: f.customer.name,
    التاريخ: f.date.toISOString(),
    الإجمالي: Number(f.totalAmount),
    إجمالي_الوزن: Number(f.totalWeight),
  }));

  return (
    <div>
      <ترويسة_الصفحة
        العنوان={t("inv.title")}
        الوصف={t("inv.subtitle")}
        إجراء={
          <الزر asChild>
            <Link href="/invoices/new">
              <Plus className="size-4" /> {t("inv.new")}
            </Link>
          </الزر>
        }
      />
      <قائمة_الفواتير البيانات={بيانات} />
    </div>
  );
}
