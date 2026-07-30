import Link from "next/link";
import { Search } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { الزر } from "@/components/ui/button";
import { بطاقة_مؤشر } from "@/components/kpi-card";
import { نص_مبلغ } from "@/components/money-text";
import { تنبيهات_الشيكات, متأخر } from "@/lib/cheques";
import { مترجم_الخادم } from "@/lib/i18n/server";
import { شاشة_الشيكات } from "./client";
import { prisma as db } from "@/lib/prisma";

export const metadata = { title: "الشيكات — سُكر" };

export default async function صفحة_الشيكات() {
  const { t } = مترجم_الخادم();
  const [شيكات, تنبيهات, بنوك, أطراف, حسابات_الخزنة] = await Promise.all([
    prisma.cheque.findMany({
      orderBy: { dueDate: "asc" },
      select: {
        id: true, drawerName: true, amount: true, beneficiary: true,
        transferredFrom: true, bankName: true, dueDate: true, chequeNumber: true,
        direction: true, status: true, partyId: true, notes: true, imageMime: true,
      },
    }),
    تنبيهات_الشيكات(),
    db.subAccount.findMany({
      where: { type: "BANK", isActive: true },
      orderBy: { name: "asc" },
      select: { id: true, name: true },
    }),
    prisma.party.findMany({
      where: { archivedAt: null },
      orderBy: { name: "asc" },
      select: { id: true, name: true, type: true },
    }),
    prisma.treasuryAccount.findMany({ orderBy: { id: "asc" }, select: { id: true, type: true } }),
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
    الاتجاه: c.direction,
    الحالة: c.status,
    معرف_الطرف: c.partyId,
    ملاحظات: c.notes,
    لها_صورة: !!c.imageMime,
    متأخر: متأخر(c.dueDate, c.status),
  }));

  return (
    <div>
      <ترويسة_الصفحة
        العنوان={t("cheque.title")}
        الوصف={t("cheque.subtitle")}
        إجراء={
          <الزر variant="outline" asChild>
            <Link href="/cheques/query"><Search className="size-4" /> استعلام الشيكات</Link>
          </الزر>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <بطاقة_مؤشر العنوان={t("cheque.kpi.due7")} القيمة={تنبيهات.عدد_خلال_7} لون="warning" />
        <بطاقة_مؤشر العنوان={t("cheque.kpi.due_month")} القيمة={تنبيهات.عدد_هذا_الشهر} لون="navy" />
        <بطاقة_مؤشر العنوان={t("cheque.kpi.overdue")} القيمة={تنبيهات.عدد_متأخر} لون="danger" />
        <بطاقة_مؤشر العنوان={t("cheque.kpi.total_due")} القيمة={<نص_مبلغ القيمة={تنبيهات.إجمالي_المستحق} />} لون="navy" />
      </div>
      <شاشة_الشيكات
        البيانات={بيانات}
        بنوك={بنوك.map((b) => ({ id: b.id, الاسم: b.name }))}
        الأطراف={أطراف.map((p) => ({ id: p.id, الاسم: p.name, النوع: p.type }))}
        حساب_نقدي={حسابات_الخزنة.find((a) => a.type === "CASH")?.id ?? null}
        حساب_بنك={حسابات_الخزنة.find((a) => a.type === "BANK")?.id ?? null}
      />
    </div>
  );
}
