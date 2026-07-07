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
import { مترجم_الخادم } from "@/lib/i18n/server";
import { حركات_الطرف } from "./detail-client";
import { اجلب_خريطة_حسابات_فرعية } from "@/app/(app)/treasury/sub-account-actions";
import { TreasuryAccountType } from "@prisma/client";

/** نقدي أولاً */
const ترتيب_الأنواع: Record<TreasuryAccountType, number> = {
  CASH: 0, VODAFONE: 1, INSTAPAY: 2, BANK: 3,
};

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
        where: { deletedAt: null },
        orderBy: [{ date: "desc" }, { id: "desc" }],
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
          treasuryTxn: { select: { accountId: true } },
        },
      },
    },
  });
  if (!طرف || طرف.type !== النوع) notFound();
  const { t } = مترجم_الخادم();

  const [حسابات_خام, حسابات_فرعية] = await Promise.all([
    prisma.treasuryAccount.findMany({ orderBy: { id: "asc" } }),
    اجلب_خريطة_حسابات_فرعية(),
  ]);
  const حسابات = [...حسابات_خام].sort(
    (a, b) => ترتيب_الأنواع[a.type] - ترتيب_الأنواع[b.type]
  );

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
    معرف_الفاتورة: ح.invoiceId,
    معرف_خزنة: ح.treasuryTxnId,
    معرف_حساب_خزنة: ح.treasuryTxn?.accountId ?? null,
    مرتبط: ح.invoiceId != null || ح.treasuryTxnId != null,
  }));

  return (
    <div>
      <ترويسة_الصفحة
        العنوان={طرف.name}
        الوصف={عميل ? t("party.d.statement_customer") : t("party.d.statement_supplier")}
        إجراء={<سجل_التغييرات النوع="الطرف" المعرف={طرف.id} />}
      />

      <div className="mb-4 card-soft p-4">
        <div className="flex flex-wrap items-center gap-x-6 gap-y-1 text-sm">
          <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5">
            <span className="text-muted-foreground">{t("party.col.phone")}:</span>
            {(() => {
              const أرقام = طرف.phones as { رقم: string; تسمية: string | null }[];
              if (Array.isArray(أرقام) && أرقام.length > 0) {
                return أرقام.map((ه, i) => (
                  <span key={i} className="ltr-nums">
                    {ه.رقم}
                    {ه.تسمية && <span className="text-muted-foreground mr-1 text-xs">({ه.تسمية})</span>}
                  </span>
                ));
              }
              return <span className="ltr-nums">{طرف.phone || "—"}</span>;
            })()}
          </span>
          <span>{t("party.f.address")}: {طرف.address || "—"}</span>
          {طرف.creditLimit != null && (
            <span>
              {t("party.f.credit_limit")}: <نص_مبلغ القيمة={طرف.creditLimit} />
            </span>
          )}
          <الشارة variant="navy">{عميل ? t("party.badge_customer") : t("party.badge_supplier")}</الشارة>
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
          العنوان={عميل ? t("party.d.total_invoices") : t("party.d.total_purchases")}
          القيمة={<نص_مبلغ القيمة={إجمالي_التعاملات} />}
          لون="navy"
        />
        <بطاقة_مؤشر
          العنوان={t("party.d.total_payments")}
          القيمة={<نص_مبلغ القيمة={إجمالي_المدفوعات} />}
          لون="success"
        />
        <بطاقة_مؤشر
          العنوان={عميل ? t("party.d.balance_debt") : t("party.d.balance_payable")}
          القيمة={<نص_مبلغ القيمة={Math.abs(الرصيد)} />}
          لون={الرصيد > 0 ? "danger" : "success"}
          وصف={
            الرصيد > 0
              ? عميل
                ? t("party.d.owes_us")
                : t("party.bal.payable")
              : الرصيد < 0
                ? t("party.bal.advance")
                : t("party.d.fully_settled")
          }
        />
      </div>

      <h2 className="mb-3 text-lg font-semibold">{t("party.d.ledger")}</h2>
      <حركات_الطرف
        الطرف={{ id: طرف.id, النوع: طرف.type }}
        الحركات={حركات}
        رصيد_ابتدائي={Number(طرف.openingBalance)}
        حسابات_الخزنة={حسابات.map((h) => ({
          id: h.id,
          النوع: h.type,
          التسمية: تسمية_حساب_الخزنة[h.type],
        }))}
        حسابات_فرعية={حسابات_فرعية}
      />
    </div>
  );
}
