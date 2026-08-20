import Link from "next/link";
import { Search, BookOpen, BarChart3 } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { الزر } from "@/components/ui/button";
import { بطاقة_مؤشر } from "@/components/kpi-card";
import { نص_مبلغ } from "@/components/money-text";
import { تنبيهات_الشيكات, متأخر } from "@/lib/cheques";
import { اجلب_خيارات_الدفاتر } from "@/lib/cheque-books";
import { رصيد_خزنة_الشيكات } from "@/lib/cheques-accounting";
import { مترجم_الخادم } from "@/lib/i18n/server";
import { شاشة_الشيكات } from "./client";
import { prisma as db } from "@/lib/prisma";
import { تسمية_حساب_الخزنة } from "@/lib/enums";
import { اجلب_خريطة_حسابات_فرعية } from "@/app/(app)/treasury/sub-account-actions";

export const metadata = { title: "الشيكات — سُكر" };
export const dynamic = "force-dynamic"; // بيانات مالية حيّة — لا تُخزَّن مؤقتاً

export default async function صفحة_الشيكات() {
  const { t } = مترجم_الخادم();
  const [شيكات, تنبيهات, بنوك, أطراف, حسابات_الخزنة, حسابات_فرعية, دفاتر, رصيد_خزنة_الشيكات_قيمة] = await Promise.all([
    prisma.cheque.findMany({
      orderBy: { dueDate: "asc" },
      select: {
        id: true, drawerName: true, amount: true, beneficiary: true,
        transferredFrom: true, bankName: true, dueDate: true, chequeNumber: true,
        direction: true, status: true, partyId: true, notes: true, imageMime: true,
        chequeBookId: true, bookLeafNo: true, accountingVersion: true,
        endorsedToId: true, endorsedAt: true, isOpening: true,
        party: { select: { name: true } },
        endorsedTo: { select: { name: true } },
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
    اجلب_خريطة_حسابات_فرعية(),
    اجلب_خيارات_الدفاتر(),
    رصيد_خزنة_الشيكات(prisma),
  ]);
  const رصيد_الخزنة_للشيكات = Number(رصيد_خزنة_الشيكات_قيمة);

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
    اسم_الطرف: c.party?.name ?? null,
    معرف_المظهر_له: c.endorsedToId,
    اسم_المظهر_له: c.endorsedTo?.name ?? null,
    تاريخ_التظهير: c.endorsedAt?.toISOString() ?? null,
    معرف_الدفتر: c.chequeBookId,
    رقم_الورقة: c.bookLeafNo,
    نسخة: c.accountingVersion,
    افتتاحي: c.isOpening,
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
          <div className="flex flex-wrap gap-2">
            <الزر variant="outline" asChild>
              <Link href="/cheques/query"><Search className="size-4" /> استعلام الشيكات</Link>
            </الزر>
            <الزر variant="outline" asChild>
              <Link href="/cheques/reports"><BarChart3 className="size-4" /> تقارير الشيكات</Link>
            </الزر>
            <الزر variant="outline" asChild>
              <Link href="/cheques/books"><BookOpen className="size-4" /> الدفاتر والحافظات</Link>
            </الزر>
          </div>
        }
      />
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        <بطاقة_مؤشر
          العنوان="خزنة الشيكات"
          القيمة={<نص_مبلغ القيمة={رصيد_الخزنة_للشيكات} />}
          وصف="شيكات مسجّلة تحت اليد (منفصلة عن الخزنة)"
          لون="navy"
        />
        <بطاقة_مؤشر العنوان={t("cheque.kpi.due7")} القيمة={تنبيهات.عدد_خلال_7} لون="warning" />
        <بطاقة_مؤشر العنوان={t("cheque.kpi.due_month")} القيمة={تنبيهات.عدد_هذا_الشهر} لون="navy" />
        <بطاقة_مؤشر العنوان={t("cheque.kpi.overdue")} القيمة={تنبيهات.عدد_متأخر} لون="danger" />
        <بطاقة_مؤشر العنوان={t("cheque.kpi.total_due")} القيمة={<نص_مبلغ القيمة={تنبيهات.إجمالي_المستحق} />} لون="navy" />
      </div>
      <شاشة_الشيكات
        البيانات={بيانات}
        بنوك={بنوك.map((b) => ({ id: b.id, الاسم: b.name }))}
        الأطراف={أطراف.map((p) => ({ id: p.id, الاسم: p.name, النوع: p.type }))}
        دفاتر={دفاتر.map((d) => ({ id: d.id, الاسم: d.الاسم, الاتجاه: d.الاتجاه, اسم_البنك: d.اسم_البنك }))}
        حساب_نقدي={حسابات_الخزنة.find((a) => a.type === "CASH")?.id ?? null}
        حساب_بنك={حسابات_الخزنة.find((a) => a.type === "BANK")?.id ?? null}
        حسابات_الخزنة={حسابات_الخزنة.map((a) => ({ id: a.id, النوع: a.type, التسمية: تسمية_حساب_الخزنة[a.type] }))}
        حسابات_فرعية={حسابات_فرعية}
      />
    </div>
  );
}
