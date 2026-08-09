import type { Prisma, ChequeStatus, PrismaClient } from "@prisma/client";
import { TxnKind, TreasuryAccountType } from "@prisma/client";
import { prisma } from "@/lib/prisma";
import { د } from "@/lib/decimal";
import { أضف_قيد, احذف_قيد_ناعم } from "@/lib/ledger";
import { أضف_حركة_خزنة, احذف_حركة_خزنة_ناعم } from "@/lib/treasury";

/** الحالات التي يُعتبر فيها الشيك «مستلَماً/مُسلَّماً» فيؤثّر على حساب الطرف (النموذج القديم v1). */
export const حالات_ملتزمة: ChequeStatus[] = ["PENDING", "DEPOSITED", "ENDORSED", "COLLECTED", "SETTLED"];

/** النموذج الجديد (v2): الشيك الوارد «مُلتزَم» (دين العميل مخصوم) في هذه الحالات. */
export const حالات_ملتزمة_v2: ChequeStatus[] = ["REGISTERED", "DEPOSITED", "ENDORSED", "COLLECTED"];

/** هل دخل الشيك معاملة مالية (فلا يُعدَّل/يُحذف — يُصحَّح بالإلغاء/العكس)؟ */
export function دخل_معاملة_مالية(شيك: {
  status: ChequeStatus;
  collectedTxnId: number | null;
  partyLedgerEntryId?: number | null;
  endorseLedgerEntryId?: number | null;
  settlesChequeId?: number | null;
  direction?: "INCOMING" | "OUTGOING";
  accountingVersion?: number | null;
}): boolean {
  // شيك وارد مُستخدَم في تسوية شيك صادر → مقفول (يُحرَّر بإزالته من التسوية)
  if (شيك.settlesChequeId != null) return true;
  const نسخة = شيك.accountingVersion ?? 1;
  if (نسخة >= 2 && شيك.direction === "INCOMING") {
    // v2: مسموح التعديل وهو «مسجّل» (أثر العميل فقط، يُعاد ضبطه)؛ مقفول بعد إيداع/تظهير/تحصيل أو إلغاء
    return شيك.collectedTxnId != null ||
      شيك.endorseLedgerEntryId != null ||
      (["DEPOSITED", "ENDORSED", "COLLECTED", "CANCELLED"] as ChequeStatus[]).includes(شيك.status);
  }
  return شيك.collectedTxnId != null ||
    شيك.partyLedgerEntryId != null ||
    شيك.endorseLedgerEntryId != null ||
    (["DEPOSITED", "ENDORSED", "COLLECTED", "SETTLED", "CANCELLED"] as ChequeStatus[]).includes(شيك.status);
}

export type شيك_للمزامنة = {
  id: number;
  direction: "INCOMING" | "OUTGOING";
  amount: Prisma.Decimal;
  partyId: number | null;
  chequeNumber: string | null;
  drawerName: string;
  status: ChequeStatus;
  collectedTxnId: number | null;
  partyLedgerEntryId: number | null;
  endorseLedgerEntryId: number | null;
  endorsedToId: number | null;
  accountingVersion?: number | null;
};

export type خيارات_مزامنة = {
  /** حساب الخزنة عند التحصيل الفعلي (نقدي/بنك). افتراضي: البنك. */
  معرف_حساب_التحصيل?: number | null;
  معرف_حساب_فرعي?: number | null;
  /** المورد المُظهَّر له الشيك (عند الانتقال إلى «مُظهَّر»). */
  معرف_المورد_للتظهير?: number | null;
};

/**
 * مزامنة آثار الشيك مع حالته الهدف — نموذج «برسم التحصيل». ثلاثة آثار مستقلة:
 *  1) أثر الطرف (partyLedgerEntryId): موجود في الحالات الملتزمة والشيك مربوط بطرف.
 *     وارد ← دائن على العميل (يقل دينه)؛ صادر ← مدين على المورد (يقل المستحق).
 *  2) أثر التظهير (endorseLedgerEntryId): شيك وارد «مُظهَّر» لمورد ← مدين على المورد (يقل المستحق)،
 *     بلا حركة خزنة. يُعكَس عند الارتداد/الإلغاء (يرجع مستحق المورد).
 *  3) أثر البنك/النقدية (collectedTxnId): فقط عند «محصّل» (تحصيل فعلي) على الحساب المختار.
 *     وارد ← إيراد؛ صادر ← مصروف.
 * الدالة تضيف الناقص وتعكس الزائد (idempotent) فتغطّي كل الانتقالات بلا حذف السجل.
 */
export async function زامن_آثار_الشيك(
  tx: Prisma.TransactionClient,
  شيك: شيك_للمزامنة,
  الحالة_الهدف: ChequeStatus,
  خيارات: خيارات_مزامنة,
  فاعل: number
): Promise<void> {
  // النموذج الجديد (v2) للشيكات الواردة فقط — الصادرة والقديمة تُبقي منطق v1
  if ((شيك.accountingVersion ?? 1) >= 2 && شيك.direction === "INCOMING") {
    return زامن_آثار_الشيك_v2(tx, شيك, الحالة_الهدف, خيارات ?? {}, فاعل);
  }
  const وارد = شيك.direction === "INCOMING";
  const وصف = `شيك ${وارد ? "وارد" : "صادر"}${شيك.chequeNumber ? " رقم " + شيك.chequeNumber : ""}`;
  let معرف_قيد_الطرف = شيك.partyLedgerEntryId;
  let معرف_قيد_التظهير = شيك.endorseLedgerEntryId;
  let مظهَّر_لـ = شيك.endorsedToId;
  let معرف_حركة_البنك = شيك.collectedTxnId;

  // ── 1) أثر الطرف الأساسي (عميل للوارد / مورد للصادر) ──
  const يجب_أثر_الطرف = !!شيك.partyId && حالات_ملتزمة.includes(الحالة_الهدف);
  if (يجب_أثر_الطرف && !معرف_قيد_الطرف) {
    const قيد = await أضف_قيد(tx, {
      معرف_الطرف: شيك.partyId!,
      التاريخ: new Date(),
      البيان: `${وصف} — ${وارد ? "استلام من العميل" : "تسليم للمورد"}`,
      دائن: وارد ? شيك.amount : 0,
      مدين: وارد ? 0 : شيك.amount,
      أنشأ: فاعل,
    });
    معرف_قيد_الطرف = قيد.id;
  } else if (!يجب_أثر_الطرف && معرف_قيد_الطرف) {
    await احذف_قيد_ناعم(tx, معرف_قيد_الطرف);
    معرف_قيد_الطرف = null;
  }

  // ── 2) أثر التظهير (شيك وارد مُظهَّر لمورد) ──
  const هدف_التظهير = الحالة_الهدف === "ENDORSED"
    ? (خيارات.معرف_المورد_للتظهير ?? شيك.endorsedToId ?? null)
    : null;
  const يجب_أثر_التظهير = وارد && الحالة_الهدف === "ENDORSED" && !!هدف_التظهير;
  if (يجب_أثر_التظهير && !معرف_قيد_التظهير) {
    const قيد = await أضف_قيد(tx, {
      معرف_الطرف: هدف_التظهير!,
      التاريخ: new Date(),
      البيان: `${وصف} — تظهير سداداً للمورد`,
      مدين: شيك.amount, // مدين على المورد → يقل المستحق له
      أنشأ: فاعل,
    });
    معرف_قيد_التظهير = قيد.id;
    مظهَّر_لـ = هدف_التظهير;
  } else if (!يجب_أثر_التظهير && معرف_قيد_التظهير) {
    await احذف_قيد_ناعم(tx, معرف_قيد_التظهير);
    معرف_قيد_التظهير = null;
    مظهَّر_لـ = null;
  }

  // ── 3) أثر البنك/النقدية (تحصيل فعلي) ──
  const يجب_أثر_البنك = الحالة_الهدف === "COLLECTED";
  if (يجب_أثر_البنك && !معرف_حركة_البنك) {
    let معرف_الحساب = خيارات.معرف_حساب_التحصيل ?? null;
    if (!معرف_الحساب) {
      const بنك = await tx.treasuryAccount.findFirst({
        where: { type: TreasuryAccountType.BANK }, select: { id: true },
      });
      معرف_الحساب = بنك?.id ?? null;
    }
    if (!معرف_الحساب) throw new Error("لا يوجد حساب خزنة للتحصيل");
    const حركة = await أضف_حركة_خزنة(tx, {
      التاريخ: new Date(),
      النوع: وارد ? TxnKind.INCOME : TxnKind.EXPENSE,
      المبلغ: شيك.amount,
      معرف_الحساب,
      معرف_حساب_فرعي: خيارات.معرف_حساب_فرعي ?? null,
      البيان: `${وارد ? "تحصيل" : "صرف"} ${وصف} — ${شيك.drawerName}`,
      اسم_الطرف_الخارجي: شيك.drawerName,
      أنشأ: فاعل,
    });
    معرف_حركة_البنك = حركة.id;
  } else if (!يجب_أثر_البنك && معرف_حركة_البنك) {
    await احذف_حركة_خزنة_ناعم(tx, معرف_حركة_البنك);
    معرف_حركة_البنك = null;
  }

  await tx.cheque.update({
    where: { id: شيك.id },
    data: {
      status: الحالة_الهدف,
      partyLedgerEntryId: معرف_قيد_الطرف,
      endorseLedgerEntryId: معرف_قيد_التظهير,
      endorsedToId: مظهَّر_لـ,
      collectedTxnId: معرف_حركة_البنك,
      updatedById: فاعل,
    },
  });
}

/**
 * النموذج الجديد v2 — الشيكات الواردة فقط (نموذج «خزنة الشيكات»).
 * ثلاثة آثار مستقلة (idempotent) + خزنة الشيكات مُشتقّة (= الشيكات في حالة «مسجّل»، تُحسب في العرض):
 *  1) دين العميل (partyLedgerEntryId): دائن V — موجود في {مسجّل، مودع، مظهّر، محصّل}.
 *     يُزال عند «مرتد» أو «ملغي» ← يرجع دين العميل مرة أخرى.
 *  2) التظهير (endorseLedgerEntryId): «مظهّر» ← مدين V على المورد (يقل مستحقه). يُعكَس عند الارتداد/الإلغاء.
 *  3) التحصيل الفعلي (collectedTxnId): «مودع» ← إيراد V على البنك المختار؛ «محصّل» ← إيراد V على النقدية.
 * الارتداد يعالج الحالتين تلقائياً (يزيل ما كان موجوداً): إن كان مودعاً/محصّلاً يعكس البنك/النقدية،
 * وإن كان مظهّراً يعكس التظهير — وفي الحالتين يرجع دين العميل.
 */
async function زامن_آثار_الشيك_v2(
  tx: Prisma.TransactionClient,
  شيك: شيك_للمزامنة,
  الحالة_الهدف: ChequeStatus,
  خيارات: خيارات_مزامنة,
  فاعل: number
): Promise<void> {
  const وصف = `شيك وارد${شيك.chequeNumber ? " رقم " + شيك.chequeNumber : ""}`;
  let معرف_قيد_الطرف = شيك.partyLedgerEntryId;
  let معرف_قيد_التظهير = شيك.endorseLedgerEntryId;
  let مظهَّر_لـ = شيك.endorsedToId;
  let معرف_حركة_التحصيل = شيك.collectedTxnId;

  // ── 1) دين العميل (دائن V) — في الحالات الملتزمة v2 ──
  const يجب_الطرف = !!شيك.partyId && حالات_ملتزمة_v2.includes(الحالة_الهدف);
  if (يجب_الطرف && !معرف_قيد_الطرف) {
    const قيد = await أضف_قيد(tx, {
      معرف_الطرف: شيك.partyId!,
      التاريخ: new Date(),
      البيان: `${وصف} — استلام من العميل`,
      دائن: شيك.amount,
      أنشأ: فاعل,
    });
    معرف_قيد_الطرف = قيد.id;
  } else if (!يجب_الطرف && معرف_قيد_الطرف) {
    await احذف_قيد_ناعم(tx, معرف_قيد_الطرف);
    معرف_قيد_الطرف = null;
  }

  // ── 2) التظهير لمورد (مدين V) — «مظهّر» فقط ──
  const هدف_التظهير = الحالة_الهدف === "ENDORSED"
    ? (خيارات.معرف_المورد_للتظهير ?? شيك.endorsedToId ?? null)
    : null;
  const يجب_التظهير = الحالة_الهدف === "ENDORSED" && !!هدف_التظهير;
  if (يجب_التظهير && !معرف_قيد_التظهير) {
    const قيد = await أضف_قيد(tx, {
      معرف_الطرف: هدف_التظهير!,
      التاريخ: new Date(),
      البيان: `${وصف} — تظهير سداداً للمورد`,
      مدين: شيك.amount,
      أنشأ: فاعل,
    });
    معرف_قيد_التظهير = قيد.id;
    مظهَّر_لـ = هدف_التظهير;
  } else if (!يجب_التظهير && معرف_قيد_التظهير) {
    await احذف_قيد_ناعم(tx, معرف_قيد_التظهير);
    معرف_قيد_التظهير = null;
    مظهَّر_لـ = null;
  }

  // ── 3) التحصيل الفعلي: مودع→بنك، محصّل→نقدي ──
  const يجب_التحصيل = الحالة_الهدف === "DEPOSITED" || الحالة_الهدف === "COLLECTED";
  if (يجب_التحصيل && !معرف_حركة_التحصيل) {
    let معرف_الحساب: number | null;
    let معرف_فرعي: number | null = null;
    if (الحالة_الهدف === "DEPOSITED") {
      معرف_الحساب = خيارات.معرف_حساب_التحصيل ??
        (await tx.treasuryAccount.findFirst({ where: { type: TreasuryAccountType.BANK }, select: { id: true } }))?.id ?? null;
      معرف_فرعي = خيارات.معرف_حساب_فرعي ?? null;
    } else {
      معرف_الحساب = (await tx.treasuryAccount.findFirst({ where: { type: TreasuryAccountType.CASH }, select: { id: true } }))?.id ?? null;
    }
    if (!معرف_الحساب) throw new Error("لا يوجد حساب خزنة للتحصيل");
    const حركة = await أضف_حركة_خزنة(tx, {
      التاريخ: new Date(),
      النوع: TxnKind.INCOME,
      المبلغ: شيك.amount,
      معرف_الحساب,
      معرف_حساب_فرعي: معرف_فرعي,
      البيان: `${الحالة_الهدف === "DEPOSITED" ? "إيداع" : "تحصيل"} ${وصف} — ${شيك.drawerName}`,
      اسم_الطرف_الخارجي: شيك.drawerName,
      أنشأ: فاعل,
    });
    معرف_حركة_التحصيل = حركة.id;
  } else if (!يجب_التحصيل && معرف_حركة_التحصيل) {
    await احذف_حركة_خزنة_ناعم(tx, معرف_حركة_التحصيل);
    معرف_حركة_التحصيل = null;
  }

  await tx.cheque.update({
    where: { id: شيك.id },
    data: {
      status: الحالة_الهدف,
      partyLedgerEntryId: معرف_قيد_الطرف,
      endorseLedgerEntryId: معرف_قيد_التظهير,
      endorsedToId: مظهَّر_لـ,
      collectedTxnId: معرف_حركة_التحصيل,
      updatedById: فاعل,
    },
  });
}

/** رصيد خزنة الشيكات (v2): إجمالي قيمة الشيكات الواردة في حالة «مسجّل». مشتق — منفصل عن إجمالي الخزنة. */
export async function رصيد_خزنة_الشيكات(
  db: PrismaClient | Prisma.TransactionClient = prisma
): Promise<Prisma.Decimal | number> {
  const r = await db.cheque.aggregate({
    where: { direction: "INCOMING", accountingVersion: { gte: 2 }, status: "REGISTERED", settlesChequeId: null },
    _sum: { amount: true },
  });
  return r._sum.amount ?? 0;
}

/**
 * إجمالي المُسدَّد على شيك صادر (تسوية على دفعات) = دفعات الخزنة + قيمة الشيكات الواردة المستخدمة.
 * الشيكات الواردة تموّل التسوية بلا أثر على دفتر الأستاذ (المورد اتخصم وقت الإصدار).
 */
export async function مُسدَّد_تسوية(
  db: PrismaClient | Prisma.TransactionClient,
  معرف_الشيك_الصادر: number
): Promise<Prisma.Decimal> {
  const [دفعات, شيكات] = await Promise.all([
    db.treasuryTxn.findMany({ where: { chequeId: معرف_الشيك_الصادر, deletedAt: null }, select: { amount: true } }),
    db.cheque.findMany({ where: { settlesChequeId: معرف_الشيك_الصادر }, select: { amount: true } }),
  ]);
  let م = د(0);
  for (const د2 of دفعات) م = م.plus(د2.amount);
  for (const ش of شيكات) م = م.plus(ش.amount);
  return م;
}
