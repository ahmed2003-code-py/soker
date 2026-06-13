import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import {
  تقرير_كشف_حساب,
  تقرير_خزنة_حركات,
  تقرير_أرصدة_الخزنة,
  تقرير_فواتير_يومية,
  تقرير_فواتير_شهرية,
  تقرير_فواتير_حسب_العميل,
  تقرير_شيكات_مستحقة,
  تقرير_شيكات_متأخرة,
  تقرير_شيكات_شهرية,
  type نوع_تقرير,
  type فلاتر,
} from "@/lib/reports";
import { شاشة_التقارير } from "./client";
import { TxnKind } from "@prisma/client";
import { تسمية_حساب_الخزنة } from "@/lib/enums";

export const metadata = { title: "التقارير — سُكر" };
export const dynamic = "force-dynamic";

type المعاملات = {
  نوع?: string;
  من?: string;
  إلى?: string;
  طرف?: string;
  حساب?: string;
};

function تحويل_تاريخ(نص?: string): Date | undefined {
  if (!نص) return undefined;
  const د = new Date(نص);
  return isNaN(د.getTime()) ? undefined : د;
}

export default async function صفحة_التقارير({
  searchParams,
}: {
  searchParams: المعاملات;
}) {
  const النوع = (searchParams.نوع ?? "") as نوع_تقرير | "";
  const ف: فلاتر = {
    من: تحويل_تاريخ(searchParams.من),
    إلى: تحويل_تاريخ(searchParams.إلى),
    معرف_الطرف: searchParams.طرف ? Number(searchParams.طرف) : undefined,
    معرف_الحساب: searchParams.حساب ? Number(searchParams.حساب) : undefined,
  };

  // قوائم الفلاتر
  const [عملاء, موردون, حسابات] = await Promise.all([
    prisma.party.findMany({
      where: { type: "CUSTOMER" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.party.findMany({
      where: { type: "SUPPLIER" },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    prisma.treasuryAccount.findMany({ orderBy: { id: "asc" } }),
  ]);

  // تنفيذ التقرير المطلوب
  let بيانات_التقرير: unknown = null;
  if (النوع === "كشف_عميل" || النوع === "كشف_مورد") {
    if (ف.معرف_الطرف) بيانات_التقرير = await تقرير_كشف_حساب(ف.معرف_الطرف, ف.من, ف.إلى);
  } else if (النوع === "خزنة_إيرادات") {
    بيانات_التقرير = await تقرير_خزنة_حركات(TxnKind.INCOME, ف);
  } else if (النوع === "خزنة_مصروفات") {
    بيانات_التقرير = await تقرير_خزنة_حركات(TxnKind.EXPENSE, ف);
  } else if (النوع === "أرصدة_الخزنة") {
    بيانات_التقرير = await تقرير_أرصدة_الخزنة();
  } else if (النوع === "فواتير_يومية") {
    بيانات_التقرير = await تقرير_فواتير_يومية(ف);
  } else if (النوع === "فواتير_شهرية") {
    بيانات_التقرير = await تقرير_فواتير_شهرية(ف);
  } else if (النوع === "فواتير_حسب_العميل") {
    بيانات_التقرير = await تقرير_فواتير_حسب_العميل(ف);
  } else if (النوع === "شيكات_مستحقة") {
    بيانات_التقرير = await تقرير_شيكات_مستحقة(ف);
  } else if (النوع === "شيكات_متأخرة") {
    بيانات_التقرير = await تقرير_شيكات_متأخرة();
  } else if (النوع === "شيكات_شهرية") {
    بيانات_التقرير = await تقرير_شيكات_شهرية(ف);
  }

  return (
    <div>
      <ترويسة_الصفحة
        العنوان="التقارير"
        الوصف="مركز التقارير — تصفية، طباعة، تصدير PDF/Excel"
      />
      <شاشة_التقارير
        النوع={النوع}
        القيم={{
          من: searchParams.من ?? "",
          إلى: searchParams.إلى ?? "",
          طرف: searchParams.طرف ?? "",
          حساب: searchParams.حساب ?? "",
        }}
        العملاء={عملاء}
        الموردون={موردون}
        حسابات_الخزنة={حسابات.map((h) => ({
          id: h.id,
          التسمية: تسمية_حساب_الخزنة[h.type],
        }))}
        البيانات={بيانات_التقرير}
      />
    </div>
  );
}
