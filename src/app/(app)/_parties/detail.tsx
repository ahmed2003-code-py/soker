import Link from "next/link";
import { notFound } from "next/navigation";
import { PartyType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { بطاقة_مؤشر } from "@/components/kpi-card";
import { نص_مبلغ } from "@/components/money-text";
import { الشارة } from "@/components/ui/badge";
import { سطر_المساءلة } from "@/components/accountability-line";
import { سجل_التغييرات } from "@/components/record-history";
import { زر_تحويل_مؤقت } from "./convert-temp";
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
          directPaymentId: true,
          splitPaymentId: true,
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
  // فواتير غير مسعّرة لهذا العميل (بلا أثر مالي بعد — بانتظار التسعير)
  const فواتير_غير_مسعّرة = عميل
    ? await prisma.invoice.findMany({
        where: { customerId: المعرف, unpriced: true },
        orderBy: { date: "desc" },
        select: { id: true, number: true, date: true, totalWeight: true, totalQty: true },
      })
    : [];
  const Σمدين = طرف.ledgerEntries.reduce((س, ح) => س + Number(ح.debit), 0);
  const Σدائن = طرف.ledgerEntries.reduce((س, ح) => س + Number(ح.credit), 0);
  const إجمالي_التعاملات = عميل ? Σمدين : Σدائن; // فواتير/مشتريات
  const إجمالي_المدفوعات = عميل ? Σدائن : Σمدين;
  const الرصيد = Number(طرف.balance);

  // خريطة الشيكات المرتبطة بقيود هذا الطرف (تظهير على المورد / استلام على العميل) — لتجميع صفوفها وعرض تفاصيلها
  const معرفات_القيود = طرف.ledgerEntries.map((ح) => ح.id);
  const شيكات_مرتبطة = معرفات_القيود.length
    ? await prisma.cheque.findMany({
        where: { OR: [{ endorseLedgerEntryId: { in: معرفات_القيود } }, { partyLedgerEntryId: { in: معرفات_القيود } }] },
        select: {
          id: true, amount: true, chequeNumber: true, dueDate: true, drawerName: true,
          transferredFrom: true, bankName: true, isOpening: true, status: true, direction: true,
          endorseBatchId: true, receiptBatchId: true, endorseLedgerEntryId: true, partyLedgerEntryId: true,
        },
      })
    : [];
  const خريطة_شيك_للقيد = new Map<number, any>();
  for (const c of شيكات_مرتبطة) {
    const أساس = {
      id: c.id,
      المبلغ: Number(c.amount),
      رقم_الشيك: c.chequeNumber,
      تاريخ_الاستحقاق: c.dueDate.toISOString(),
      اسم_المدين: c.drawerName,
      محول_من: c.transferredFrom,
      اسم_البنك: c.bankName,
      افتتاحي: c.isOpening,
      الحالة: c.status,
    };
    // جهة التظهير (المورد): معرّف معاملة التظهير يُميّز الشيكات المُظهَّرة سوياً
    if (c.endorseLedgerEntryId != null) خريطة_شيك_للقيد.set(c.endorseLedgerEntryId, { ...أساس, معرف_معاملة: c.endorseBatchId ?? null });
    // جهة الاستلام (العميل): معرّف معاملة الاستلام يُميّز الشيكات المستلَمة سوياً
    if (c.partyLedgerEntryId != null && !خريطة_شيك_للقيد.has(c.partyLedgerEntryId)) خريطة_شيك_للقيد.set(c.partyLedgerEntryId, { ...أساس, معرف_معاملة: c.receiptBatchId ?? null });
  }

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
    معرف_دفع_مباشر: ح.directPaymentId,
    معرف_دفعة_موزعة: ح.splitPaymentId,
    شيك_مرتبط: خريطة_شيك_للقيد.get(ح.id) ?? null,
    مرتبط: ح.invoiceId != null || ح.treasuryTxnId != null || ح.directPaymentId != null || ح.splitPaymentId != null,
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
          {طرف.isTemporary && <الشارة variant="warning">حساب مؤقت</الشارة>}
        </div>
        {طرف.isTemporary && عميل && (
          <div className="mt-3">
            <زر_تحويل_مؤقت
              المعرف={طرف.id}
              الاسم_الحالي={طرف.name}
              الهاتف_الحالي={طرف.phone}
              العنوان_الحالي={طرف.address}
              ملاحظات_حالية={طرف.notes}
            />
          </div>
        )}
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

      {فواتير_غير_مسعّرة.length > 0 && (
        <div className="mb-6 rounded-xl border border-amber-300 bg-amber-50 p-4">
          <h2 className="mb-3 text-base font-semibold text-amber-900">
            فواتير غير مسعّرة (بانتظار التسعير) — {فواتير_غير_مسعّرة.length}
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-amber-800/80">
                <tr className="text-start">
                  <th className="px-2 py-1.5 text-start font-medium">رقم الفاتورة</th>
                  <th className="px-2 py-1.5 text-start font-medium">التاريخ</th>
                  <th className="px-2 py-1.5 text-end font-medium">الكمية</th>
                  <th className="px-2 py-1.5 text-end font-medium">الوزن (كجم)</th>
                  <th className="px-2 py-1.5 text-end font-medium">إجراء</th>
                </tr>
              </thead>
              <tbody>
                {فواتير_غير_مسعّرة.map((ف) => (
                  <tr key={ف.id} className="border-t border-amber-200">
                    <td className="px-2 py-1.5 ltr-nums">
                      <Link href={`/invoices/${ف.id}`} className="font-medium text-primary-blue hover:underline">
                        {ف.number ? String(ف.number).padStart(7, "0") : "—"}
                      </Link>
                    </td>
                    <td className="px-2 py-1.5 ltr-nums">
                      {new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(ف.date)}
                    </td>
                    <td className="px-2 py-1.5 text-end ltr-nums">{Number(ف.totalQty)}</td>
                    <td className="px-2 py-1.5 text-end ltr-nums">{Number(ف.totalWeight)}</td>
                    <td className="px-2 py-1.5 text-end">
                      <Link href={`/invoices/${ف.id}/edit`} className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-medium text-white hover:bg-amber-700">
                        سعّر الآن
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <p className="mt-2 text-[12px] text-amber-800">هذه الفواتير محفوظة على حساب العميل بلا أثر مالي حتى تُسعَّر.</p>
        </div>
      )}

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
