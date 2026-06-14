import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { بطاقة_مؤشر } from "@/components/kpi-card";
import { نص_مبلغ } from "@/components/money-text";
import { تنبيهات_الشيكات, متأخر } from "@/lib/cheques";
import { مترجم_الخادم } from "@/lib/i18n/server";
import { شاشة_الشيكات } from "./client";

export const metadata = { title: "الشيكات — سُكر" };

export default async function صفحة_الشيكات() {
  const { t } = مترجم_الخادم();
  const [شيكات, تنبيهات] = await Promise.all([
    prisma.cheque.findMany({
      orderBy: { dueDate: "asc" },
      select: {
        id: true, drawerName: true, amount: true, beneficiary: true,
        transferredFrom: true, bankName: true, dueDate: true, chequeNumber: true,
        status: true, notes: true, imageMime: true,
      },
    }),
    تنبيهات_الشيكات(),
  ]);

  const بيانات = شيكات.map((c) => ({
    id: c.id,
    اسم_المدين: c.drawerName,
    المبلغ: Number(c.amount),
    المستفيد: c.beneficiary,
    محول_من: c.transferredFrom,
    اسم_البنك: c.bankName,
    تاريخ_الاستحقاق: c.dueDate.toISOString(),
    رقم_الشيك: c.chequeNumber,
    الحالة: c.status,
    ملاحظات: c.notes,
    لها_صورة: !!c.imageMime,
    متأخر: متأخر(c.dueDate, c.status),
  }));

  return (
    <div>
      <ترويسة_الصفحة العنوان={t("cheque.title")} الوصف={t("cheque.subtitle")} />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <بطاقة_مؤشر العنوان={t("cheque.kpi.due7")} القيمة={تنبيهات.عدد_خلال_7} لون="warning" />
        <بطاقة_مؤشر العنوان={t("cheque.kpi.due_month")} القيمة={تنبيهات.عدد_هذا_الشهر} لون="navy" />
        <بطاقة_مؤشر العنوان={t("cheque.kpi.overdue")} القيمة={تنبيهات.عدد_متأخر} لون="danger" />
        <بطاقة_مؤشر العنوان={t("cheque.kpi.total_due")} القيمة={<نص_مبلغ القيمة={تنبيهات.إجمالي_المستحق} />} لون="navy" />
      </div>
      <شاشة_الشيكات البيانات={بيانات} />
    </div>
  );
}
