import Link from "next/link";
import { redirect, notFound } from "next/navigation";
import { المستخدم_الحالي } from "@/lib/session";
import { تسمية_حالة_الشيك } from "@/lib/enums";
import { اجلب_تقرير_تسوية_شيك, type دفعة_تسوية_شيك } from "@/lib/cheque-settlement-report";
import { زر_طباعة_التقرير } from "@/app/cheque-report/print-btn";

export const metadata = { title: "تقرير تسوية شيك صادر — سُكر" };
export const dynamic = "force-dynamic";

const نص_مبلغ = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const نص_يوم = (iso: string) => new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(new Date(iso));

const بطاقة = (تسمية: string, قيمة: string, لون?: string) => (
  <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
    <div className="text-xs text-gray-500">{تسمية}</div>
    <div className={`text-lg font-bold ltr-nums ${لون ?? ""}`}>{قيمة}</div>
  </div>
);

function جدول_دفعات({ عنوان, دفعات }: { عنوان: string; دفعات: دفعة_تسوية_شيك[] }) {
  if (دفعات.length === 0) return null;
  const إجمالي = دفعات.reduce((س, د) => س + د.المبلغ, 0);
  return (
    <div className="report-section mb-5">
      <h2 className="mb-2 text-base font-bold text-[#1F3864]">{عنوان}</h2>
      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#1F3864] text-white">
            <th className="border border-gray-300 px-2 py-2 text-start font-medium">#</th>
            <th className="nowrap border border-gray-300 px-2 py-2 text-start font-medium">التاريخ</th>
            <th className="nowrap border border-gray-300 px-2 py-2 text-start font-medium">الوسيلة</th>
            <th className="border border-gray-300 px-2 py-2 text-start font-medium">البيان</th>
            <th className="nowrap border border-gray-300 px-2 py-2 text-end font-medium">المبلغ</th>
          </tr>
        </thead>
        <tbody>
          {دفعات.map((د, i) => (
            <tr key={`${د.نوع}-${د.id}`} className="odd:bg-white even:bg-gray-50">
              <td className="border border-gray-300 px-2 py-1.5 text-gray-500">{i + 1}</td>
              <td className="nowrap border border-gray-300 px-2 py-1.5 ltr-nums">{نص_يوم(د.التاريخ)}</td>
              <td className="nowrap border border-gray-300 px-2 py-1.5">{د.الطريقة || "—"}</td>
              <td className="border border-gray-300 px-2 py-1.5">{د.البيان || "—"}</td>
              <td className="nowrap border border-gray-300 px-2 py-1.5 text-end ltr-nums">{نص_مبلغ(د.المبلغ)}</td>
            </tr>
          ))}
        </tbody>
      </table>
      <div className="mt-2 flex items-center justify-between rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm font-semibold">
        <span>إجمالي {عنوان}</span>
        <span className="ltr-nums">{نص_مبلغ(إجمالي)} ج.م</span>
      </div>
    </div>
  );
}

export default async function صفحة_تقرير_تسوية_شيك({
  params,
  searchParams,
}: {
  params: { id: string };
  searchParams: { نطاق?: string };
}) {
  const م = await المستخدم_الحالي();
  if (!م) redirect("/login");

  const معرف = Number(params.id);
  if (!Number.isFinite(معرف) || معرف <= 0) notFound();

  const تقرير = await اجلب_تقرير_تسوية_شيك(معرف);
  if (!تقرير) notFound();

  const اليوم_فقط = searchParams.نطاق === "اليوم";

  return (
    <div dir="rtl" className="report-sheet mx-auto max-w-4xl bg-white p-8 text-[#111827]">
      <style>{`
        @media print {
          .no-print { display: none !important }
          html, body { background: #fff !important }
          @page { size: A4 portrait; margin: 10mm }
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }
          .report-sheet { max-width: none !important; width: 100% !important; margin: 0 !important; padding: 0 !important; }
          .report-sheet table { font-size: 12px !important }
          .report-sheet th, .report-sheet td { padding: 5px 6px !important }
          .report-sheet .nowrap { white-space: nowrap !important }
          .report-head { break-inside: avoid; break-after: avoid; page-break-inside: avoid }
          .report-cards { break-inside: avoid; page-break-inside: avoid }
          .report-section { break-inside: avoid; page-break-inside: avoid }
          thead { display: table-header-group }
          tr { break-inside: avoid; page-break-inside: avoid }
          .report-total { break-inside: avoid; page-break-inside: avoid }
        }
      `}</style>

      <div className="report-head mb-6 flex items-start justify-between border-b-2 border-[#1F3864] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1F3864]">تقرير تسوية شيك صادر{اليوم_فقط ? " — دفعات اليوم فقط" : ""}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {تقرير.شيك.اسم_المستفيد}
            {تقرير.شيك.رقم_الشيك ? ` — شيك رقم ${تقرير.شيك.رقم_الشيك}` : ""}
            {تقرير.شيك.اسم_البنك ? ` — ${تقرير.شيك.اسم_البنك}` : ""}
          </p>
        </div>
        <div className="text-left text-xs text-gray-500">
          <div>تاريخ الإصدار: {نص_يوم(new Date().toISOString())}</div>
          <div>استحقاق الشيك: {نص_يوم(تقرير.شيك.تاريخ_الاستحقاق)}</div>
          <div>الحالة: {تسمية_حالة_الشيك[تقرير.شيك.الحالة] ?? تقرير.شيك.الحالة}</div>
        </div>
      </div>

      <div className="no-print mb-4 flex items-center gap-1.5 rounded-lg border border-gray-200 bg-gray-50 p-1 text-sm w-fit">
        <Link
          href={`/cheque-settlement-report/${تقرير.شيك.id}`}
          className={`rounded-md px-3 py-1.5 transition ${!اليوم_فقط ? "bg-[#1F3864] text-white" : "text-gray-600 hover:bg-gray-100"}`}
        >
          كل الدفعات
        </Link>
        <Link
          href={`/cheque-settlement-report/${تقرير.شيك.id}?نطاق=اليوم`}
          className={`rounded-md px-3 py-1.5 transition ${اليوم_فقط ? "bg-[#1F3864] text-white" : "text-gray-600 hover:bg-gray-100"}`}
        >
          دفعات اليوم فقط
        </Link>
      </div>

      <div className="report-cards mb-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
        {بطاقة("قيمة الشيك", `${نص_مبلغ(تقرير.شيك.المبلغ)} ج.م`)}
        {بطاقة("خرج اليوم", `${نص_مبلغ(تقرير.إجمالي_اليوم)} ج.م`, "text-green-700")}
        {بطاقة("سُدِّد سابقاً", `${نص_مبلغ(تقرير.إجمالي_سابق)} ج.م`)}
        {بطاقة("المتبقي", `${نص_مبلغ(تقرير.المتبقي)} ج.م`, تقرير.المتبقي > 0.005 ? "text-amber-700" : "text-green-700")}
      </div>

      <جدول_دفعات عنوان="دفعات اليوم" دفعات={تقرير.دفعات_اليوم} />
      {!اليوم_فقط && <جدول_دفعات عنوان="دفعات سابقة" دفعات={تقرير.دفعات_سابقة} />}

      {تقرير.دفعات_اليوم.length === 0 && (اليوم_فقط || تقرير.دفعات_سابقة.length === 0) && (
        <p className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
          {اليوم_فقط ? "لا توجد دفعات مسجّلة على هذا الشيك اليوم." : "لا توجد دفعات مسجّلة على هذا الشيك بعد."}
        </p>
      )}

      <div className="report-total mt-3 flex items-center justify-between rounded-lg border-2 border-[#1F3864] bg-gray-100 px-4 py-2.5 font-bold">
        <span>{اليوم_فقط ? "إجمالي دفعات اليوم" : "إجمالي المُسدَّد"}</span>
        <span className="ltr-nums">{نص_مبلغ(اليوم_فقط ? تقرير.إجمالي_اليوم : تقرير.المُسدَّد)} ج.م</span>
      </div>

      <div className="mt-6 flex justify-end">
        <زر_طباعة_التقرير />
      </div>
    </div>
  );
}
