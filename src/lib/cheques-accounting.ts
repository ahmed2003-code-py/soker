import type { Prisma, ChequeStatus } from "@prisma/client";
import { TxnKind, TreasuryAccountType } from "@prisma/client";
import { أضف_قيد, احذف_قيد_ناعم } from "@/lib/ledger";
import { أضف_حركة_خزنة, احذف_حركة_خزنة_ناعم } from "@/lib/treasury";

/** الحالات التي يُعتبر فيها الشيك «مستلَماً/مُسلَّماً» فيؤثّر على حساب الطرف. */
export const حالات_ملتزمة: ChequeStatus[] = ["PENDING", "DEPOSITED", "ENDORSED", "COLLECTED"];

/** هل دخل الشيك معاملة مالية (فلا يُعدَّل/يُحذف — يُصحَّح بالإلغاء/العكس)؟ */
export function دخل_معاملة_مالية(شيك: {
  status: ChequeStatus;
  collectedTxnId: number | null;
  partyLedgerEntryId?: number | null;
}): boolean {
  return شيك.collectedTxnId != null ||
    شيك.partyLedgerEntryId != null ||
    (["DEPOSITED", "ENDORSED", "COLLECTED", "CANCELLED"] as ChequeStatus[]).includes(شيك.status);
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
};

/**
 * مزامنة آثار الشيك مع حالته الهدف — نموذج «برسم التحصيل»:
 *  • أثر الطرف (دفتر الأستاذ): يوجد عندما يكون الشيك مربوطاً بطرف وفي حالة ملتزمة
 *    (تحت التحصيل/مودع/مظهّر/محصّل). وارد ← دائن على العميل (يقل دينه)؛ صادر ← مدين على المورد.
 *  • أثر البنك (الخزنة): يوجد فقط عند «محصّل» (تحصيل فعلي). وارد ← إيراد؛ صادر ← مصروف.
 * تضيف الأثر الناقص وتعكس الأثر الزائد (idempotent)، فتغطّي كل الانتقالات بما فيها
 * الارتداد والإلغاء (يعكسان أثر الطرف والبنك بلا حذف السجل). تُحدّث حالة الشيك ومراجع آثاره.
 */
export async function زامن_آثار_الشيك(
  tx: Prisma.TransactionClient,
  شيك: شيك_للمزامنة,
  الحالة_الهدف: ChequeStatus,
  معرف_حساب_فرعي: number | null,
  فاعل: number
): Promise<void> {
  const وارد = شيك.direction === "INCOMING";
  let معرف_قيد_الطرف = شيك.partyLedgerEntryId;
  let معرف_حركة_البنك = شيك.collectedTxnId;

  const يجب_أثر_الطرف = !!شيك.partyId && حالات_ملتزمة.includes(الحالة_الهدف);
  const يجب_أثر_البنك = الحالة_الهدف === "COLLECTED";
  const وصف = `شيك ${وارد ? "وارد" : "صادر"}${شيك.chequeNumber ? " رقم " + شيك.chequeNumber : ""}`;

  // ── أثر الطرف (دفتر الأستاذ) ──
  if (يجب_أثر_الطرف && !معرف_قيد_الطرف) {
    const قيد = await أضف_قيد(tx, {
      معرف_الطرف: شيك.partyId!,
      التاريخ: new Date(),
      البيان: `${وصف} — ${وارد ? "استلام من العميل" : "تسليم للمورد"}`,
      دائن: وارد ? شيك.amount : 0, // وارد: دائن على العميل (يقل دينه)
      مدين: وارد ? 0 : شيك.amount, // صادر: مدين على المورد (يقل المستحق له)
      أنشأ: فاعل,
    });
    معرف_قيد_الطرف = قيد.id;
  } else if (!يجب_أثر_الطرف && معرف_قيد_الطرف) {
    await احذف_قيد_ناعم(tx, معرف_قيد_الطرف);
    معرف_قيد_الطرف = null;
  }

  // ── أثر البنك (الخزنة) ──
  if (يجب_أثر_البنك && !معرف_حركة_البنك) {
    const بنك = await tx.treasuryAccount.findFirst({
      where: { type: TreasuryAccountType.BANK },
      select: { id: true },
    });
    if (!بنك) throw new Error("لا يوجد حساب بنك في الخزنة");
    const حركة = await أضف_حركة_خزنة(tx, {
      التاريخ: new Date(),
      النوع: وارد ? TxnKind.INCOME : TxnKind.EXPENSE,
      المبلغ: شيك.amount,
      معرف_الحساب: بنك.id,
      معرف_حساب_فرعي: معرف_حساب_فرعي ?? null,
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
      collectedTxnId: معرف_حركة_البنك,
      updatedById: فاعل,
    },
  });
}
