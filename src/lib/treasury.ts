import type { Prisma } from "@prisma/client";
import { TxnKind } from "@prisma/client";
import { د, جمع } from "@/lib/decimal";
import { Decimal } from "@prisma/client/runtime/library";

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
  // تحديث جميع الأرصدة في استعلام واحد بدلاً من N تحديثات متسلسلة
  await tx.$executeRaw`
    WITH running AS (
      SELECT id,
        SUM(CASE WHEN kind = 'INCOME' THEN amount ELSE -amount END)
        OVER (ORDER BY date ASC, id ASC) AS nb
      FROM treasury_txns WHERE account_id = ${معرف_الحساب}
    )
    UPDATE treasury_txns tt SET balance_after = running.nb
    FROM running WHERE tt.id = running.id
      AND tt.balance_after IS DISTINCT FROM running.nb
  `;

  const آخر = await tx.treasuryTxn.findFirst({
    where: { accountId: معرف_الحساب },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    select: { balanceAfter: true },
  });
  const تراكمي = آخر?.balanceAfter ?? د(0);

  await tx.treasuryAccount.update({
    where: { id: معرف_الحساب },
    data: { balance: تراكمي },
  });

  // إعادة حساب أرصدة الحسابات الفرعية المرتبطة بهذا الحساب
  await tx.$executeRaw`
    WITH sub_balances AS (
      SELECT sub_account_id,
        SUM(CASE WHEN kind = 'INCOME' THEN amount ELSE -amount END) AS bal
      FROM treasury_txns
      WHERE account_id = ${معرف_الحساب} AND sub_account_id IS NOT NULL
      GROUP BY sub_account_id
    )
    UPDATE sub_accounts sa
    SET balance = COALESCE(sb.bal, 0)
    FROM sub_balances sb
    WHERE sa.id = sb.sub_account_id
  `;

  return تراكمي;
}

/**
 * إضافة حركة خزنة داخل معاملة.
 *
 * تحسين الأداء: إذا كانت الحركة في *نهاية* سلسلة الحساب زمنياً (تاريخها ≥ تاريخ
 * آخر حركة) نحدّث الرصيد تزايدياً في O(1) بدل إعادة حساب الحساب كاملاً O(n).
 * أما الحركة بتاريخ سابق فتستدعي إعادة الحساب الكاملة لتصحيح ما يليها.
 * النتيجة النهائية مطابقة تماماً لإعادة الحساب الكاملة. تُرجع الحركة.
 */
export async function أضف_حركة_خزنة(
  tx: عميل_معاملة,
  بيانات: {
    التاريخ: Date;
    النوع: TxnKind;
    المبلغ: Prisma.Decimal.Value;
    معرف_الحساب: number;
    البيان: string;
    معرف_الطرف?: number | null;
    اسم_الطرف_الخارجي?: string | null;
    معرف_الفاتورة?: number | null;
    طريقة_الدفع?: string | null;
    معرف_حساب_فرعي?: number | null;
    أنشأ: number;
  }
) {
  // آخر حركة في سلسلة الحساب (الأحدث زمنياً) قبل الإضافة
  const الأخيرة = await tx.treasuryTxn.findFirst({
    where: { accountId: بيانات.معرف_الحساب },
    orderBy: [{ date: "desc" }, { id: "desc" }],
    select: { date: true, balanceAfter: true },
  });

  const في_النهاية = !الأخيرة || بيانات.التاريخ >= الأخيرة.date;
  const رصيد_جديد = في_النهاية
    ? جمع(الأخيرة?.balanceAfter ?? 0, أثر(بيانات.النوع, بيانات.المبلغ))
    : د(0); // حركة بتاريخ سابق: تُحسب في إعادة الحساب الكاملة

  const حركة = await tx.treasuryTxn.create({
    data: {
      date: بيانات.التاريخ,
      kind: بيانات.النوع,
      amount: د(بيانات.المبلغ),
      accountId: بيانات.معرف_الحساب,
      description: بيانات.البيان,
      partyId: بيانات.معرف_الطرف ?? null,
      externalPartyName: بيانات.اسم_الطرف_الخارجي ?? null,
      invoiceId: بيانات.معرف_الفاتورة ?? null,
      method: بيانات.طريقة_الدفع ?? null,
      subAccountId: بيانات.معرف_حساب_فرعي ?? null,
      balanceAfter: رصيد_جديد,
      createdById: بيانات.أنشأ,
    },
  });

  if (في_النهاية) {
    // تحديث تزايدي: رصيد الحساب = رصيد الحركة الجديدة (آخر السلسلة)
    await tx.treasuryAccount.update({
      where: { id: بيانات.معرف_الحساب },
      data: { balance: رصيد_جديد },
    });
    // تحديث رصيد الحساب الفرعي تزايدياً
    if (بيانات.معرف_حساب_فرعي) {
      const delta = بيانات.النوع === TxnKind.INCOME
        ? new Decimal(String(بيانات.المبلغ))
        : new Decimal(String(بيانات.المبلغ)).negated();
      await tx.subAccount.update({
        where: { id: بيانات.معرف_حساب_فرعي },
        data: { balance: { increment: delta } },
      });
    }
  } else {
    // حركة بتاريخ سابق → أعد حساب الحساب كاملاً (يشمل الحسابات الفرعية)
    await أعد_حساب_حساب_الخزنة(tx, بيانات.معرف_الحساب);
  }
  return حركة;
}

/** إجمالي رصيد الخزنة (مجموع الحسابات الأربعة) */
export async function إجمالي_الخزنة(
  tx: عميل_معاملة | typeof import("@/lib/prisma").prisma
): Promise<Prisma.Decimal> {
  const حسابات = await tx.treasuryAccount.findMany({ select: { balance: true } });
  return جمع(...حسابات.map((h) => h.balance));
}
