import type { Prisma, ChequeStatus } from "@prisma/client";
import { TxnKind, TreasuryAccountType } from "@prisma/client";
import { أضف_قيد, احذف_قيد_ناعم } from "@/lib/ledger";
import { أضف_حركة_خزنة, احذف_حركة_خزنة_ناعم } from "@/lib/treasury";

/** الحالات التي يُعتبر فيها الشيك «مستلَماً/مُسلَّماً» فيؤثّر على حساب الطرف. */
export const حالات_ملتزمة: ChequeStatus[] = ["PENDING", "DEPOSITED", "ENDORSED", "COLLECTED", "SETTLED"];

/** هل دخل الشيك معاملة مالية (فلا يُعدَّل/يُحذف — يُصحَّح بالإلغاء/العكس)؟ */
export function دخل_معاملة_مالية(شيك: {
  status: ChequeStatus;
  collectedTxnId: number | null;
  partyLedgerEntryId?: number | null;
  endorseLedgerEntryId?: number | null;
}): boolean {
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
