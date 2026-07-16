import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { نص_مبلغ } from "@/components/money-text";
import { نص_تاريخ } from "@/components/date-text";
import { سطر_المساءلة } from "@/components/accountability-line";
import { تفقيط } from "@/lib/tafqit";
import { مترجم_الخادم } from "@/lib/i18n/server";
import { شريط_إجراءات_الفاتورة } from "./actions-bar";
import { مبدّل_رصيد_الفاتورة } from "./balance-toggle";

export const metadata = { title: "عرض فاتورة — سُكر" };

export default async function صفحة_عرض_فاتورة({
  params,
}: {
  params: { id: string };
}) {
  const id = Number(params.id);
  const { t } = مترجم_الخادم();
  const [فاتورة, إعدادات] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        lines: { orderBy: [{ category: "asc" }, { id: "asc" }] },
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
        treasuryTxns: {
          where: { deletedAt: null },
          select: { amount: true },
        },
        ledgerEntries: {
          where: { treasuryTxnId: null },
          select: { debit: true, credit: true, balanceAfter: true },
          orderBy: { id: "asc" },
        },
      },
    }),
    prisma.setting.findMany({
      where: { key: { in: ["اسم_الشركة", "شعار_الشركة"] } },
    }),
  ]);
  if (!فاتورة) notFound();

  const اسم_الشركة =
    إعدادات.find((s) => s.key === "اسم_الشركة")?.value || "مؤسسة سكر";
  const لها_شعار = !!(إعدادات.find((s) => s.key === "شعار_الشركة")?.value);
  const رقم = فاتورة.number
    ? String(فاتورة.number).padStart(7, "0")
    : (فاتورة.externalRef ?? "—");
  const نوع_الفاتورة = (فاتورة.invoiceType ?? "SALE") as "SALE" | "PURCHASE" | "SUPPLIER_RETURN";
  const هو_مورد = نوع_الفاتورة === "PURCHASE" || نوع_الفاتورة === "SUPPLIER_RETURN";
  const عميل_زائر = !فاتورة.customerId;
  const اسم_الطرف = فاتورة.customer?.name ?? فاتورة.guestName ?? "عميل نقدي";

  // إجماليات المبيعات والمرتجعات من البنود
  const إجمالي_مبيعات_الفاتورة = فاتورة.lines
    .filter((l) => l.lineType !== "RETURN")
    .reduce((s, l) => s + Number(l.lineTotal), 0);
  const إجمالي_مرتجعات_الفاتورة = فاتورة.lines
    .filter((l) => l.lineType === "RETURN")
    .reduce((s, l) => s + Number(l.lineTotal), 0);
  const لها_مرتجعات = !هو_مورد && إجمالي_مرتجعات_الفاتورة > 0;

  const إجمالي_مبيعات_كمية = فاتورة.lines
    .filter((l) => l.lineType !== "RETURN")
    .reduce((s, l) => s + Number(l.qty), 0);
  const إجمالي_مرتجعات_كمية = فاتورة.lines
    .filter((l) => l.lineType === "RETURN")
    .reduce((s, l) => s + Number(l.qty), 0);
  const صافي_الكمية = إجمالي_مبيعات_كمية - إجمالي_مرتجعات_كمية;

  const إجمالي_مبيعات_وزن = فاتورة.lines
    .filter((l) => l.lineType !== "RETURN")
    .reduce((s, l) => s + Number(l.weight), 0);
  const إجمالي_مرتجعات_وزن = فاتورة.lines
    .filter((l) => l.lineType === "RETURN")
    .reduce((s, l) => s + Number(l.weight), 0);
  const صافي_الوزن = إجمالي_مبيعات_وزن - إجمالي_مرتجعات_وزن;

  // تجميع البنود حسب التصنيف مع الإجماليات
  type مجموعة_تصنيف = {
    التصنيف: string;
    إجمالي_الكمية: number;
    إجمالي_الوزن: number;
    إجمالي_المبلغ: number; // صافي = مبيعات − مرتجعات
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
    const إشارة = بند.lineType === "RETURN" ? -1 : 1;
    مجموعة.بنود.push(بند);
    مجموعة.إجمالي_الكمية += Number(بند.qty) * إشارة;
    مجموعة.إجمالي_الوزن += Number(بند.weight) * إشارة;
    مجموعة.إجمالي_المبلغ += Number(بند.lineTotal) * إشارة;
    if (Number(بند.price) > 0) مجموعة.أسعار.add(Number(بند.price));
    تجميع.set(بند.category, مجموعة);
  }
  const مجموعات = [...تجميع.values()];

  return (
    <div>
      <شريط_إجراءات_الفاتورة
        المعرف={فاتورة.id}
        الرقم={فاتورة.number}
        مرجع_خارجي={فاتورة.externalRef}
        هاتف_العميل={فاتورة.phone || فاتورة.customer?.phone}
        اسم_العميل={اسم_الطرف}
        اسم_الشركة={اسم_الشركة}
        الإجمالي={Number(فاتورة.totalAmount)}
        التاريخ={فاتورة.date.toLocaleDateString("ar-EG", { day: "2-digit", month: "2-digit", year: "numeric" })}
        رمز_المشاركة={فاتورة.shareToken}
      />

      {/* ورقة الفاتورة (قابلة للطباعة) */}
      <div className="mx-auto max-w-3xl card-soft p-8 text-foreground print:max-w-none print:border-0 print:p-0 print:text-black print:shadow-none">

        {/* الرأس */}
        <div className="flex items-start justify-between gap-4 border-b-2 border-foreground/80 pb-4 print:border-black">
          <div className="flex items-center gap-3">
            {لها_شعار ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src="/api/logo"
                alt={t("inv.v.logo_alt")}
                className="h-14 w-14 object-contain"
              />
            ) : null}
            <div>
              <h1 className="text-2xl font-bold">{اسم_الشركة}</h1>
              <p className="text-sm font-medium">
                {نوع_الفاتورة === "PURCHASE" ? "مورد (شراء)" :
                 نوع_الفاتورة === "SUPPLIER_RETURN" ? "مورد (بيع)" :
                 لها_مرتجعات ? "فاتورة بيع ومرتجع" :
                 t("inv.v.sales_invoice")}
              </p>
            </div>
          </div>
          <div className="text-end text-sm leading-7">
            <p>
              <span className="font-semibold">{t("inv.col.number")}: </span>
              <span className="ltr-nums text-lg font-bold">{رقم}</span>
            </p>
            {هو_مورد && فاتورة.externalRef && (
              <p>
                <span className="font-semibold">رقم فاتورة المورد: </span>
                <span className="ltr-nums font-bold">{فاتورة.externalRef}</span>
              </p>
            )}
            <p>
              <span className="font-semibold">{t("common.date")}: </span>
              <نص_تاريخ القيمة={فاتورة.date} />
            </p>
          </div>
        </div>

        {/* العميل / المورد */}
        <div className="my-4 flex flex-wrap gap-x-10 gap-y-1 text-[15px]">
          <span>
            <span className="font-semibold">{هو_مورد ? "المورد" : t("inv.col.customer")}: </span>
            {اسم_الطرف}
            {عميل_زائر && (
              <span className="mr-2 text-xs text-muted-foreground border border-border rounded px-1.5 py-0.5">نقدي</span>
            )}
          </span>
          <span>
            <span className="font-semibold">{t("party.col.phone")}: </span>
            <span className="ltr-nums">
              {فاتورة.phone || فاتورة.customer?.phone || "—"}
            </span>
          </span>
        </div>

        {/* جدول البنود — مجمّع حسب التصنيف */}
        <table className="w-full border-collapse text-[13px]">
          <thead>
            <tr className="border-y-2 border-foreground/70 print:border-black">
              <th className="px-2 py-2.5 text-start font-bold">
                {t("inv.v.color_desc")}
              </th>
              <th className="px-2 py-2.5 text-end font-bold w-14">
                {t("inv.v.count")}
              </th>
              <th className="px-2 py-2.5 text-end font-bold w-20">
                {t("inv.v.weight")}
              </th>
              <th className="px-2 py-2.5 text-end font-bold w-20">
                {t("inv.f.price_kg")}
              </th>
              <th className="px-2 py-2.5 text-end font-bold w-28">
                {t("inv.f.subtotal")}
              </th>
            </tr>
          </thead>
          <tbody>
            {مجموعات.map((مجموعة) => (
              <>
                {/* بنود التصنيف */}
                {مجموعة.بنود.map((بند) => (
                  <tr
                    key={بند.id}
                    className={`border-b border-foreground/10 print:border-black/15 ${
                      بند.lineType === "RETURN"
                        ? "bg-amber-50/60 dark:bg-amber-900/10 print:bg-amber-50/30"
                        : ""
                    }`}
                  >
                    <td className="px-2 py-1.5">
                      {بند.lineType === "RETURN" && (
                        <span className="inline-block text-[10px] text-amber-700 font-bold border border-amber-300 rounded px-1 ml-1.5 print:border-amber-400">
                          مرتجع
                        </span>
                      )}
                      <span className="font-medium">{بند.color}</span>
                      {بند.company && (
                        <span className="text-muted-foreground mr-1.5 text-[12px]">
                          — {بند.company}
                        </span>
                      )}
                    </td>
                    <td className={`px-2 py-1.5 text-end ltr-nums ${بند.lineType === "RETURN" ? "text-amber-700" : ""}`}>
                      {Number(بند.qty)}
                    </td>
                    <td className={`px-2 py-1.5 text-end ltr-nums ${بند.lineType === "RETURN" ? "text-amber-700" : ""}`}>
                      {Number(بند.weight).toFixed(2)}
                    </td>
                    <td className="px-2 py-1.5 text-end ltr-nums text-muted-foreground text-[12px]">
                      {Number(بند.price) > 0
                        ? Number(بند.price).toLocaleString("en-US", {
                            minimumFractionDigits: 2,
                          })
                        : "—"}
                    </td>
                    <td className={`px-2 py-1.5 text-end ltr-nums ${بند.lineType === "RETURN" ? "text-amber-700 font-medium" : ""}`}>
                      {Number(بند.price) > 0
                        ? `${بند.lineType === "RETURN" ? "(" : ""}${Number(بند.lineTotal).toLocaleString("en-US", { minimumFractionDigits: 2 })}${بند.lineType === "RETURN" ? ")" : ""}`
                        : "—"}
                    </td>
                  </tr>
                ))}

                {/* صف إجمالي التصنيف */}
                <tr className="border-y border-foreground/30 bg-foreground/5 font-semibold print:border-black/30 print:bg-black/5">
                  <td className="px-2 py-1.5 text-sm">
                    إجمالي: {مجموعة.التصنيف}
                  </td>
                  <td className="px-2 py-1.5 text-end ltr-nums text-sm">
                    {مجموعة.إجمالي_الكمية}
                  </td>
                  <td className="px-2 py-1.5 text-end ltr-nums text-sm">
                    {مجموعة.إجمالي_الوزن.toFixed(2)}
                  </td>
                  <td className="px-2 py-1.5 text-end ltr-nums text-sm text-muted-foreground font-normal">
                    {(() => {
                      const أسعار = [...مجموعة.أسعار];
                      if (أسعار.length === 1) return أسعار[0].toLocaleString("en-US", { minimumFractionDigits: 2 });
                      if (أسعار.length > 1) return `${Math.min(...أسعار).toFixed(0)}–${Math.max(...أسعار).toFixed(0)}`;
                      return "—";
                    })()}
                  </td>
                  <td className="px-2 py-1.5 text-end ltr-nums text-sm">
                    {مجموعة.إجمالي_المبلغ !== 0
                      ? Math.abs(مجموعة.إجمالي_المبلغ).toLocaleString("en-US", {
                          minimumFractionDigits: 2,
                        })
                      : "—"}
                  </td>
                </tr>
              </>
            ))}
          </tbody>
        </table>

        {/* جدول الملخص الموحّد */}
        {مجموعات.length > 0 && (
          <div className="mt-6">
            <table className="w-full border-collapse text-[13px]">
              <thead>
                <tr className="border-y-2 border-foreground/70 bg-foreground/5 print:border-black">
                  <th className="px-2 py-2 text-start font-bold">التصنيف / البيان</th>
                  <th className="px-2 py-2 text-end font-bold w-20">الشكارة</th>
                  <th className="px-2 py-2 text-end font-bold w-24">الوزن (كجم)</th>
                  <th className="px-2 py-2 text-end font-bold w-24">السعر/كجم</th>
                  <th className="px-2 py-2 text-end font-bold w-28">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {/* ── إجمالي المبيعات / المرتجعات / الصافي (أولاً عند وجود مرتجعات) ── */}
                {لها_مرتجعات && (
                  <>
                    <tr className="bg-green-50/60 dark:bg-green-900/10 print:bg-green-50/30">
                      <td className="px-2 py-1.5 font-semibold text-green-800 dark:text-green-300">إجمالي المبيعات</td>
                      <td className="px-2 py-1.5 text-end ltr-nums font-semibold text-green-800 dark:text-green-300">{إجمالي_مبيعات_كمية}</td>
                      <td className="px-2 py-1.5 text-end ltr-nums font-semibold text-green-800 dark:text-green-300">{إجمالي_مبيعات_وزن.toFixed(2)}</td>
                      <td />
                      <td className="px-2 py-1.5 text-end ltr-nums font-semibold text-green-800 dark:text-green-300">
                        {إجمالي_مبيعات_الفاتورة.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                      </td>
                    </tr>
                    <tr className="bg-amber-50/60 dark:bg-amber-900/10 print:bg-amber-50/30">
                      <td className="px-2 py-1.5 font-semibold text-amber-700 dark:text-amber-400">إجمالي المرتجعات</td>
                      <td className="px-2 py-1.5 text-end ltr-nums font-semibold text-amber-700 dark:text-amber-400">({إجمالي_مرتجعات_كمية})</td>
                      <td className="px-2 py-1.5 text-end ltr-nums font-semibold text-amber-700 dark:text-amber-400">({إجمالي_مرتجعات_وزن.toFixed(2)})</td>
                      <td />
                      <td className="px-2 py-1.5 text-end ltr-nums font-semibold text-amber-700 dark:text-amber-400">
                        ({إجمالي_مرتجعات_الفاتورة.toLocaleString("en-US", { minimumFractionDigits: 2 })})
                      </td>
                    </tr>
                    {/* ── ملخص التصنيفات (تفصيل) ── */}
                    <tr className="border-t border-foreground/10">
                      <td colSpan={5} className="px-2 pt-2 pb-0.5 text-[11px] font-bold uppercase tracking-wide text-muted-foreground">
                        ملخص التصنيفات
                      </td>
                    </tr>
                  </>
                )}

                {/* صفوف التصنيفات */}
                {مجموعات.map((م) => {
                  const أسعار_م = [...م.أسعار];
                  const سعر_نص_م =
                    أسعار_م.length === 1
                      ? أسعار_م[0].toLocaleString("en-US", { minimumFractionDigits: 2 })
                      : أسعار_م.length > 1
                        ? `${Math.min(...أسعار_م).toFixed(0)}–${Math.max(...أسعار_م).toFixed(0)}`
                        : "—";
                  const مبلغ_م = م.إجمالي_المبلغ;
                  const هو_سالب = مبلغ_م < 0;
                  return (
                    <tr
                      key={م.التصنيف}
                      className={`border-b border-foreground/10 print:border-black/10 ${هو_سالب ? "text-amber-700 dark:text-amber-400" : ""}`}
                    >
                      <td className="px-2 py-1.5 font-medium">{م.التصنيف}</td>
                      <td className="px-2 py-1.5 text-end ltr-nums">
                        {هو_سالب ? `(${Math.abs(م.إجمالي_الكمية)})` : م.إجمالي_الكمية}
                      </td>
                      <td className="px-2 py-1.5 text-end ltr-nums">
                        {هو_سالب ? `(${Math.abs(م.إجمالي_الوزن).toFixed(2)})` : م.إجمالي_الوزن.toFixed(2)}
                      </td>
                      <td className="px-2 py-1.5 text-end ltr-nums text-muted-foreground text-[12px]">{سعر_نص_م}</td>
                      <td className="px-2 py-1.5 text-end ltr-nums">
                        {مبلغ_م !== 0
                          ? هو_سالب
                            ? `(${Math.abs(مبلغ_م).toLocaleString("en-US", { minimumFractionDigits: 2 })})`
                            : مبلغ_م.toLocaleString("en-US", { minimumFractionDigits: 2 })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}

                {/* الإجمالي الكلي */}
                <tr className="border-t-2 border-foreground/80 print:border-black">
                  <td colSpan={4} className="px-2 py-2.5 text-base font-bold">
                    {لها_مرتجعات ? "صافي الفاتورة" : t("inv.col.total")}
                  </td>
                  <td className="px-2 py-2.5 text-end ltr-nums text-base font-bold">
                    <نص_مبلغ القيمة={فاتورة.totalAmount} />
                  </td>
                </tr>
              </tbody>
            </table>

            {/* التفقيط */}
            <p className="mt-2 text-[13px] text-muted-foreground">
              <span className="font-semibold text-foreground">{t("inv.v.in_words")} </span>
              {تفقيط(Math.abs(Number(فاتورة.totalAmount)))}
            </p>
          </div>
        )}

        {فاتورة.notes && (
          <p className="mt-5 border-t border-foreground/15 pt-3 text-sm print:border-black/20">
            <span className="font-semibold">{t("inv.v.notes_label")} </span>
            {فاتورة.notes}
          </p>
        )}

        {/* مبدّل الرصيد — للعملاء المسجّلين */}
        {!هو_مورد && !عميل_زائر && فاتورة.customer && (() => {
          const إجمالي_الدفعات = فاتورة.treasuryTxns.reduce((s, t) => s + Number(t.amount), 0);
          // استخدم أول قيد دفتر أستاذ للفاتورة (مرتّب بالمعرف تصاعديًا)
          // رصيد_سابق = balanceAfter − مدين + دائن (عميل: المدين يزيد الرصيد)
          const أول_قيد = فاتورة.ledgerEntries[0];
          const الرصيد_السابق = أول_قيد
            ? Number(أول_قيد.balanceAfter) - Number(أول_قيد.debit) + Number(أول_قيد.credit)
            : 0;
          return (
            <مبدّل_رصيد_الفاتورة
              الرصيد_السابق={الرصيد_السابق}
              قيمة_الفاتورة={Number(فاتورة.totalAmount)}
              إجمالي_الدفعات={إجمالي_الدفعات}
              اسم_الطرف={فاتورة.customer.name}
              نوع_الطرف="عميل"
              اتجاه_الفاتورة="زيادة"
            />
          );
        })()}

        {/* مبدّل الرصيد — للموردين */}
        {هو_مورد && فاتورة.customer && (() => {
          const إجمالي_الدفعات = فاتورة.treasuryTxns.reduce((s, t) => s + Number(t.amount), 0);
          // استخدم أول قيد دفتر أستاذ للفاتورة
          // مورد: رصيد_سابق = balanceAfter + مدين − دائن (الدائن يزيد رصيد المورد)
          const أول_قيد = فاتورة.ledgerEntries[0];
          const الرصيد_السابق = أول_قيد
            ? Number(أول_قيد.balanceAfter) + Number(أول_قيد.debit) - Number(أول_قيد.credit)
            : 0;
          return (
            <مبدّل_رصيد_الفاتورة
              الرصيد_السابق={الرصيد_السابق}
              قيمة_الفاتورة={Number(فاتورة.totalAmount)}
              إجمالي_الدفعات={إجمالي_الدفعات}
              اسم_الطرف={فاتورة.customer.name}
              نوع_الطرف="مورد"
              اتجاه_الفاتورة={نوع_الفاتورة === "PURCHASE" ? "زيادة" : "نقصان"}
            />
          );
        })()}

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
