import { notFound } from "next/navigation";
import { PartyType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { بطاقة_مؤشر } from "@/components/kpi-card";
import { نص_مبلغ } from "@/components/money-text";
import { الشارة } from "@/components/ui/badge";
import { سطر_المساءلة } from "@/components/accountability-line";
import { سجل_التغييرات } from "@/components/record-history";
import { تسمية_حساب_الخزنة } from "@/lib/enums";
import { حركات_الطرف } from "./detail-client";

export async function تفاصيل_الطرف({
  المعرف,
  النوع,
}: {
  المعرف: number;
  النوع: PartyType;
}) {
  const طرف = await prisma.party.findUnique({
    where: { id: المعرف },
    include: {
      createdBy: { select: { name: true } },
      updatedBy: { select: { name: true } },
      ledgerEntries: {
        orderBy: [{ date: "asc" }, { id: "asc" }],
        select: {
          id: true,
          date: true,
          docNumber: true,
          description: true,
          category: true,
          qty: true,
          price: true,
          debit: true,
          credit: true,
          balanceAfter: true,
          invoiceId: true,
          treasuryTxnId: true,
        },
      },
    },
  });
  if (!طرف || طرف.type !== النوع) notFound();

  const [حسابات, إعداد_طرق] = await Promise.all([
    prisma.treasuryAccount.findMany({ orderBy: { id: "asc" } }),
    prisma.setting.findUnique({ where: { key: "طرق_الدفع" } }),
  ]);
  let طرق_الدفع: string[] = ["نقدي", "إنستا باي", "بنك", "فودافون كاش"];
  try {
    if (إعداد_طرق?.value) طرق_الدفع = JSON.parse(إعداد_طرق.value);
  } catch {}

  const عميل = النوع === PartyType.CUSTOMER;
  const Σمدين = طرف.ledgerEntries.reduce((س, ح) => س + Number(ح.debit), 0);
  const Σدائن = طرف.ledgerEntries.reduce((س, ح) => س + Number(ح.credit), 0);
  const إجمالي_التعاملات = عميل ? Σمدين : Σدائن; // فواتير/مشتريات
  const إجمالي_المدفوعات = عميل ? Σدائن : Σمدين;
  const الرصيد = Number(طرف.balance);

  const حركات = طرف.ledgerEntries.map((ح) => ({
    id: ح.id,
    التاريخ: ح.date.toISOString(),
    رقم_المستند: ح.docNumber,
    البيان: ح.description,
    التصنيف: ح.category,
    الكمية: ح.qty != null ? Number(ح.qty) : null,
    السعر: ح.price != null ? Number(ح.price) : null,
    مدين: Number(ح.debit),
    دائن: Number(ح.credit),
    الرصيد_بعد_الحركة: Number(ح.balanceAfter),
    مرتبط: ح.invoiceId != null || ح.treasuryTxnId != null,
  }));

  return (
    <div>
      <ترويسة_الصفحة
        العنوان={طرف.name}
        الوصف={عميل ? "كشف حساب العميل" : "كشف حساب المورد"}
        إجراء={<سجل_التغييرات النوع="الطرف" المعرف={طرف.id} />}
      />

      <div className="mb-4 card-soft p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span>
            الهاتف: <span className="ltr-nums">{طرف.phone || "—"}</span>
          </span>
          <span>العنوان: {طرف.address || "—"}</span>
          {طرف.creditLimit != null && (
            <span>
              حد الائتمان: <نص_مبلغ القيمة={طرف.creditLimit} />
            </span>
          )}
          <الشارة variant="navy">{عميل ? "عميل" : "مورد"}</الشارة>
        </div>
        {طرف.notes && <p className="mt-2 text-sm text-muted-foreground">{طرف.notes}</p>}
        <div className="mt-3 border-t border-border pt-3">
          <سطر_المساءلة
            أنشأ={طرف.createdBy?.name}
            تاريخ_الإنشاء={طرف.createdAt}
            عدّل={طرف.updatedBy?.name}
            تاريخ_التعديل={طرف.updatedById ? طرف.updatedAt : null}
          />
        </div>
      </div>

      <div className="mb-6 grid gap-4 sm:grid-cols-3">
        <بطاقة_مؤشر
          العنوان={عميل ? "إجمالي الفواتير" : "إجمالي المشتريات"}
          القيمة={<نص_مبلغ القيمة={إجمالي_التعاملات} />}
          لون="navy"
        />
        <بطاقة_مؤشر
          العنوان="إجمالي المدفوعات"
          القيمة={<نص_مبلغ القيمة={إجمالي_المدفوعات} />}
          لون="success"
        />
        <بطاقة_مؤشر
          العنوان={عميل ? "الرصيد الحالي (مديونية)" : "الرصيد الحالي (مستحق)"}
          القيمة={<نص_مبلغ القيمة={Math.abs(الرصيد)} />}
          لون={الرصيد > 0 ? "danger" : "success"}
          وصف={
            الرصيد > 0
              ? عميل
                ? "مدين لنا"
                : "مستحق للمورد"
              : الرصيد < 0
                ? "دفعة مقدمة"
                : "مسدّد بالكامل"
          }
        />
      </div>

      <h2 className="mb-3 text-lg font-semibold">حركات الحساب</h2>
      <حركات_الطرف
        الطرف={{ id: طرف.id, النوع: طرف.type }}
        الحركات={حركات}
        حسابات_الخزنة={حسابات.map((h) => ({
          id: h.id,
          التسمية: تسمية_حساب_الخزنة[h.type],
        }))}
        طرق_الدفع={طرق_الدفع}
      />
    </div>
  );
}
