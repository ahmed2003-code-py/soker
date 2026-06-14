import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { نص_مبلغ } from "@/components/money-text";
import { نص_تاريخ } from "@/components/date-text";
import { سطر_المساءلة } from "@/components/accountability-line";
import { تفقيط } from "@/lib/tafqit";
import { جمّع_حسب_التصنيف } from "@/lib/invoice";
import { مترجم_الخادم } from "@/lib/i18n/server";
import { شريط_إجراءات_الفاتورة } from "./actions-bar";

export const metadata = { title: "عرض فاتورة — سُكر" };

export default async function صفحة_عرض_فاتورة({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const { t } = مترجم_الخادم();
  const [فاتورة, إعدادات] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        lines: { orderBy: { id: "asc" } },
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    }),
    prisma.setting.findMany({ where: { key: { in: ["اسم_الشركة", "شعار_الشركة"] } } }),
  ]);
  if (!فاتورة) notFound();

  const اسم_الشركة = إعدادات.find((s) => s.key === "اسم_الشركة")?.value || "مؤسسة سكر";
  const شعار = إعدادات.find((s) => s.key === "شعار_الشركة")?.value || "";
  const رقم = String(فاتورة.number).padStart(7, "0");
  const تجميع = جمّع_حسب_التصنيف(
    فاتورة.lines.map((l) => ({ التصنيف: l.category, الكمية: l.qty, الوزن: l.weight }))
  );

  return (
    <div>
      <شريط_إجراءات_الفاتورة المعرف={فاتورة.id} الرقم={فاتورة.number} />

      {/* ورقة الفاتورة (قابلة للطباعة) */}
      <div className="mx-auto max-w-3xl card-soft p-8 print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-primary pb-4">
          <div className="flex items-center gap-3">
            {شعار ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={شعار} alt={t("inv.v.logo_alt")} className="h-16 w-16 object-contain" />
            ) : null}
            <div>
              <h1 className="text-2xl font-bold text-primary">{اسم_الشركة}</h1>
              <p className="text-sm text-muted-foreground">{t("inv.v.sales_invoice")}</p>
            </div>
          </div>
          <div className="text-end">
            <p className="text-sm text-muted-foreground">{t("inv.col.number")}</p>
            <p className="ltr-nums text-xl font-bold">{رقم}</p>
            <p className="mt-1 text-sm">
              {t("common.date")}: <نص_تاريخ القيمة={فاتورة.date} />
            </p>
          </div>
        </div>

        <div className="my-4 flex flex-wrap gap-x-8 gap-y-1 text-sm">
          <span>{t("inv.col.customer")}: <span className="font-semibold">{فاتورة.customer.name}</span></span>
          <span>{t("party.col.phone")}: <span className="ltr-nums">{فاتورة.phone || فاتورة.customer.phone || "—"}</span></span>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-appgray text-muted-foreground">
              <th className="border border-border p-2 text-start">{t("inv.v.color_desc")}</th>
              <th className="border border-border p-2 text-start">{t("inv.f.category")}</th>
              <th className="border border-border p-2 text-end">{t("inv.v.count")}</th>
              <th className="border border-border p-2 text-end">{t("inv.f.weight_kg")}</th>
              <th className="border border-border p-2 text-end">{t("inv.f.price_kg")}</th>
              <th className="border border-border p-2 text-end">{t("inv.f.subtotal")}</th>
            </tr>
          </thead>
          <tbody>
            {فاتورة.lines.map((l) => (
              <tr key={l.id}>
                <td className="border border-border p-2">{l.color}</td>
                <td className="border border-border p-2">{l.category}</td>
                <td className="border border-border p-2 text-end ltr-nums">{Number(l.qty)}</td>
                <td className="border border-border p-2 text-end ltr-nums">{Number(l.weight)}</td>
                <td className="border border-border p-2 text-end ltr-nums">
                  {l.price != null ? Number(l.price).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"}
                </td>
                <td className="border border-border p-2 text-end ltr-nums">
                  {Number(l.lineTotal).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ملخص التجميع */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 font-semibold">{t("inv.f.summary_by_cat")}</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-appgray text-muted-foreground">
                  <th className="border border-border p-1.5 text-start">{t("inv.f.category")}</th>
                  <th className="border border-border p-1.5 text-end">{t("inv.v.count")}</th>
                  <th className="border border-border p-1.5 text-end">{t("inv.v.weight")}</th>
                </tr>
              </thead>
              <tbody>
                {تجميع.map((g) => (
                  <tr key={g.التصنيف}>
                    <td className="border border-border p-1.5">{g.التصنيف}</td>
                    <td className="border border-border p-1.5 text-end ltr-nums">{Number(g.الكمية)}</td>
                    <td className="border border-border p-1.5 text-end ltr-nums">{Number(g.الوزن)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><span className="text-muted-foreground">{t("inv.f.total_count")}</span><span className="ltr-nums">{Number(فاتورة.totalQty)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">{t("inv.col.total_weight")}</span><span className="ltr-nums">{Number(فاتورة.totalWeight)} {t("inv.kg")}</span></div>
            <div className="flex items-center justify-between rounded-lg bg-primary/5 p-3 text-lg">
              <span className="font-bold">{t("inv.col.total")}</span>
              <نص_مبلغ القيمة={فاتورة.totalAmount} />
            </div>
            <p className="text-sm text-muted-foreground">
              {t("inv.v.in_words")} {تفقيط(Number(فاتورة.totalAmount))}
            </p>
          </div>
        </div>

        {فاتورة.notes && (
          <p className="mt-4 text-sm text-muted-foreground">{t("inv.v.notes_label")} {فاتورة.notes}</p>
        )}

        <div className="mt-6 border-t border-border pt-3 no-print">
          <سطر_المساءلة
            أنشأ={فاتورة.createdBy?.name}
            تاريخ_الإنشاء={فاتورة.createdAt}
            عدّل={فاتورة.updatedBy?.name}
            تاريخ_التعديل={فاتورة.updatedById ? فاتورة.updatedAt : null}
          />
        </div>
      </div>
    </div>
  );
}
