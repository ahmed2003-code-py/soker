import { prisma } from "@/lib/prisma";
import { TxnKind } from "@prisma/client";
import { اليوم, بداية_الشهر, نهاية_الشهر, مفتاح_الشهر, اسم_الشهر } from "@/lib/date";
import { تنبيهات_الشيكات } from "@/lib/cheques";
import { تسمية_حساب_الخزنة } from "@/lib/enums";

/** بيانات لوحة التحكم — كلها من قاعدة البيانات الحيّة. */
export async function بيانات_اللوحة() {
  const الآن = اليوم();
  const بداية_اليوم = الآن;
  const نهاية_اليوم = new Date(الآن.getFullYear(), الآن.getMonth(), الآن.getDate(), 23, 59, 59);
  const بداية_شهر = بداية_الشهر(الآن);
  const نهاية_شهر = نهاية_الشهر(الآن);
  const قبل_12 = new Date(الآن.getFullYear(), الآن.getMonth() - 11, 1);

  const [
    حسابات,
    عملاء_مدينون,
    موردون_دائنون,
    فواتير_اليوم,
    فواتير_الشهر,
    تنبيهات,
    فواتير_12,
    حركات_12,
    عملاء_تجاوزوا,
  ] = await Promise.all([
    prisma.treasuryAccount.findMany({ orderBy: { id: "asc" } }),
    prisma.party.findMany({
      where: { type: "CUSTOMER", balance: { gt: 0 } },
      orderBy: { balance: "desc" },
    }),
    prisma.party.findMany({
      where: { type: "SUPPLIER", balance: { gt: 0 } },
      orderBy: { balance: "desc" },
    }),
    prisma.invoice.aggregate({
      where: { date: { gte: بداية_اليوم, lte: نهاية_اليوم } },
      _count: true,
      _sum: { totalAmount: true },
    }),
    prisma.invoice.aggregate({
      where: { date: { gte: بداية_شهر, lte: نهاية_شهر } },
      _count: true,
      _sum: { totalAmount: true },
    }),
    تنبيهات_الشيكات(),
    prisma.invoice.findMany({
      where: { date: { gte: قبل_12 } },
      select: { date: true, totalAmount: true },
    }),
    prisma.treasuryTxn.findMany({
      where: { date: { gte: قبل_12 } },
      select: { date: true, kind: true, amount: true },
    }),
    prisma.party.findMany({
      where: { type: "CUSTOMER", creditLimit: { not: null } },
      select: { id: true, name: true, balance: true, creditLimit: true },
    }),
  ]);

  const إجمالي_الخزنة = حسابات.reduce((س, h) => س + Number(h.balance), 0);
  const إجمالي_مديونية = عملاء_مدينون.reduce((س, p) => س + Number(p.balance), 0);
  const إجمالي_مستحقات = موردون_دائنون.reduce((س, p) => س + Number(p.balance), 0);

  // سلاسل 12 شهراً
  const أشهر: string[] = [];
  for (let i = 0; i < 12; i++) {
    const d = new Date(الآن.getFullYear(), الآن.getMonth() - 11 + i, 1);
    أشهر.push(مفتاح_الشهر(d));
  }
  const صفر = () => Object.fromEntries(أشهر.map((m) => [m, 0])) as Record<string, number>;
  const مبيعات = صفر();
  const تحصيلات = صفر();
  const مصروفات = صفر();
  for (const f of فواتير_12) {
    const k = مفتاح_الشهر(f.date);
    if (k in مبيعات) مبيعات[k] += Number(f.totalAmount);
  }
  for (const t of حركات_12) {
    const k = مفتاح_الشهر(t.date);
    if (t.kind === TxnKind.INCOME && k in تحصيلات) تحصيلات[k] += Number(t.amount);
    if (t.kind === TxnKind.EXPENSE && k in مصروفات) مصروفات[k] += Number(t.amount);
  }
  const سلسلة = أشهر.map((m) => ({
    الشهر: اسم_الشهر(m + "-01"),
    مبيعات: مبيعات[m],
    تحصيلات: تحصيلات[m],
    مصروفات: مصروفات[m],
  }));

  const تجاوزوا = عملاء_تجاوزوا
    .filter((p) => p.creditLimit != null && Number(p.balance) > Number(p.creditLimit))
    .map((p) => ({ id: p.id, name: p.name, balance: Number(p.balance), limit: Number(p.creditLimit) }));

  return {
    الخزنة: {
      حسابات: حسابات.map((h) => ({
        التسمية: تسمية_حساب_الخزنة[h.type],
        الرصيد: Number(h.balance),
        تحت_الحد: h.minThreshold != null && Number(h.balance) < Number(h.minThreshold),
      })),
      الإجمالي: إجمالي_الخزنة,
    },
    العملاء: {
      إجمالي_المديونية: إجمالي_مديونية,
      عدد: عملاء_مدينون.length,
      الأعلى: عملاء_مدينون.slice(0, 10).map((p) => ({ id: p.id, الاسم: p.name, الرصيد: Number(p.balance) })),
    },
    الموردون: {
      إجمالي_المستحقات: إجمالي_مستحقات,
      عدد: موردون_دائنون.length,
      الأعلى: موردون_دائنون.slice(0, 10).map((p) => ({ id: p.id, الاسم: p.name, الرصيد: Number(p.balance) })),
    },
    الفواتير: {
      عدد_اليوم: فواتير_اليوم._count,
      مبيعات_اليوم: Number(فواتير_اليوم._sum.totalAmount ?? 0),
      عدد_الشهر: فواتير_الشهر._count,
      مبيعات_الشهر: Number(فواتير_الشهر._sum.totalAmount ?? 0),
    },
    الشيكات: تنبيهات,
    السلسلة: سلسلة,
    تنبيهات_الائتمان: تجاوزوا,
  };
}
