import { prisma } from "@/lib/prisma";
import { ChequeStatus, TxnKind, type Prisma } from "@prisma/client";
import { اليوم, مفتاح_الشهر, اسم_الشهر } from "@/lib/date";
import { تسمية_حساب_الخزنة } from "@/lib/enums";
import { متأخر } from "@/lib/cheques";

/** أنواع التقارير المدعومة */
export type نوع_تقرير =
  | "كشف_عميل"
  | "كشف_مورد"
  | "خزنة_إيرادات"
  | "خزنة_مصروفات"
  | "أرصدة_الخزنة"
  | "فواتير_يومية"
  | "فواتير_شهرية"
  | "فواتير_حسب_العميل"
  | "شيكات_مستحقة"
  | "شيكات_متأخرة"
  | "شيكات_شهرية";

export const قائمة_التقارير: { القيمة: نوع_تقرير; التسمية: string; المجموعة: string }[] = [
  { القيمة: "كشف_عميل", التسمية: "كشف حساب عميل", المجموعة: "العملاء" },
  { القيمة: "كشف_مورد", التسمية: "كشف حساب مورد", المجموعة: "الموردون" },
  { القيمة: "خزنة_إيرادات", التسمية: "الخزنة — الإيرادات", المجموعة: "الخزنة" },
  { القيمة: "خزنة_مصروفات", التسمية: "الخزنة — المصروفات", المجموعة: "الخزنة" },
  { القيمة: "أرصدة_الخزنة", التسمية: "أرصدة الخزنة", المجموعة: "الخزنة" },
  { القيمة: "فواتير_يومية", التسمية: "الفواتير اليومية", المجموعة: "الفواتير" },
  { القيمة: "فواتير_شهرية", التسمية: "الفواتير الشهرية", المجموعة: "الفواتير" },
  { القيمة: "فواتير_حسب_العميل", التسمية: "الفواتير حسب العميل", المجموعة: "الفواتير" },
  { القيمة: "شيكات_مستحقة", التسمية: "الشيكات المستحقة", المجموعة: "الشيكات" },
  { القيمة: "شيكات_متأخرة", التسمية: "الشيكات المتأخرة", المجموعة: "الشيكات" },
  { القيمة: "شيكات_شهرية", التسمية: "الشيكات حسب الشهر", المجموعة: "الشيكات" },
];

export type فلاتر = {
  من?: Date;
  إلى?: Date;
  معرف_الطرف?: number;
  معرف_الحساب?: number;
};

function نطاق_تاريخ(من?: Date, إلى?: Date): Prisma.DateTimeFilter | undefined {
  if (!من && !إلى) return undefined;
  const ف: Prisma.DateTimeFilter = {};
  if (من) ف.gte = من;
  if (إلى) {
    const ن = new Date(إلى);
    ن.setHours(23, 59, 59, 999);
    ف.lte = ن;
  }
  return ف;
}

// ============================================================
// كشف حساب طرف (عميل/مورد)
// ============================================================
export async function تقرير_كشف_حساب(معرف_الطرف: number, من?: Date, إلى?: Date) {
  const طرف = await prisma.party.findUnique({ where: { id: معرف_الطرف } });
  if (!طرف) return null;

  const نطاق = نطاق_تاريخ(من, إلى);
  const حركات = await prisma.ledgerEntry.findMany({
    where: { partyId: معرف_الطرف, ...(نطاق ? { date: نطاق } : {}) },
    orderBy: [{ date: "asc" }, { id: "asc" }],
  });
  // نحسب الرصيد تصاعدياً ثم نعكس للعرض (الأحدث أولاً)

  // الرصيد الافتتاحي = حاصل ما قبل تاريخ "من"
  let رصيد_افتتاحي = 0;
  if (من) {
    const قبل = await prisma.ledgerEntry.aggregate({
      where: { partyId: معرف_الطرف, date: { lt: من } },
      _sum: { debit: true, credit: true },
    });
    const م = Number(قبل._sum.debit ?? 0);
    const د = Number(قبل._sum.credit ?? 0);
    رصيد_افتتاحي = طرف.type === "CUSTOMER" ? م - د : د - م;
  }

  let رصيد = رصيد_افتتاحي;
  const الصفوف = حركات.map((h) => {
    const م = Number(h.debit);
    const د = Number(h.credit);
    if (طرف.type === "CUSTOMER") رصيد += م - د;
    else رصيد += د - م;
    return {
      التاريخ: h.date.toISOString(),
      رقم_المستند: h.docNumber ?? "",
      البيان: h.description,
      التصنيف: h.category ?? "",
      مدين: م,
      دائن: د,
      الرصيد: رصيد,
    };
  });

  const مجموع_مدين = الصفوف.reduce((س, r) => س + r.مدين, 0);
  const مجموع_دائن = الصفوف.reduce((س, r) => س + r.دائن, 0);

  return {
    الطرف: { id: طرف.id, الاسم: طرف.name, النوع: طرف.type, الهاتف: طرف.phone ?? "" },
    رصيد_افتتاحي,
    الصفوف: [...الصفوف].reverse(),
    مجموع_مدين,
    مجموع_دائن,
    الرصيد_الختامي: رصيد,
    إجمالي_الفواتير: طرف.type === "CUSTOMER" ? مجموع_مدين : مجموع_دائن,
    إجمالي_المدفوعات: طرف.type === "CUSTOMER" ? مجموع_دائن : مجموع_مدين,
  };
}

// ============================================================
// الخزنة: حركات بنوع معيّن
// ============================================================
export async function تقرير_خزنة_حركات(النوع: TxnKind, ف: فلاتر) {
  const نطاق = نطاق_تاريخ(ف.من, ف.إلى);
  const حركات = await prisma.treasuryTxn.findMany({
    where: {
      kind: النوع,
      ...(نطاق ? { date: نطاق } : {}),
      ...(ف.معرف_الحساب ? { accountId: ف.معرف_الحساب } : {}),
    },
    include: { account: true, party: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { id: "desc" }],
  });

  const الصفوف = حركات.map((t) => ({
    التاريخ: t.date.toISOString(),
    الحساب: تسمية_حساب_الخزنة[t.account.type],
    البيان: t.description,
    الطرف: t.party?.name ?? "",
    طريقة_الدفع: t.method ?? "",
    المبلغ: Number(t.amount),
  }));
  const الإجمالي = الصفوف.reduce((س, r) => س + r.المبلغ, 0);

  return { الصفوف, الإجمالي };
}

// ============================================================
// الخزنة: أرصدة الحسابات
// ============================================================
export async function تقرير_أرصدة_الخزنة() {
  const حسابات = await prisma.treasuryAccount.findMany({ orderBy: { id: "asc" } });
  const الصفوف = حسابات.map((h) => ({
    الحساب: تسمية_حساب_الخزنة[h.type],
    الرصيد: Number(h.balance),
    الحد_الأدنى: h.minThreshold != null ? Number(h.minThreshold) : 0,
    تحت_الحد: h.minThreshold != null && Number(h.balance) < Number(h.minThreshold),
  }));
  const الإجمالي = الصفوف.reduce((س, r) => س + r.الرصيد, 0);
  return { الصفوف, الإجمالي };
}

// ============================================================
// الفواتير: يومية
// ============================================================
export async function تقرير_فواتير_يومية(ف: فلاتر) {
  const نطاق = نطاق_تاريخ(ف.من, ف.إلى);
  const فواتير = await prisma.invoice.findMany({
    where: {
      ...(نطاق ? { date: نطاق } : {}),
      ...(ف.معرف_الطرف ? { customerId: ف.معرف_الطرف } : {}),
    },
    include: { customer: { select: { name: true } } },
    orderBy: [{ date: "desc" }, { number: "desc" }],
  });

  const الصفوف = فواتير.map((f) => ({
    التاريخ: f.date.toISOString(),
    الرقم: f.number,
    العميل: f.customer.name,
    إجمالي_الكمية: Number(f.totalQty),
    إجمالي_الوزن: Number(f.totalWeight),
    الإجمالي: Number(f.totalAmount),
  }));
  const الإجمالي_العام = الصفوف.reduce((س, r) => س + r.الإجمالي, 0);
  return { الصفوف, الإجمالي_العام };
}

// ============================================================
// الفواتير: شهرية
// ============================================================
export async function تقرير_فواتير_شهرية(ف: فلاتر) {
  const نطاق = نطاق_تاريخ(ف.من, ف.إلى);
  const فواتير = await prisma.invoice.findMany({
    where: {
      ...(نطاق ? { date: نطاق } : {}),
      ...(ف.معرف_الطرف ? { customerId: ف.معرف_الطرف } : {}),
    },
    select: { date: true, totalAmount: true },
  });

  const م = new Map<string, { الاسم: string; عدد: number; الإجمالي: number }>();
  for (const f of فواتير) {
    const k = مفتاح_الشهر(f.date);
    const ح = م.get(k) ?? { الاسم: اسم_الشهر(f.date), عدد: 0, الإجمالي: 0 };
    ح.عدد += 1;
    ح.الإجمالي += Number(f.totalAmount);
    م.set(k, ح);
  }
  const الصفوف = [...م.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([_, v]) => ({ الشهر: v.الاسم, عدد: v.عدد, الإجمالي: v.الإجمالي }));
  const الإجمالي_العام = الصفوف.reduce((س, r) => س + r.الإجمالي, 0);
  return { الصفوف, الإجمالي_العام };
}

// ============================================================
// الفواتير: حسب العميل
// ============================================================
export async function تقرير_فواتير_حسب_العميل(ف: فلاتر) {
  const نطاق = نطاق_تاريخ(ف.من, ف.إلى);
  const فواتير = await prisma.invoice.findMany({
    where: { ...(نطاق ? { date: نطاق } : {}) },
    select: {
      customerId: true,
      customer: { select: { name: true } },
      totalAmount: true,
    },
  });

  const م = new Map<number, { العميل: string; عدد: number; الإجمالي: number }>();
  for (const f of فواتير) {
    const ح = م.get(f.customerId) ?? { العميل: f.customer.name, عدد: 0, الإجمالي: 0 };
    ح.عدد += 1;
    ح.الإجمالي += Number(f.totalAmount);
    م.set(f.customerId, ح);
  }
  const الصفوف = [...م.values()].sort((a, b) => b.الإجمالي - a.الإجمالي);
  const الإجمالي_العام = الصفوف.reduce((س, r) => س + r.الإجمالي, 0);
  return { الصفوف, الإجمالي_العام };
}

// ============================================================
// الشيكات: المستحقة (PENDING) ضمن نطاق
// ============================================================
export async function تقرير_شيكات_مستحقة(ف: فلاتر) {
  const نطاق = نطاق_تاريخ(ف.من, ف.إلى);
  const شيكات = await prisma.cheque.findMany({
    where: {
      status: ChequeStatus.PENDING,
      ...(نطاق ? { dueDate: نطاق } : {}),
    },
    orderBy: { dueDate: "desc" },
  });

  const الصفوف = شيكات.map((c) => ({
    تاريخ_الاستحقاق: c.dueDate.toISOString(),
    اسم_المدين: c.drawerName,
    المستفيد: c.beneficiary ?? "",
    اسم_البنك: c.bankName ?? "",
    رقم_الشيك: c.chequeNumber ?? "",
    المبلغ: Number(c.amount),
    متأخر: متأخر(c.dueDate, c.status),
  }));
  const الإجمالي = الصفوف.reduce((س, r) => س + r.المبلغ, 0);
  return { الصفوف, الإجمالي };
}

// ============================================================
// الشيكات: المتأخرة فقط
// ============================================================
export async function تقرير_شيكات_متأخرة() {
  const الآن = اليوم();
  const شيكات = await prisma.cheque.findMany({
    where: { status: ChequeStatus.PENDING, dueDate: { lt: الآن } },
    orderBy: { dueDate: "desc" },
  });

  const الصفوف = شيكات.map((c) => ({
    تاريخ_الاستحقاق: c.dueDate.toISOString(),
    اسم_المدين: c.drawerName,
    المستفيد: c.beneficiary ?? "",
    اسم_البنك: c.bankName ?? "",
    رقم_الشيك: c.chequeNumber ?? "",
    المبلغ: Number(c.amount),
  }));
  const الإجمالي = الصفوف.reduce((س, r) => س + r.المبلغ, 0);
  return { الصفوف, الإجمالي };
}

// ============================================================
// الشيكات: حسب الشهر
// ============================================================
export async function تقرير_شيكات_شهرية(ف: فلاتر) {
  const نطاق = نطاق_تاريخ(ف.من, ف.إلى);
  const شيكات = await prisma.cheque.findMany({
    where: { ...(نطاق ? { dueDate: نطاق } : {}) },
    select: { dueDate: true, amount: true },
  });

  const م = new Map<string, { الاسم: string; عدد: number; الإجمالي: number }>();
  for (const c of شيكات) {
    const k = مفتاح_الشهر(c.dueDate);
    const ح = م.get(k) ?? { الاسم: اسم_الشهر(c.dueDate), عدد: 0, الإجمالي: 0 };
    ح.عدد += 1;
    ح.الإجمالي += Number(c.amount);
    م.set(k, ح);
  }
  const الصفوف = [...م.entries()]
    .sort((a, b) => b[0].localeCompare(a[0]))
    .map(([_, v]) => ({ الشهر: v.الاسم, عدد: v.عدد, الإجمالي: v.الإجمالي }));
  const الإجمالي = الصفوف.reduce((س, r) => س + r.الإجمالي, 0);
  return { الصفوف, الإجمالي };
}
