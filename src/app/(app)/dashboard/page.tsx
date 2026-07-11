import Link from "next/link";
import {
  Wallet,
  Users,
  Truck,
  FileText,
  Receipt,
  AlertTriangle,
  TrendingUp,
} from "lucide-react";
import { بيانات_اللوحة } from "@/lib/dashboard";
import { ترويسة_الصفحة } from "@/components/page-header";
import { بطاقة_مؤشر } from "@/components/kpi-card";
import { نص_مبلغ } from "@/components/money-text";
import { نص_تاريخ } from "@/components/date-text";
import { مترجم_الخادم } from "@/lib/i18n/server";
import { قائمة_متدرجة, عنصر_متدرج, رقم_متحرك } from "@/components/motion/motion-primitives";
import { رسوم_اللوحة } from "./charts";

export const metadata = { title: "الرئيسية — سُكر" };
export const dynamic = "force-dynamic";

export default async function صفحة_الرئيسية() {
  const د = await بيانات_اللوحة();
  const { t } = مترجم_الخادم();

  return (
    <div className="space-y-6">
      <ترويسة_الصفحة العنوان={t("dash.title")} الوصف={t("dash.subtitle")} />

      {/* مؤشرات رئيسية */}
      <قائمة_متدرجة className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <عنصر_متدرج className="h-full"><بطاقة_مؤشر العنوان={t("dash.kpi.treasury_total")} القيمة={<نص_مبلغ القيمة={د.الخزنة.الإجمالي} />} أيقونة={<Wallet className="size-5" />} لون="navy" رابط="/treasury" /></عنصر_متدرج>
        <عنصر_متدرج className="h-full"><بطاقة_مؤشر العنوان={t("dash.kpi.customer_debt")} القيمة={<نص_مبلغ القيمة={د.العملاء.إجمالي_المديونية} />} أيقونة={<Users className="size-5" />} لون="danger" وصف={t("dash.customers_count", { count: د.العملاء.عدد })} رابط="/customers" /></عنصر_متدرج>
        <عنصر_متدرج className="h-full"><بطاقة_مؤشر العنوان={t("dash.kpi.supplier_payable")} القيمة={<نص_مبلغ القيمة={د.الموردون.إجمالي_المستحقات} />} أيقونة={<Truck className="size-5" />} لون="warning" وصف={t("dash.suppliers_count", { count: د.الموردون.عدد })} رابط="/suppliers" /></عنصر_متدرج>
        <عنصر_متدرج className="h-full"><بطاقة_مؤشر العنوان={t("dash.kpi.month_sales")} القيمة={<نص_مبلغ القيمة={د.الفواتير.مبيعات_الشهر} />} أيقونة={<FileText className="size-5" />} لون="success" وصف={t("dash.invoices_count_month", { count: د.الفواتير.عدد_الشهر })} رابط="/invoices" /></عنصر_متدرج>
      </قائمة_متدرجة>

      {/* الخزنة بالتفصيل */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {د.الخزنة.حسابات.map((h) => (
          <div key={h.التسمية} className="card-soft card-hover p-4">
            <p className="text-sm text-muted-foreground">{h.التسمية}</p>
            <div className={`mt-1 text-lg font-bold ${h.الرصيد < 0 ? "text-danger" : ""}`}>
              <نص_مبلغ القيمة={h.الرصيد} />
            </div>
            {h.تحت_الحد && <p className="mt-1 text-xs text-warning">{t("dash.under_threshold")}</p>}
          </div>
        ))}
      </div>

      {/* مركز التنبيهات */}
      {(د.الشيكات.عدد_متأخر > 0 || د.الشيكات.عدد_خلال_7 > 0 || د.تنبيهات_الائتمان.length > 0 || د.الخزنة.حسابات.some((h) => h.تحت_الحد)) && (
        <div className="card-soft border-warning/30 bg-warning-soft/40 p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-warning">
            <AlertTriangle className="size-5" /> {t("dash.alerts")}
          </h3>
          <ul className="space-y-1.5 text-sm">
            {د.الشيكات.عدد_متأخر > 0 && (
              <li><Link href="/cheques" className="text-primary-blue hover:underline">• {t("dash.cheque_overdue", { count: د.الشيكات.عدد_متأخر })}</Link></li>
            )}
            {د.الشيكات.عدد_خلال_7 > 0 && (
              <li><Link href="/cheques" className="text-primary-blue hover:underline">• {t("dash.cheque_due7", { count: د.الشيكات.عدد_خلال_7 })}</Link></li>
            )}
            {د.الخزنة.حسابات.filter((h) => h.تحت_الحد).map((h) => (
              <li key={h.التسمية}><Link href="/treasury" className="text-primary-blue hover:underline">• {t("dash.account_under", { name: h.التسمية })}</Link></li>
            ))}
            {د.تنبيهات_الائتمان.map((c) => (
              <li key={c.id}><Link href={`/customers/${c.id}`} className="text-primary-blue hover:underline">• {t("dash.credit_over", { name: c.name })}</Link></li>
            ))}
          </ul>
        </div>
      )}

      {/* بطاقات إضافية */}
      <قائمة_متدرجة className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <عنصر_متدرج className="h-full"><بطاقة_مؤشر العنوان={t("dash.sales_today")} القيمة={<رقم_متحرك القيمة={د.الفواتير.عدد_مبيعات_اليوم} />} وصف={t("dash.amount_label", { amount: د.الفواتير.إجمالي_مبيعات_اليوم.toLocaleString("en-US", { minimumFractionDigits: 2 }) })} أيقونة={<FileText className="size-5" />} لون="success" /></عنصر_متدرج>
        <عنصر_متدرج className="h-full"><بطاقة_مؤشر العنوان={t("dash.purchases_today")} القيمة={<رقم_متحرك القيمة={د.الفواتير.عدد_مشتريات_اليوم} />} وصف={t("dash.amount_label", { amount: د.الفواتير.إجمالي_مشتريات_اليوم.toLocaleString("en-US", { minimumFractionDigits: 2 }) })} أيقونة={<FileText className="size-5" />} لون="warning" /></عنصر_متدرج>
        <عنصر_متدرج className="h-full"><بطاقة_مؤشر العنوان={t("dash.cheques_due_month")} القيمة={<رقم_متحرك القيمة={د.الشيكات.عدد_هذا_الشهر} />} أيقونة={<Receipt className="size-5" />} لون="navy" رابط="/cheques" /></عنصر_متدرج>
        <عنصر_متدرج className="h-full"><بطاقة_مؤشر العنوان={t("dash.cheques_overdue")} القيمة={<رقم_متحرك القيمة={د.الشيكات.عدد_متأخر} />} أيقونة={<Receipt className="size-5" />} لون="danger" رابط="/cheques" /></عنصر_متدرج>
        <عنصر_متدرج className="h-full"><بطاقة_مؤشر العنوان={t("dash.cheques_total_due")} القيمة={<نص_مبلغ القيمة={د.الشيكات.إجمالي_المستحق} />} أيقونة={<Receipt className="size-5" />} لون="warning" /></عنصر_متدرج>
      </قائمة_متدرجة>


      {/* الرسوم */}
      <رسوم_اللوحة السلسلة={د.السلسلة} />

      {/* أعلى المدينين والموردين */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-soft p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold"><TrendingUp className="size-5 text-danger" /> {t("dash.top_customers")}</h3>
          {د.العملاء.الأعلى.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dash.none")}</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {د.العملاء.الأعلى.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2"><Link href={`/customers/${c.id}`} className="text-primary-blue hover:underline">{c.الاسم}</Link></td>
                    <td className="py-2 text-end"><نص_مبلغ القيمة={c.الرصيد} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card-soft p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold"><TrendingUp className="size-5 text-warning" /> {t("dash.top_suppliers")}</h3>
          {د.الموردون.الأعلى.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("dash.none")}</p>
          ) : (
            <table className="w-full text-sm">
              <tbody className="divide-y divide-border">
                {د.الموردون.الأعلى.map((c) => (
                  <tr key={c.id}>
                    <td className="py-2"><Link href={`/suppliers/${c.id}`} className="text-primary-blue hover:underline">{c.الاسم}</Link></td>
                    <td className="py-2 text-end"><نص_مبلغ القيمة={c.الرصيد} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>
    </div>
  );
}
