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
import { رسوم_اللوحة } from "./charts";

export const metadata = { title: "الرئيسية — سُكر" };
export const dynamic = "force-dynamic";

export default async function صفحة_الرئيسية() {
  const د = await بيانات_اللوحة();

  return (
    <div className="space-y-6">
      <ترويسة_الصفحة العنوان="لوحة التحكم" الوصف="ملخّص حيّ لكامل النشاط" />

      {/* مؤشرات رئيسية */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <بطاقة_مؤشر العنوان="إجمالي الخزنة" القيمة={<نص_مبلغ القيمة={د.الخزنة.الإجمالي} />} أيقونة={<Wallet className="size-5" />} لون="navy" رابط="/treasury" />
        <بطاقة_مؤشر العنوان="مديونية العملاء" القيمة={<نص_مبلغ القيمة={د.العملاء.إجمالي_المديونية} />} أيقونة={<Users className="size-5" />} لون="danger" وصف={`${د.العملاء.عدد} عميل مدين`} رابط="/customers" />
        <بطاقة_مؤشر العنوان="مستحقات الموردين" القيمة={<نص_مبلغ القيمة={د.الموردون.إجمالي_المستحقات} />} أيقونة={<Truck className="size-5" />} لون="warning" وصف={`${د.الموردون.عدد} مورد`} رابط="/suppliers" />
        <بطاقة_مؤشر العنوان="مبيعات هذا الشهر" القيمة={<نص_مبلغ القيمة={د.الفواتير.مبيعات_الشهر} />} أيقونة={<FileText className="size-5" />} لون="success" وصف={`${د.الفواتير.عدد_الشهر} فاتورة`} رابط="/invoices" />
      </div>

      {/* الخزنة بالتفصيل */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {د.الخزنة.حسابات.map((h) => (
          <div key={h.التسمية} className="card-soft p-4">
            <p className="text-sm text-muted-foreground">{h.التسمية}</p>
            <div className={`mt-1 text-lg font-bold ${h.الرصيد < 0 ? "text-danger" : ""}`}>
              <نص_مبلغ القيمة={h.الرصيد} />
            </div>
            {h.تحت_الحد && <p className="mt-1 text-xs text-warning">تحت الحد الأدنى</p>}
          </div>
        ))}
      </div>

      {/* مركز التنبيهات */}
      {(د.الشيكات.عدد_متأخر > 0 || د.الشيكات.عدد_خلال_7 > 0 || د.تنبيهات_الائتمان.length > 0 || د.الخزنة.حسابات.some((h) => h.تحت_الحد)) && (
        <div className="card-soft border-warning/30 bg-warning-soft/40 p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold text-warning">
            <AlertTriangle className="size-5" /> مركز التنبيهات
          </h3>
          <ul className="space-y-1.5 text-sm">
            {د.الشيكات.عدد_متأخر > 0 && (
              <li><Link href="/cheques" className="text-primary-blue hover:underline">• {د.الشيكات.عدد_متأخر} شيك متأخر</Link></li>
            )}
            {د.الشيكات.عدد_خلال_7 > 0 && (
              <li><Link href="/cheques" className="text-primary-blue hover:underline">• {د.الشيكات.عدد_خلال_7} شيك يستحق خلال 7 أيام</Link></li>
            )}
            {د.الخزنة.حسابات.filter((h) => h.تحت_الحد).map((h) => (
              <li key={h.التسمية}><Link href="/treasury" className="text-primary-blue hover:underline">• حساب {h.التسمية} تحت الحد الأدنى</Link></li>
            ))}
            {د.تنبيهات_الائتمان.map((c) => (
              <li key={c.id}><Link href={`/customers/${c.id}`} className="text-primary-blue hover:underline">• العميل {c.name} تجاوز حد الائتمان</Link></li>
            ))}
          </ul>
        </div>
      )}

      {/* بطاقات إضافية */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <بطاقة_مؤشر العنوان="فواتير اليوم" القيمة={د.الفواتير.عدد_اليوم} وصف={`مبيعات: ${د.الفواتير.مبيعات_اليوم.toLocaleString("en-US")}`} أيقونة={<FileText className="size-5" />} />
        <بطاقة_مؤشر العنوان="شيكات تستحق هذا الشهر" القيمة={د.الشيكات.عدد_هذا_الشهر} أيقونة={<Receipt className="size-5" />} لون="navy" رابط="/cheques" />
        <بطاقة_مؤشر العنوان="شيكات متأخرة" القيمة={د.الشيكات.عدد_متأخر} أيقونة={<Receipt className="size-5" />} لون="danger" رابط="/cheques" />
        <بطاقة_مؤشر العنوان="إجمالي الشيكات المستحقة" القيمة={<نص_مبلغ القيمة={د.الشيكات.إجمالي_المستحق} />} أيقونة={<Receipt className="size-5" />} لون="warning" />
      </div>

      {/* الرسوم */}
      <رسوم_اللوحة السلسلة={د.السلسلة} />

      {/* أعلى المدينين والموردين */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-soft p-5">
          <h3 className="mb-3 flex items-center gap-2 font-semibold"><TrendingUp className="size-5 text-danger" /> أعلى 10 عملاء مديونية</h3>
          {د.العملاء.الأعلى.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا يوجد.</p>
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
          <h3 className="mb-3 flex items-center gap-2 font-semibold"><TrendingUp className="size-5 text-warning" /> أعلى 10 موردين مستحقات</h3>
          {د.الموردون.الأعلى.length === 0 ? (
            <p className="text-sm text-muted-foreground">لا يوجد.</p>
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
