import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { مترجم_الخادم } from "@/lib/i18n/server";
import { نموذج_فاتورة } from "../../form";
import { احصل_قوائم_الفواتير } from "../../actions";

export const metadata = { title: "تعديل فاتورة — سُكر" };

export default async function صفحة_تعديل_فاتورة({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const { t } = مترجم_الخادم();
  const [فاتورة, عملاء, { تصنيفات, شركات }] = await Promise.all([
    prisma.invoice.findUnique({ where: { id }, include: { lines: true } }),
    prisma.party.findMany({
      where: { type: "CUSTOMER" },
      select: { id: true, name: true, phone: true },
      orderBy: { name: "asc" },
    }),
    احصل_قوائم_الفواتير(),
  ]);
  if (!فاتورة) notFound();

  return (
    <div>
      <ترويسة_الصفحة العنوان={t("inv.edit_title", { number: String(فاتورة.number).padStart(7, "0") })} />
      <نموذج_فاتورة
        العملاء={عملاء}
        التصنيفات={تصنيفات}
        الشركات={شركات}
        فاتورة={{
          id: فاتورة.id,
          الرقم: فاتورة.number,
          معرف_العميل: فاتورة.customerId,
          الهاتف: فاتورة.phone,
          التاريخ: فاتورة.date.toISOString(),
          ملاحظات: فاتورة.notes,
          البنود: فاتورة.lines.map((l) => ({
            اللون: l.color,
            الشركة: l.company ?? "",
            الكمية: String(Number(l.qty)),
            الوزن: String(Number(l.weight)),
            التصنيف: l.category,
            السعر: l.price != null ? String(Number(l.price)) : "",
            ملاحظات: l.notes ?? "",
          })),
        }}
      />
    </div>
  );
}
