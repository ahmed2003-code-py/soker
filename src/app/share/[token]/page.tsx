import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { نص_مبلغ } from "@/components/money-text";
import { نص_تاريخ } from "@/components/date-text";
import { تفقيط } from "@/lib/tafqit";
import { زر_طباعة } from "./print-button";

export default async function صفحة_مشاركة_فاتورة({
  params,
}: {
  params: { token: string };
}) {
  const فاتورة = await prisma.invoice.findUnique({
    where: { shareToken: params.token },
    include: {
      customer: true,
      lines: { orderBy: [{ category: "asc" }, { id: "asc" }] },
    },
  });
  if (!فاتورة) notFound();

  const اسم_الشركة_raw = await prisma.setting.findUnique({ where: { key: "اسم_الشركة" } });
  const اسم_الشركة = اسم_الشركة_raw?.value || "مؤسسة سكر للتجارة";
  const رقم = String(فاتورة.number).padStart(7, "0");

  type مجموعة_تصنيف = {
    التصنيف: string;
    إجمالي_الكمية: number;
    إجمالي_الوزن: number;
    إجمالي_المبلغ: number;
    بنود: typeof فاتورة.lines;
    أسعار: Set<number>;
  };
  const تجميع = new Map<string, مجموعة_تصنيف>();
  for (const بند of فاتورة.lines) {
    const مجموعة = تجميع.get(بند.category) ?? {
      التصنيف: بند.category,
      إجمالي_الكمية: 0,
      إجمالي_الوزن: 0,
      إجمالي_المبلغ: 0,
      بنود: [],
      أسعار: new Set<number>(),
    };
    مجموعة.بنود.push(بند);
    مجموعة.إجمالي_الكمية += Number(بند.qty);
    مجموعة.إجمالي_الوزن += Number(بند.weight);
    مجموعة.إجمالي_المبلغ += Number(بند.lineTotal);
    if (Number(بند.price) > 0) مجموعة.أسعار.add(Number(بند.price));
    تجميع.set(بند.category, مجموعة);
  }
  const مجموعات = [...تجميع.values()];

  return (
    <div dir="rtl" className="min-h-screen bg-gray-50 py-6 print:bg-white print:py-0">
      {/* شريط أعلى — يختفي عند الطباعة */}
      <div className="no-print mx-auto mb-4 flex max-w-3xl items-center justify-between gap-2 px-4">
        <p className="text-sm text-gray-500">فاتورة مشاركة — للقراءة فقط</p>
        <زر_طباعة />
      </div>

      {/* ورقة الفاتورة */}
      <div className="mx-auto max-w-3xl bg-white p-8 shadow-sm print:max-w-none print:shadow-none print:p-0">

        {/* الرأس */}
        <div className="flex items-start justify-between gap-4 border-b-2 border-gray-800 pb-4">
          <div>
            <h1 className="text-2xl font-bold">{اسم_الشركة}</h1>
            <p className="text-sm font-medium text-gray-600">فاتورة مبيعات</p>
          </div>
          <div className="text-end text-sm leading-7">
            <p>
              <span className="font-semibold">رقم الفاتورة: </span>
              <span className="ltr-nums text-lg font-bold">{رقم}</span>
            </p>
            <p>
              <span className="font-semibold">التاريخ: </span>
              <نص_تاريخ القيمة={فاتورة.date} />
            </p>
          </div>
        </div>

        {/* العميل */}
        <div className="my-4 flex flex-wrap gap-x-10 gap-y-1 text-[15px]">
          <span>
            <span className="font-semibold">العميل: </span>
            {فاتورة.customer.name}
          </span>
          {(فاتورة.phone || فاتورة.customer.phone) && (
            <span>
              <span className="font-semibold">الهاتف: </span>
              <span className="ltr-nums">{فاتورة.phone || فاتورة.customer.phone}</span>
            </span>
          )}
        </div>

        {/* جدول البنود */}
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-y-2 border-gray-700">
              <th className="px-2 py-2.5 text-start font-bold">اللون / البيان</th>
              <th className="px-2 py-2.5 text-end font-bold w-14">العدد</th>
              <th className="px-2 py-2.5 text-end font-bold w-20">الوزن</th>
              <th className="px-2 py-2.5 text-end font-bold w-20">السعر/كجم</th>
              <th className="px-2 py-2.5 text-end font-bold w-28">المجموع</th>
            </tr>
          </thead>
          <tbody>
            {مجموعات.map((مجموعة) => (
              <>
                {مجموعة.بنود.map((بند) => (
                  <tr key={بند.id} className="border-b border-gray-100">
                    <td className="px-2 py-1.5">
                      <span className="font-medium">{بند.color}</span>
                      {بند.company && (
                        <span className="text-gray-400 mr-1.5 text-[12px]"> — {بند.company}</span>
                      )}
                    </td>
                    <td className="px-2 py-1.5 text-end ltr-nums">{Number(بند.qty)}</td>
                    <td className="px-2 py-1.5 text-end ltr-nums">{Number(بند.weight).toFixed(2)}</td>
                    <td className="px-2 py-1.5 text-end ltr-nums text-gray-400 text-[12px]">
                      {Number(بند.price) > 0 ? Number(بند.price).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"}
                    </td>
                    <td className="px-2 py-1.5 text-end ltr-nums">
                      {Number(بند.price) > 0 ? Number(بند.lineTotal).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"}
                    </td>
                  </tr>
                ))}
                <tr className="border-y border-gray-300 bg-gray-50 font-semibold">
                  <td className="px-2 py-1.5 text-sm">إجمالي: {مجموعة.التصنيف}</td>
                  <td className="px-2 py-1.5 text-end ltr-nums text-sm">{مجموعة.إجمالي_الكمية}</td>
                  <td className="px-2 py-1.5 text-end ltr-nums text-sm">{مجموعة.إجمالي_الوزن.toFixed(2)}</td>
                  <td className="px-2 py-1.5 text-end ltr-nums text-sm text-gray-400 font-normal">
                    {(() => {
                      const أسعار = [...مجموعة.أسعار];
                      if (أسعار.length === 1) return أسعار[0].toLocaleString("en-US", { minimumFractionDigits: 2 });
                      if (أسعار.length > 1) return `${Math.min(...أسعار).toFixed(0)}–${Math.max(...أسعار).toFixed(0)}`;
                      return "—";
                    })()}
                  </td>
                  <td className="px-2 py-1.5 text-end ltr-nums text-sm">
                    {مجموعة.إجمالي_المبلغ > 0 ? مجموعة.إجمالي_المبلغ.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"}
                  </td>
                </tr>
              </>
            ))}
          </tbody>
        </table>

        {/* الإجماليات */}
        <div className="mt-6 flex flex-col items-end gap-6 sm:flex-row sm:items-start sm:justify-between">
          {مجموعات.length > 1 && (
            <div className="w-full sm:max-w-xs">
              <h3 className="mb-1.5 text-sm font-bold">ملخص حسب التصنيف</h3>
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-gray-300">
                    <th className="py-1 text-start font-semibold">التصنيف</th>
                    <th className="py-1 text-end font-semibold">العدد</th>
                    <th className="py-1 text-end font-semibold">الوزن</th>
                    <th className="py-1 text-end font-semibold">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {مجموعات.map((م) => (
                    <tr key={م.التصنيف} className="border-b border-gray-100">
                      <td className="py-1">{م.التصنيف}</td>
                      <td className="py-1 text-end ltr-nums">{م.إجمالي_الكمية}</td>
                      <td className="py-1 text-end ltr-nums">{م.إجمالي_الوزن.toFixed(2)}</td>
                      <td className="py-1 text-end ltr-nums">
                        {م.إجمالي_المبلغ > 0 ? م.إجمالي_المبلغ.toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          <div className="w-full sm:max-w-xs space-y-1">
            <div className="flex justify-between py-1 text-sm">
              <span>إجمالي العدد</span>
              <span className="ltr-nums font-medium">{Number(فاتورة.totalQty)}</span>
            </div>
            <div className="flex justify-between py-1 text-sm">
              <span>إجمالي الوزن</span>
              <span className="ltr-nums font-medium">{Number(فاتورة.totalWeight).toFixed(2)} كجم</span>
            </div>
            <div className="mt-1 flex items-center justify-between border-t-2 border-gray-800 pt-2 text-lg font-bold">
              <span>الإجمالي</span>
              <نص_مبلغ القيمة={فاتورة.totalAmount} />
            </div>
            <p className="mt-2 text-[13px]">
              <span className="font-semibold">فقط وقدره: </span>
              {تفقيط(Number(فاتورة.totalAmount))}
            </p>
          </div>
        </div>

        {فاتورة.notes && (
          <p className="mt-5 border-t border-gray-200 pt-3 text-sm">
            <span className="font-semibold">ملاحظات: </span>
            {فاتورة.notes}
          </p>
        )}
      </div>
    </div>
  );
}
