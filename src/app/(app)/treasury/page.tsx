import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { تسمية_حساب_الخزنة } from "@/lib/enums";
import { شاشة_الخزنة } from "./client";

export const metadata = { title: "الخزنة — سُكر" };

export default async function صفحة_الخزنة() {
  const [حسابات, حركات, أطراف, إعداد_طرق] = await Promise.all([
    prisma.treasuryAccount.findMany({ orderBy: { id: "asc" } }),
    prisma.treasuryTxn.findMany({
      orderBy: [{ date: "desc" }, { id: "desc" }],
      take: 500,
      include: {
        account: { select: { type: true } },
        party: { select: { name: true } },
      },
    }),
    prisma.party.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.setting.findUnique({ where: { key: "طرق_الدفع" } }),
  ]);

  let طرق_الدفع: string[] = ["نقدي", "إنستا باي", "بنك", "فودافون كاش"];
  try {
    if (إعداد_طرق?.value) طرق_الدفع = JSON.parse(إعداد_طرق.value);
  } catch {}

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
    الطرف: ح.party?.name ?? null,
    طريقة_الدفع: ح.method,
    الرصيد_بعد_الحركة: Number(ح.balanceAfter),
    مرتبط: ح.partyId != null,
  }));

  return (
    <div>
      <ترويسة_الصفحة العنوان="الخزنة" الوصف="الحسابات الأربعة وحركاتها — أرصدة حيّة" />
      <شاشة_الخزنة
        الحسابات={بيانات_الحسابات}
        الحركات={بيانات_الحركات}
        الأطراف={أطراف}
        طرق_الدفع={طرق_الدفع}
      />
    </div>
  );
}
