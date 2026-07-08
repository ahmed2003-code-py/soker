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
  const رقم = String(فاتورة.number).padStart(7, "0");
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
                {نوع_الفاتورة === "PURCHASE" ? "فاتورة شراء من مورد" :
                 نوع_الفاتورة === "SUPPLIER_RETURN" ? "مرتجع إلى مورد" :
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

        {/* الإجماليات الكلية */}
        <div className="mt-6 flex flex-col items-end gap-6 sm:flex-row sm:items-start sm:justify-between">
          {/* ملخص التصنيفات */}
          {مجموعات.length > 0 && (
            <div className="w-full sm:max-w-xs">
              <h3 className="mb-1.5 text-sm font-bold">
                {t("inv.f.summary_by_cat")}
              </h3>
              <table className="w-full border-collapse text-[13px]">
                <thead>
                  <tr className="border-b border-foreground/40 print:border-black/50">
                    <th className="py-1 text-start font-semibold">{t("inv.f.category")}</th>
                    <th className="py-1 text-end font-semibold">{t("inv.v.count")}</th>
                    <th className="py-1 text-end font-semibold">{t("inv.v.weight")}</th>
                    <th className="py-1 text-end font-semibold">{t("inv.f.price_kg")}</th>
                    <th className="py-1 text-end font-semibold">المبلغ</th>
                  </tr>
                </thead>
                <tbody>
                  {مجموعات.map((م) => {
                    const أسعار_م = [...م.أسعار];
                    const سعر_نص_م = أسعار_م.length === 1
                      ? أسعار_م[0].toLocaleString("en-US", { minimumFractionDigits: 2 })
                      : أسعار_م.length > 1
                        ? `${Math.min(...أسعار_م).toFixed(0)}–${Math.max(...أسعار_م).toFixed(0)}`
                        : "—";
                    return (
                      <tr
                        key={م.التصنيف}
                        className="border-b border-foreground/10 print:border-black/10"
                      >
                        <td className="py-1">{م.التصنيف}</td>
                        <td className="py-1 text-end ltr-nums">{م.إجمالي_الكمية}</td>
                        <td className="py-1 text-end ltr-nums">{م.إجمالي_الوزن.toFixed(2)}</td>
                        <td className="py-1 text-end ltr-nums text-muted-foreground text-[12px]">{سعر_نص_م}</td>
                        <td className="py-1 text-end ltr-nums">
                          {م.إجمالي_المبلغ !== 0
                            ? Math.abs(م.إجمالي_المبلغ).toLocaleString("en-US", { minimumFractionDigits: 2 })
                            : "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}

          {/* الإجمالي المالي الكلي */}
          <div className="w-full sm:max-w-xs space-y-1">
            <div className="flex justify-between py-1 text-sm">
              <span>{t("inv.f.total_count")}</span>
              <span className="ltr-nums font-medium">{Number(فاتورة.totalQty)}</span>
            </div>
            <div className="flex justify-between py-1 text-sm">
              <span>{t("inv.col.total_weight")}</span>
              <span className="ltr-nums font-medium">
                {Number(فاتورة.totalWeight).toFixed(2)} {t("inv.kg")}
              </span>
            </div>

            {/* تفصيل المبيعات والمرتجعات */}
            {لها_مرتجعات && (
              <>
                <div className="flex justify-between py-1 text-sm border-t border-foreground/20 pt-2">
                  <span>إجمالي المبيعات</span>
                  <span className="ltr-nums font-medium">
                    {إجمالي_مبيعات_الفاتورة.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                  </span>
                </div>
                <div className="flex justify-between py-1 text-sm text-amber-700 dark:text-amber-400">
                  <span>إجمالي المرتجعات</span>
                  <span className="ltr-nums font-medium">
                    ({إجمالي_مرتجعات_الفاتورة.toLocaleString("en-US", { minimumFractionDigits: 2 })})
                  </span>
                </div>
              </>
            )}

            <div className="mt-1 flex items-center justify-between border-t-2 border-foreground/80 pt-2 text-lg font-bold print:border-black">
              <span>{لها_مرتجعات ? "الصافي" : t("inv.col.total")}</span>
              <نص_مبلغ القيمة={فاتورة.totalAmount} />
            </div>
            <p className="mt-2 text-[13px]">
              <span className="font-semibold">{t("inv.v.in_words")} </span>
              {تفقيط(Math.abs(Number(فاتورة.totalAmount)))}
            </p>
          </div>
        </div>

        {فاتورة.notes && (
          <p className="mt-5 border-t border-foreground/15 pt-3 text-sm print:border-black/20">
            <span className="font-semibold">{t("inv.v.notes_label")} </span>
            {فاتورة.notes}
          </p>
        )}

        {/* مبدّل الرصيد — للعملاء المسجّلين فقط */}
        {!هو_مورد && !عميل_زائر && فاتورة.customer && (() => {
          const إجمالي_الدفعات = فاتورة.treasuryTxns.reduce((s, t) => s + Number(t.amount), 0);
          // totalAmount = صافي (مبيعات − مرتجعات). الرصيد_السابق = balance - totalAmount + payments
          const الرصيد_السابق = Number(فاتورة.customer.balance) - Number(فاتورة.totalAmount) + إجمالي_الدفعات;
          return (
            <مبدّل_رصيد_الفاتورة
              الرصيد_الحالي={الرصيد_السابق}
              قيمة_الفاتورة={Number(فاتورة.totalAmount)}
              إجمالي_الدفعات={إجمالي_الدفعات}
              اسم_العميل={فاتورة.customer.name}
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
