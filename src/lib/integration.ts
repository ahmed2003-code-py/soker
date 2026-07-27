import type { Prisma } from "@prisma/client";
import { TxnKind, PartyType } from "@prisma/client";
import { أضف_حركة_خزنة, احذف_حركة_خزنة_ناعم, أعد_حساب_حساب_الخزنة } from "@/lib/treasury";
import { أضف_قيد, احذف_قيد_ناعم, أعد_حساب_سلسلة_الطرف } from "@/lib/ledger";

type عميل_معاملة = Prisma.TransactionClient;
export type اتجاه = "تحصيل" | "صرف"; // تحصيل من عميل / صرف لمورد

/** اتجاه العملية المرتبطة حسب نوع الطرف: عميل → تحصيل، مورد → صرف. */
export function اتجاه_الطرف(النوع: PartyType): اتجاه {
  return النوع === PartyType.CUSTOMER ? "تحصيل" : "صرف";
}

/**
 * قلب التكامل: عملية خزنة مرتبطة بحساب طرف — معاملة ذرّية واحدة.
 * تحصيل: إيراد للخزنة + قيد دائن على العميل (يقلّل مديونيته).
 * صرف: مصروف من الخزنة + قيد مدين على المورد (يقلّل المستحق له).
 */
export async function أنشئ_عملية_مرتبطة(
  tx: عميل_معاملة,
  ب: {
    الاتجاه: اتجاه;
    معرف_الطرف: number;
    اسم_الطرف: string;
    المبلغ: Prisma.Decimal.Value;
    التاريخ: Date;
    معرف_الحساب: number;
    معرف_حساب_فرعي?: number | null;
    طريقة_الدفع?: string | null;
    رقم_الفاتورة?: string | null;
    معرف_الفاتورة?: number | null;
    البيان?: string | null;
    أنشأ: number;
  }
) {
  const تحصيل = ب.الاتجاه === "تحصيل";
  const بيان = ب.البيان?.trim()
    ? ب.البيان.trim()
    : تحصيل
      ? `تحصيل من ${ب.اسم_الطرف}${ب.طريقة_الدفع ? " — " + ب.طريقة_الدفع : ""}`
      : `صرف إلى ${ب.اسم_الطرف}${ب.طريقة_الدفع ? " — " + ب.طريقة_الدفع : ""}`;

  const حركة = await أضف_حركة_خزنة(tx, {
    التاريخ: ب.التاريخ,
    النوع: تحصيل ? TxnKind.INCOME : TxnKind.EXPENSE,
    المبلغ: ب.المبلغ,
    معرف_الحساب: ب.معرف_الحساب,
    معرف_حساب_فرعي: ب.معرف_حساب_فرعي ?? null,
    البيان: بيان,
    معرف_الطرف: ب.معرف_الطرف,
    معرف_الفاتورة: ب.معرف_الفاتورة ?? null,
    طريقة_الدفع: ب.طريقة_الدفع ?? null,
    أنشأ: ب.أنشأ,
  });

  const قيد = await أضف_قيد(tx, {
    معرف_الطرف: ب.معرف_الطرف,
    التاريخ: ب.التاريخ,
    البيان: بيان,
    مدين: تحصيل ? 0 : ب.المبلغ,
    دائن: تحصيل ? ب.المبلغ : 0,
    رقم_المستند: ب.رقم_الفاتورة ?? null,
    معرف_الفاتورة: ب.معرف_الفاتورة ?? null,
    معرف_حركة_الخزنة: حركة.id,
    أنشأ: ب.أنشأ,
  });

  return { معرف_حركة_الخزنة: حركة.id, معرف_القيد: قيد.id };
}

/**
 * عكس عملية مرتبطة بالكامل (حذف القيد + حركة الخزنة) + إعادة حساب الجانبين.
 * يُرجع بيانات العملية المحذوفة (للاستخدام في إعادة التطبيق عند التعديل).
 */
export async function اعكس_عملية_مرتبطة(tx: عميل_معاملة, معرف_حركة_الخزنة: number) {
  const حركة = await tx.treasuryTxn.findUnique({ where: { id: معرف_حركة_الخزنة } });
  if (!حركة) throw new Error("حركة الخزنة غير موجودة");
  const قيد = await tx.ledgerEntry.findFirst({
    where: { treasuryTxnId: معرف_حركة_الخزنة, deletedAt: null },
  });

  const معرف_الطرف = حركة.partyId ?? قيد?.partyId ?? null;
  // حذف ناعم + دلتا بدل full recompute → O(k) بدل O(n)
  if (قيد) await احذف_قيد_ناعم(tx, قيد.id);
  await احذف_حركة_خزنة_ناعم(tx, معرف_حركة_الخزنة);

  return {
    الاتجاه: (حركة.kind === TxnKind.INCOME ? "تحصيل" : "صرف") as اتجاه,
    معرف_الطرف,
    المبلغ: حركة.amount,
    التاريخ: حركة.date,
    معرف_الحساب: حركة.accountId,
    طريقة_الدفع: حركة.method,
    معرف_الفاتورة: حركة.invoiceId,
  };
}

/**
 * دفعة موزّعة: قيد واحد على الطرف بالإجمالي + عدة حركات خزنة مستقلة (وسائل/حسابات مختلفة).
 * تحصيل (عميل): كل بند = إيراد في خزنته، والقيد دائن بالإجمالي (يقلّل المديونية مرة واحدة).
 * صرف (مورد): كل بند = مصروف من خزنته، والقيد مدين بالإجمالي (يقلّل المستحق مرة واحدة).
 * الثلاثة مربوطة بـ SplitPayment — التعديل/الحذف يُطبَّق على المجموعة كاملة.
 */
export async function أنشئ_دفعة_موزعة(
  tx: عميل_معاملة,
  ب: {
    الاتجاه: اتجاه;
    معرف_الطرف?: number | null;        // طرف مسجّل (يُنشأ له قيد) — أو null
    اسم_الطرف_الخارجي?: string | null; // طرف غير مسجّل (اسم فقط، بلا قيد)
    اسم_الطرف: string;                  // اسم للعرض في البيان
    الإجمالي: Prisma.Decimal.Value;
    التاريخ: Date;
    البيان?: string | null;
    رقم_الفاتورة?: string | null;
    معرف_الفاتورة?: number | null;
    بنود: {
      معرف_الحساب: number;
      معرف_حساب_فرعي?: number | null;
      طريقة_الدفع?: string | null;
      المبلغ: Prisma.Decimal.Value;
    }[];
    أنشأ: number;
  }
) {
  const تحصيل = ب.الاتجاه === "تحصيل";
  const بيان_أساسي = ب.البيان?.trim()
    ? ب.البيان.trim()
    : تحصيل
      ? `تحصيل موزّع من ${ب.اسم_الطرف}`
      : `صرف موزّع إلى ${ب.اسم_الطرف}`;

  const رابط = await tx.splitPayment.create({ data: {} });

  // حركة خزنة مستقلة لكل بند
  const معرفات_الحركات: number[] = [];
  for (const بند of ب.بنود) {
    const بيان_بند = بند.طريقة_الدفع ? `${بيان_أساسي} — ${بند.طريقة_الدفع}` : بيان_أساسي;
    const حركة = await أضف_حركة_خزنة(tx, {
      التاريخ: ب.التاريخ,
      النوع: تحصيل ? TxnKind.INCOME : TxnKind.EXPENSE,
      المبلغ: بند.المبلغ,
      معرف_الحساب: بند.معرف_الحساب,
      معرف_حساب_فرعي: بند.معرف_حساب_فرعي ?? null,
      البيان: بيان_بند,
      معرف_الطرف: ب.معرف_الطرف ?? null,
      اسم_الطرف_الخارجي: ب.معرف_الطرف ? null : (ب.اسم_الطرف_الخارجي ?? null),
      معرف_الفاتورة: ب.معرف_الفاتورة ?? null,
      طريقة_الدفع: بند.طريقة_الدفع ?? null,
      أنشأ: ب.أنشأ,
    });
    await tx.treasuryTxn.update({ where: { id: حركة.id }, data: { splitPaymentId: رابط.id } });
    معرفات_الحركات.push(حركة.id);
  }

  // قيد واحد على الطرف بالإجمالي — فقط لو الطرف مسجّل (الربط عبر المجموعة)
  let معرف_القيد: number | null = null;
  if (ب.معرف_الطرف) {
    const قيد = await أضف_قيد(tx, {
      معرف_الطرف: ب.معرف_الطرف,
      التاريخ: ب.التاريخ,
      البيان: بيان_أساسي,
      مدين: تحصيل ? 0 : ب.الإجمالي,
      دائن: تحصيل ? ب.الإجمالي : 0,
      رقم_المستند: ب.رقم_الفاتورة ?? null,
      معرف_الفاتورة: ب.معرف_الفاتورة ?? null,
      أنشأ: ب.أنشأ,
    });
    await tx.ledgerEntry.update({ where: { id: قيد.id }, data: { splitPaymentId: رابط.id } });
    معرف_القيد = قيد.id;
  }

  return { معرف_المجموعة: رابط.id, معرف_القيد, معرفات_الحركات };
}

/**
 * حذف دفعة موزّعة بالكامل: القيد + كل حركات الخزنة — ويعيد حساب الطرف وكل الحسابات المتأثرة.
 */
export async function حذف_دفعة_موزعة(tx: عميل_معاملة, معرف_المجموعة: number) {
  const قيود = await tx.ledgerEntry.findMany({
    where: { splitPaymentId: معرف_المجموعة, deletedAt: null },
    select: { id: true, partyId: true },
  });
  const حركات = await tx.treasuryTxn.findMany({
    where: { splitPaymentId: معرف_المجموعة, deletedAt: null },
    select: { id: true, accountId: true },
  });

  for (const قيد of قيود) await احذف_قيد_ناعم(tx, قيد.id);
  for (const حركة of حركات) await احذف_حركة_خزنة_ناعم(tx, حركة.id);

  const أطراف = [...new Set(قيود.map((q) => q.partyId))];
  for (const partyId of أطراف) await أعد_حساب_سلسلة_الطرف(tx, partyId);

  const حسابات = [...new Set(حركات.map((h) => h.accountId))];
  for (const accountId of حسابات) await أعد_حساب_حساب_الخزنة(tx, accountId);

  await tx.splitPayment.update({ where: { id: معرف_المجموعة }, data: { deletedAt: new Date() } });
}

/**
 * حذف دفع مباشر بالكامل: قيد العميل + قيد المورد + حركة الخزنة — يعكس كل الأرصدة.
 */
export async function حذف_دفع_مباشر(tx: عميل_معاملة, معرف_الدفع_المباشر: number) {
  const قيود = await tx.ledgerEntry.findMany({
    where: { directPaymentId: معرف_الدفع_المباشر, deletedAt: null },
    select: { id: true, partyId: true },
  });
  const حركات = await tx.treasuryTxn.findMany({
    where: { directPaymentId: معرف_الدفع_المباشر, deletedAt: null },
    select: { id: true, accountId: true },
  });

  for (const قيد of قيود) await احذف_قيد_ناعم(tx, قيد.id);
  for (const حركة of حركات) await احذف_حركة_خزنة_ناعم(tx, حركة.id);

  const أطراف = [...new Set(قيود.map((q) => q.partyId))];
  for (const partyId of أطراف) await أعد_حساب_سلسلة_الطرف(tx, partyId);

  const حسابات = [...new Set(حركات.map((h) => h.accountId))];
  for (const accountId of حسابات) await أعد_حساب_حساب_الخزنة(tx, accountId);
}
