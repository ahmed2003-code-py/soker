import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { تسمية_حساب_الخزنة } from "@/lib/enums";
import { مترجم_الخادم } from "@/lib/i18n/server";
import { شاشة_الخزنة } from "./client";

export const metadata = { title: "الخزنة — سُكر" };

export default async function صفحة_الخزنة() {
  const { t } = مترجم_الخادم();
  const [حسابات, حركات, أطراف] = await Promise.all([
    prisma.treasuryAccount.findMany({ orderBy: { id: "asc" } }),
    prisma.treasuryTxn.findMany({
      orderBy: [{ date: "desc" }, { id: "desc" }],
      include: {
        account: { select: { type: true } },
        party: { select: { name: true } },
      },
    }),
    prisma.party.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const بيانات_الحسابات = حسابات.map((h) => ({
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
    مرتبط: ح.partyId != null,
  }));

  return (
    <div>
      <ترويسة_الصفحة العنوان={t("treasury.title")} الوصف={t("treasury.subtitle")} />
      <شاشة_الخزنة
        الحسابات={بيانات_الحسابات}
        الحركات={بيانات_الحركات}
        الأطراف={أطراف}
      />
    </div>
  );
}
