import Link from "next/link";
import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { الزر } from "@/components/ui/button";
import { Plus } from "lucide-react";
import { مترجم_الخادم } from "@/lib/i18n/server";
import { قائمة_الفواتير } from "./list-client";
import { د, طرح } from "@/lib/decimal";
import { فاتورة_زائر, حالة_دفع_الزائر } from "@/lib/invoice";

export const metadata = { title: "الفواتير — سُكر" };

export default async function صفحة_الفواتير() {
  const { t } = مترجم_الخادم();
  const فواتير = await prisma.invoice.findMany({
    orderBy: { id: "desc" },
    select: {
      id: true,
      number: true,
      externalRef: true,
      invoiceType: true,
      unpriced: true,
      directInvoiceId: true,
      customerId: true,
      customer: { select: { name: true } },
      guestName: true,
      date: true,
      totalAmount: true,
      totalWeight: true,
    },
  });
  // فواتير الزوار: المحصّل من حركات الخزنة (استعلام تجميعي واحد) ⇒ حالة الدفع والمتبقي
  // (فلتر بالعلاقة بدل IN بكل المعرفات — لا حد لعدد المعاملات مهما كثرت الفواتير)
  const مجاميع = فواتير.some((f) => فاتورة_زائر(f))
    ? await prisma.treasuryTxn.groupBy({
        by: ["invoiceId", "kind"],
        where: {
          deletedAt: null,
          invoice: { is: { customerId: null, invoiceType: "SALE", directInvoiceId: null } },
        },
        _sum: { amount: true },
      })
    : [];
  const المحصّل = new Map<number, ReturnType<typeof د>>();
  for (const م of مجاميع) {
    if (م.invoiceId == null || م.kind === "TRANSFER") continue;
    const مبلغ = د(م._sum.amount ?? 0);
    const سابق = المحصّل.get(م.invoiceId) ?? د(0);
    المحصّل.set(م.invoiceId, م.kind === "INCOME" ? سابق.plus(مبلغ) : سابق.minus(مبلغ));
  }

  const بيانات = فواتير.map((f) => ({
    id: f.id,
    الرقم: f.number,
    المرجع: f.externalRef,
    النوع: f.invoiceType as "SALE" | "PURCHASE" | "SUPPLIER_RETURN",
    غير_مسعّرة: f.unpriced,
    مباشرة: !!f.directInvoiceId,
    الطرف: f.customer?.name ?? f.guestName ?? "عميل نقدي",
    التاريخ: f.date.toISOString(),
    الإجمالي: Number(f.totalAmount),
    إجمالي_الوزن: Number(f.totalWeight),
    ...(فاتورة_زائر(f)
      ? (() => {
          const محصّل = المحصّل.get(f.id) ?? د(0);
          const حالة = حالة_دفع_الزائر(f.totalAmount, محصّل);
          return حالة === "مدفوعة" ? {} : { معلّقة: true, المتبقي: Number(طرح(f.totalAmount, محصّل)) };
        })()
      : {}),
  }));

  return (
    <div>
      <ترويسة_الصفحة
        العنوان={t("inv.title")}
        الوصف={t("inv.subtitle")}
        إجراء={
          <الزر asChild>
            <Link href="/invoices/new">
              <Plus className="size-4" /> {t("inv.new")}
            </Link>
          </الزر>
        }
      />
      <قائمة_الفواتير البيانات={بيانات} />
    </div>
  );
}
