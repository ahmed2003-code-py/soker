import type { PrismaClient } from "@prisma/client";
import { prisma as عميل_افتراضي } from "@/lib/prisma";

/**
 * بيانات «تقرير معاملة السداد» — شامل كل وسائل الدفع في نفس المعاملة:
 * شيكات مُظهَّرة + نقدي/تحويلات (الدفعة الموزّعة) بإجمالي عام واحد.
 *
 * الدخول بأي مدخل من التلاتة، والباقي يتحدد لوحده:
 *  - معرف_معاملة: معاملة السداد المركّب مباشرة
 *  - معرفات_الشيكات: لو الشيكات تنتمي لمعاملة ⇒ التقرير يترقّى للشكل الشامل تلقائياً
 *  - معرف_دفعة_موزعة: نفس الشيء من جهة النقدي/التحويلات
 */
const حقول_الشيك = {
  id: true, chequeNumber: true, amount: true, dueDate: true, bankName: true, status: true,
  drawerName: true, transferredFrom: true, endorsedAt: true,
  party: { select: { name: true } }, endorsedTo: { select: { name: true } },
} as const;

export type مدخلات_تقرير_السداد = {
  معرف_معاملة?: number | null;
  معرفات_الشيكات?: number[];
  معرف_دفعة_موزعة?: number | null;
  معرف_الطرف?: number | null;
  نوع_الطرف?: string | null;
};

export async function اجلب_بيانات_تقرير_السداد(
  مدخلات: مدخلات_تقرير_السداد,
  p: PrismaClient = عميل_افتراضي
) {
  const معرفات = (مدخلات.معرفات_الشيكات ?? []).filter((n) => Number.isFinite(n) && n > 0);

  const اجلب_معاملة = (id: number) =>
    p.settlementBatch.findUnique({
      where: { id },
      select: { id: true, date: true, note: true, party: { select: { id: true, name: true, type: true } } },
    });

  // ── تحديد معاملة السداد من أي مدخل متاح ──
  let معاملة = مدخلات.معرف_معاملة ? await اجلب_معاملة(مدخلات.معرف_معاملة) : null;
  if (!معاملة && معرفات.length) {
    const ش = await p.cheque.findFirst({
      where: { id: { in: معرفات }, settlementBatchId: { not: null } },
      select: { settlementBatchId: true },
    });
    if (ش?.settlementBatchId) معاملة = await اجلب_معاملة(ش.settlementBatchId);
  }
  if (!معاملة && مدخلات.معرف_دفعة_موزعة) {
    const د = await p.splitPayment.findUnique({
      where: { id: مدخلات.معرف_دفعة_موزعة },
      select: { settlementBatchId: true },
    });
    if (د?.settlementBatchId) معاملة = await اجلب_معاملة(د.settlementBatchId);
  }

  // ── الشيكات: كل شيكات المعاملة، وإلا المعرفات المُمرَّرة ──
  const شيكات = معاملة
    ? await p.cheque.findMany({ where: { settlementBatchId: معاملة.id }, orderBy: { dueDate: "asc" }, select: حقول_الشيك })
    : معرفات.length
    ? await p.cheque.findMany({ where: { id: { in: معرفات } }, orderBy: { dueDate: "asc" }, select: حقول_الشيك })
    : [];

  // ── النقدي/التحويلات: حركات خزنة الدفعات الموزّعة المرتبطة ──
  const معرفات_الدفعات = معاملة
    ? (await p.splitPayment.findMany({ where: { settlementBatchId: معاملة.id, deletedAt: null }, select: { id: true } })).map((x) => x.id)
    : مدخلات.معرف_دفعة_موزعة
    ? [مدخلات.معرف_دفعة_موزعة]
    : [];
  const حركات = معرفات_الدفعات.length
    ? await p.treasuryTxn.findMany({
        where: { splitPaymentId: { in: معرفات_الدفعات }, deletedAt: null },
        orderBy: { id: "asc" },
        select: {
          id: true, date: true, amount: true, description: true, method: true,
          account: { select: { type: true } }, subAccount: { select: { name: true } },
        },
      })
    : [];

  const طرف_الرابط = مدخلات.معرف_الطرف
    ? await p.party.findUnique({ where: { id: مدخلات.معرف_الطرف }, select: { name: true, type: true } })
    : null;

  const إجمالي_الشيكات = شيكات.reduce((س, ش) => س + Number(ش.amount), 0);
  const إجمالي_النقدي = حركات.reduce((س, ح) => س + Number(ح.amount), 0);

  return {
    معاملة,
    شيكات,
    حركات,
    اسم_الطرف: معاملة?.party.name ?? طرف_الرابط?.name ?? null,
    مورد_سياق: معاملة
      ? معاملة.party.type === "SUPPLIER"
      : مدخلات.نوع_الطرف === "SUPPLIER" || طرف_الرابط?.type === "SUPPLIER",
    إجمالي_الشيكات,
    إجمالي_النقدي,
    الإجمالي: إجمالي_الشيكات + إجمالي_النقدي,
    مركّبة: شيكات.length > 0 && حركات.length > 0,
  };
}
