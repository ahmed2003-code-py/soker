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

      {/* ورقة الفاتورة (قابلة للطباعة) — تصميم بسيط وواضح */}
      <div className="mx-auto max-w-3xl card-soft p-8 text-foreground print:max-w-none print:border-0 print:p-0 print:text-black print:shadow-none">
        {/* الرأس */}
        <div className="flex items-start justify-between gap-4 border-b-2 border-foreground/80 pb-4 print:border-black">
          <div className="flex items-center gap-3">
            {شعار ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={شعار} alt={t("inv.v.logo_alt")} className="h-14 w-14 object-contain" />
            ) : null}
            <div>
              <h1 className="text-2xl font-bold">{اسم_الشركة}</h1>
              <p className="text-sm font-medium">{t("inv.v.sales_invoice")}</p>
            </div>
          </div>
          <div className="text-end text-sm leading-7">
            <p>
              <span className="font-semibold">{t("inv.col.number")}: </span>
              <span className="ltr-nums text-lg font-bold">{رقم}</span>
            </p>
            <p>
              <span className="font-semibold">{t("common.date")}: </span>
              <نص_تاريخ القيمة={فاتورة.date} />
            </p>
          </div>
        </div>

        {/* العميل */}
        <div className="my-5 flex flex-wrap gap-x-10 gap-y-1 text-[15px]">
          <span>
            <span className="font-semibold">{t("inv.col.customer")}: </span>
            {فاتورة.customer.name}
          </span>
          <span>
            <span className="font-semibold">{t("party.col.phone")}: </span>
            <span className="ltr-nums">{فاتورة.phone || فاتورة.customer.phone || "—"}</span>
          </span>
        </div>

        {/* البنود — خطوط أفقية فقط لقراءة أسهل */}
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-y-2 border-foreground/70 print:border-black">
              <th className="px-2 py-2.5 text-start font-bold">{t("inv.v.color_desc")}</th>
              <th className="px-2 py-2.5 text-start font-bold">{t("inv.f.category")}</th>
              <th className="px-2 py-2.5 text-end font-bold">{t("inv.v.count")}</th>
              <th className="px-2 py-2.5 text-end font-bold">{t("inv.f.weight_kg")}</th>
              <th className="px-2 py-2.5 text-end font-bold">{t("inv.f.price_kg")}</th>
              <th className="px-2 py-2.5 text-end font-bold">{t("inv.f.subtotal")}</th>
            </tr>
          </thead>
          <tbody>
            {فاتورة.lines.map((l) => (
              <tr key={l.id} className="border-b border-foreground/15 print:border-black/20">
                <td className="px-2 py-2">{l.color}</td>
                <td className="px-2 py-2">{l.category}</td>
                <td className="px-2 py-2 text-end ltr-nums">{Number(l.qty)}</td>
                <td className="px-2 py-2 text-end ltr-nums">{Number(l.weight)}</td>
                <td className="px-2 py-2 text-end ltr-nums">
                  {l.price != null ? Number(l.price).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"}
                </td>
                <td className="px-2 py-2 text-end ltr-nums font-medium">
                  {Number(l.lineTotal).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* الإجماليات — بارزة وبسيطة */}
        <div className="mt-6 flex flex-col items-end gap-4 sm:flex-row sm:items-start sm:justify-between">
          {/* ملخص التصنيف (مختصر) */}
          {تجميع.length > 0 && (
            <div className="w-full sm:max-w-xs">
              <h3 className="mb-1.5 text-sm font-bold">{t("inv.f.summary_by_cat")}</h3>
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-foreground/40 text-start print:border-black/50">
                    <th className="py-1 text-start font-semibold">{t("inv.f.category")}</th>
                    <th className="py-1 text-end font-semibold">{t("inv.v.count")}</th>
                    <th className="py-1 text-end font-semibold">{t("inv.v.weight")}</th>
                  </tr>
                </thead>
                <tbody>
                  {تجميع.map((g) => (
                    <tr key={g.التصنيف} className="border-b border-foreground/10 print:border-black/10">
                      <td className="py-1">{g.التصنيف}</td>
                      <td className="py-1 text-end ltr-nums">{Number(g.الكمية)}</td>
                      <td className="py-1 text-end ltr-nums">{Number(g.الوزن)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {/* الإجمالي المالي */}
          <div className="w-full sm:max-w-xs">
            <div className="flex justify-between py-1 text-sm">
              <span>{t("inv.f.total_count")}</span>
              <span className="ltr-nums font-medium">{Number(فاتورة.totalQty)}</span>
            </div>
            <div className="flex justify-between py-1 text-sm">
              <span>{t("inv.col.total_weight")}</span>
              <span className="ltr-nums font-medium">{Number(فاتورة.totalWeight)} {t("inv.kg")}</span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t-2 border-foreground/80 pt-2 text-lg font-bold print:border-black">
              <span>{t("inv.col.total")}</span>
              <نص_مبلغ القيمة={فاتورة.totalAmount} />
            </div>
            <p className="mt-2 text-[13px]">
              <span className="font-semibold">{t("inv.v.in_words")} </span>
              {تفقيط(Number(فاتورة.totalAmount))}
            </p>
          </div>
        </div>

        {فاتورة.notes && (
          <p className="mt-5 border-t border-foreground/15 pt-3 text-sm print:border-black/20">
            <span className="font-semibold">{t("inv.v.notes_label")} </span>
            {فاتورة.notes}
          </p>
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
