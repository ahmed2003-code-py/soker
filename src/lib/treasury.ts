import type { Prisma } from "@prisma/client";
import { TxnKind } from "@prisma/client";
import { د, جمع } from "@/lib/decimal";

type عميل_معاملة = Prisma.TransactionClient;

/**
 * منطق الخزنة: لكل حساب رصيد جارٍ. إيراد (+)، مصروف (−).
 * نخزّن "الرصيد بعد الحركة" لكل حركة و TreasuryAccount.balance = آخر رصيد.
 */

function أثر(النوع: TxnKind, المبلغ: Prisma.Decimal.Value): Prisma.Decimal {
  return النوع === TxnKind.INCOME ? د(المبلغ) : د(المبلغ).negated();
}

/** إعادة حساب سلسلة حركات حساب خزنة وتحديث رصيده. تُرجع الرصيد النهائي. */
export async function أعد_حساب_حساب_الخزنة(
  tx: عميل_معاملة,
  معرف_الحساب: number
): Promise<Prisma.Decimal> {
  const حركات = await tx.treasuryTxn.findMany({
    where: { accountId: معرف_الحساب },
    orderBy: [{ date: "asc" }, { id: "asc" }],
    select: { id: true, kind: true, amount: true, balanceAfter: true },
  });
  let تراكمي = د(0);
  for (const ح of حركات) {
    تراكمي = جمع(تراكمي, أثر(ح.kind, ح.amount));
    if (!تراكمي.equals(ح.balanceAfter)) {
      await tx.treasuryTxn.update({
        where: { id: ح.id },
        data: { balanceAfter: تراكمي },
      });
    }
  }
  await tx.treasuryAccount.update({
    where: { id: معرف_الحساب },
    data: { balance: تراكمي },
  });
  return تراكمي;
}

/** إضافة حركة خزنة داخل معاملة + إعادة حساب الحساب. تُرجع الحركة. */
export async function أضف_حركة_خزنة(
  tx: عميل_معاملة,
  بيانات: {
    التاريخ: Date;
    النوع: TxnKind;
    المبلغ: Prisma.Decimal.Value;
    معرف_الحساب: number;
    البيان: string;
    معرف_الطرف?: number | null;
    معرف_الفاتورة?: number | null;
    طريقة_الدفع?: string | null;
    أنشأ: number;
  }
) {
  const حركة = await tx.treasuryTxn.create({
    data: {
      date: بيانات.التاريخ,
      kind: بيانات.النوع,
      amount: د(بيانات.المبلغ),
      accountId: بيانات.معرف_الحساب,
      description: بيانات.البيان,
      partyId: بيانات.معرف_الطرف ?? null,
      invoiceId: بيانات.معرف_الفاتورة ?? null,
      method: بيانات.طريقة_الدفع ?? null,
      balanceAfter: 0,
      createdById: بيانات.أنشأ,
    },
  });
  await أعد_حساب_حساب_الخزنة(tx, بيانات.معرف_الحساب);
  return حركة;
}

/** إجمالي رصيد الخزنة (مجموع الحسابات الأربعة) */
export async function إجمالي_الخزنة(
  tx: عميل_معاملة | typeof import("@/lib/prisma").prisma
): Promise<Prisma.Decimal> {
  const حسابات = await tx.treasuryAccount.findMany({ select: { balance: true } });
  return جمع(...حسابات.map((h) => h.balance));
}
