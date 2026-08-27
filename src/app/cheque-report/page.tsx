import { redirect } from "next/navigation";
import { المستخدم_الحالي } from "@/lib/session";
import { تسمية_حالة_الشيك, تسمية_حساب_الخزنة } from "@/lib/enums";
import { اجلب_بيانات_تقرير_السداد } from "@/lib/settlement-report";
import { زر_طباعة_التقرير } from "./print-btn";

export const metadata = { title: "تقرير معاملة السداد — سُكر" };
export const dynamic = "force-dynamic";

const نص_مبلغ = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const نص_يوم = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d) : "—");

/**
 * تقرير معاملة السداد — شامل كل وسائل الدفع في نفس المعاملة:
 * شيكات مُظهَّرة + نقدي/تحويلات (الدفعة الموزّعة)، بإجمالي عام واحد.
 * البارامترات: batch=معاملة سداد | ids=شيكات | split=دفعة موزّعة
 * (لو الشيكات تنتمي لمعاملة سداد، التقرير يترقّى تلقائياً للشكل الشامل.)
 */
export default async function صفحة_تقرير_المعاملة({
  searchParams,
}: {
  searchParams: { ids?: string; party?: string; type?: string; batch?: string; split?: string };
}) {
  const م = await المستخدم_الحالي();
  if (!م) redirect("/login");

  const { معاملة, شيكات, حركات, اسم_الطرف, مورد_سياق, إجمالي_الشيكات, إجمالي_النقدي, الإجمالي, مركّبة } =
    await اجلب_بيانات_تقرير_السداد({
      معرف_معاملة: Number(searchParams.batch) > 0 ? Number(searchParams.batch) : null,
      معرفات_الشيكات: (searchParams.ids ?? "").split(",").map((x) => Number(x.trim())).filter((n) => Number.isFinite(n) && n > 0),
      معرف_دفعة_موزعة: Number(searchParams.split) > 0 ? Number(searchParams.split) : null,
      معرف_الطرف: searchParams.party ? Number(searchParams.party) : null,
      نوع_الطرف: searchParams.type ?? null,
    });

  const العنوان = مركّبة
    ? "تقرير سداد مركّب"
    : حركات.length > 0 && شيكات.length === 0
    ? "تقرير دفعة موزّعة"
    : "تقرير معاملة الشيكات";
  const الوصف = مركّبة
    ? "كل وسائل السداد في معاملة واحدة — شيكات + نقدي/تحويلات"
    : حركات.length > 0 && شيكات.length === 0
    ? "نقدي / تحويلات"
    : مورد_سياق
    ? "شيكات مُظهَّرة للمورد"
    : "شيكات مستلَمة من العميل";

  const بطاقة = (تسمية: string, قيمة: string) => (
    <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
      <div className="text-xs text-gray-500">{تسمية}</div>
      <div className="text-lg font-bold ltr-nums">{قيمة}</div>
    </div>
  );

  return (
    <div dir="rtl" className="report-sheet mx-auto max-w-4xl bg-white p-8 text-[#111827]">
      <style>{`
        @media print {
          .no-print { display: none !important }
          html, body { background: #fff !important }
          @page { size: A4 portrait; margin: 10mm }

          /* اطبع الخلفيات والألوان زي ما هي على الشاشة (رأس الجدول الكحلي + تظليل الصفوف) */
          *, *::before, *::after {
            -webkit-print-color-adjust: exact !important;
            print-color-adjust: exact !important;
          }

          /* الورقة تاخد عرض الصفحة كامل — هوامش @page بتكفي */
          .report-sheet {
            max-width: none !important;
            width: 100% !important;
            margin: 0 !important;
            padding: 0 !important;
          }

          /* حجم الخط متناسب مع ضيق الورقة عن الشاشة → نفس التوزيع بلا لفّ */
          .report-sheet table { font-size: 12px !important }
          .report-sheet th, .report-sheet td { padding: 5px 6px !important }
          .report-sheet .nowrap { white-space: nowrap !important }

          /* الترويسة والبطاقات ما تتقسمش على صفحتين */
          .report-head { break-inside: avoid; break-after: avoid; page-break-inside: avoid }
          .report-cards { break-inside: avoid; page-break-inside: avoid }
          .report-section { break-inside: avoid; page-break-inside: avoid }
          /* رأس الجدول يتكرر في كل صفحة والصف ما يتقسمش */
          thead { display: table-header-group }
          tr { break-inside: avoid; page-break-inside: avoid }
          .report-total { break-inside: avoid; page-break-inside: avoid }
        }
      `}</style>

      <div className="report-head mb-6 flex items-start justify-between border-b-2 border-[#1F3864] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1F3864]">{العنوان}</h1>
          <p className="mt-1 text-sm text-gray-600">
            {الوصف}
            {اسم_الطرف ? ` — ${اسم_الطرف}` : ""}
          </p>
        </div>
        <div className="text-left text-xs text-gray-500">
          <div>سُكر — نظام إدارة الأعمال</div>
          <div>تاريخ الإصدار: {نص_يوم(new Date())}</div>
          {معاملة && <div>تاريخ المعاملة: {نص_يوم(معاملة.date)}</div>}
          <div>بواسطة: {م.name}</div>
        </div>
      </div>

      <div className="report-cards mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        {شيكات.length > 0 && بطاقة("عدد الشيكات", String(شيكات.length))}
        {شيكات.length > 0 && بطاقة(مركّبة ? "إجمالي الشيكات" : "إجمالي القيمة", `${نص_مبلغ(إجمالي_الشيكات)} ج.م`)}
        {حركات.length > 0 && بطاقة("نقدي وتحويلات", `${نص_مبلغ(إجمالي_النقدي)} ج.م`)}
        {مركّبة && بطاقة("الإجمالي العام", `${نص_مبلغ(الإجمالي)} ج.م`)}
      </div>

      {/* ── الشيكات ── */}
      {شيكات.length > 0 && (
        <div className="report-section mb-5">
          {مركّبة && <h2 className="mb-2 text-base font-bold text-[#1F3864]">الشيكات المُظهَّرة</h2>}
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#1F3864] text-white">
                <th className="border border-gray-300 px-2 py-2 text-start font-medium">#</th>
                <th className="nowrap border border-gray-300 px-2 py-2 text-start font-medium">رقم الشيك</th>
                <th className="border border-gray-300 px-2 py-2 text-start font-medium">اسم المدين</th>
                <th className="border border-gray-300 px-2 py-2 text-start font-medium">البنك</th>
                <th className="nowrap border border-gray-300 px-2 py-2 text-start font-medium">الاستحقاق</th>
                <th className="nowrap border border-gray-300 px-2 py-2 text-start font-medium">الحالة</th>
                {مورد_سياق && <th className="nowrap border border-gray-300 px-2 py-2 text-start font-medium">تاريخ التظهير</th>}
                <th className="nowrap border border-gray-300 px-2 py-2 text-end font-medium">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {شيكات.map((ش, i) => (
                <tr key={ش.id} className="odd:bg-white even:bg-gray-50">
                  <td className="border border-gray-300 px-2 py-1.5 text-gray-500">{i + 1}</td>
                  <td className="nowrap border border-gray-300 px-2 py-1.5 ltr-nums">{ش.chequeNumber || "—"}</td>
                  <td className="border border-gray-300 px-2 py-1.5">{ش.drawerName || ش.transferredFrom || ش.party?.name || "—"}</td>
                  <td className="border border-gray-300 px-2 py-1.5">{ش.bankName || "—"}</td>
                  <td className="nowrap border border-gray-300 px-2 py-1.5 ltr-nums">{نص_يوم(ش.dueDate)}</td>
                  <td className="nowrap border border-gray-300 px-2 py-1.5">{تسمية_حالة_الشيك[ش.status] ?? ش.status}</td>
                  {مورد_سياق && <td className="nowrap border border-gray-300 px-2 py-1.5 ltr-nums">{نص_يوم(ش.endorsedAt)}</td>}
                  <td className="nowrap border border-gray-300 px-2 py-1.5 text-end ltr-nums">{نص_مبلغ(Number(ش.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {مركّبة && (
            <div className="mt-2 flex items-center justify-between rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm font-semibold">
              <span>إجمالي الشيكات</span>
              <span className="ltr-nums">{نص_مبلغ(إجمالي_الشيكات)} ج.م</span>
            </div>
          )}
        </div>
      )}

      {/* ── النقدي والتحويلات ── */}
      {حركات.length > 0 && (
        <div className="report-section mb-5">
          {مركّبة && <h2 className="mb-2 text-base font-bold text-[#1F3864]">نقدي وتحويلات</h2>}
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className="bg-[#1F3864] text-white">
                <th className="border border-gray-300 px-2 py-2 text-start font-medium">#</th>
                <th className="nowrap border border-gray-300 px-2 py-2 text-start font-medium">التاريخ</th>
                <th className="nowrap border border-gray-300 px-2 py-2 text-start font-medium">الوسيلة</th>
                <th className="border border-gray-300 px-2 py-2 text-start font-medium">الحساب</th>
                <th className="border border-gray-300 px-2 py-2 text-start font-medium">البيان</th>
                <th className="nowrap border border-gray-300 px-2 py-2 text-end font-medium">المبلغ</th>
              </tr>
            </thead>
            <tbody>
              {حركات.map((ح, i) => (
                <tr key={ح.id} className="odd:bg-white even:bg-gray-50">
                  <td className="border border-gray-300 px-2 py-1.5 text-gray-500">{i + 1}</td>
                  <td className="nowrap border border-gray-300 px-2 py-1.5 ltr-nums">{نص_يوم(ح.date)}</td>
                  <td className="nowrap border border-gray-300 px-2 py-1.5">{ح.method || تسمية_حساب_الخزنة[ح.account.type]}</td>
                  <td className="border border-gray-300 px-2 py-1.5">{ح.subAccount?.name || "—"}</td>
                  <td className="border border-gray-300 px-2 py-1.5">{ح.description}</td>
                  <td className="nowrap border border-gray-300 px-2 py-1.5 text-end ltr-nums">{نص_مبلغ(Number(ح.amount))}</td>
                </tr>
              ))}
            </tbody>
          </table>
          {مركّبة && (
            <div className="mt-2 flex items-center justify-between rounded-lg border border-gray-300 bg-gray-50 px-3 py-1.5 text-sm font-semibold">
              <span>إجمالي النقدي والتحويلات</span>
              <span className="ltr-nums">{نص_مبلغ(إجمالي_النقدي)} ج.م</span>
            </div>
          )}
        </div>
      )}

      {شيكات.length === 0 && حركات.length === 0 && (
        <p className="rounded-lg border border-gray-200 bg-gray-50 p-6 text-center text-sm text-gray-500">
          لا توجد بيانات لعرضها في هذا التقرير.
        </p>
      )}

      {/* الإجمالي العام مرة واحدة بعد الجداول (تفادي تكراره في كل صفحة عند الطباعة) */}
      <div className="report-total mt-3 flex items-center justify-between rounded-lg border-2 border-[#1F3864] bg-gray-100 px-4 py-2.5 font-bold">
        <span>{مركّبة ? "الإجمالي العام" : "الإجمالي"}</span>
        <span className="ltr-nums">{نص_مبلغ(الإجمالي)} ج.م</span>
      </div>

      <div className="mt-6 flex justify-end">
        <زر_طباعة_التقرير />
      </div>
    </div>
  );
}
