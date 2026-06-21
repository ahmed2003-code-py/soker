import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { تسمية_حساب_الخزنة } from "@/lib/enums";
import { مترجم_الخادم } from "@/lib/i18n/server";
import { شاشة_الخزنة } from "./client";
import { اجلب_خريطة_حسابات_فرعية } from "./sub-account-actions";
import { TreasuryAccountType } from "@prisma/client";

export const metadata = { title: "الخزنة — سُكر" };

/** نقدي أولاً، ثم فودافون، إنستا، بنك */
const ترتيب_الأنواع: Record<TreasuryAccountType, number> = {
  CASH: 0, VODAFONE: 1, INSTAPAY: 2, BANK: 3,
};

export default async function صفحة_الخزنة() {
  const { t } = مترجم_الخادم();
  const [حسابات, حركات, أطراف, حسابات_فرعية] = await Promise.all([
    prisma.treasuryAccount.findMany({ orderBy: { id: "asc" } }),
    prisma.treasuryTxn.findMany({
      where: { deletedAt: null },
      orderBy: [{ date: "desc" }, { id: "desc" }],
      include: {
        account: { select: { type: true } },
        party: { select: { name: true } },
        subAccount: { select: { name: true } },
        createdBy: { select: { name: true } },
      },
    }),
    prisma.party.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    اجلب_خريطة_حسابات_فرعية(),
  ]);

  const بيانات_الحسابات = [...حسابات]
    .sort((a, b) => ترتيب_الأنواع[a.type] - ترتيب_الأنواع[b.type])
    .map((h) => ({
      id: h.id,
      النوع: h.type,
      التسمية: تسمية_حساب_الخزنة[h.type],
      الرصيد: Number(h.balance),
      الحد_الأدنى: h.minThreshold != null ? Number(h.minThreshold) : null,
    }));

  const بيانات_الحركات = حركات.map((ح) => ({
    id: ح.id,
    التاريخ: ح.date.toISOString(),
    النوع: ح.kind,
    المبلغ: Number(ح.amount),
    معرف_الحساب: ح.accountId,
    الحساب: تسمية_حساب_الخزنة[ح.account.type],
    البيان: ح.description,
    الطرف: ح.party?.name ?? ح.externalPartyName ?? null,
    الرصيد_بعد_الحركة: Number(ح.balanceAfter),
    معرف_حساب_فرعي: ح.subAccountId ?? null,
    اسم_حساب_فرعي: ح.subAccount?.name ?? null,
    معرف_الطرف: ح.partyId ?? null,
    مرتبط: ح.partyId != null,
    أنشأ_بواسطة: ح.createdBy.name,
  }));

  return (
    <div>
      <ترويسة_الصفحة العنوان={t("treasury.title")} الوصف={t("treasury.subtitle")} />
      <شاشة_الخزنة
        الحسابات={بيانات_الحسابات}
        الحركات={بيانات_الحركات}
        الأطراف={أطراف}
        حسابات_فرعية={حسابات_فرعية}
      />
    </div>
  );
}
