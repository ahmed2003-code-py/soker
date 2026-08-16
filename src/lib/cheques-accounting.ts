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
  if (شيك.direction === "OUTGOING") {
    // مرآة الوارد: مسموح التعديل طالما الشيك «مسلَّم» فقط (أثر المورد يُعاد ضبطه)؛
    // مقفول بعد الصرف من البنك أو التسوية على دفعات أو الإلغاء.
    return شيك.collectedTxnId != null ||
      (["DEPOSITED", "COLLECTED", "SETTLED", "CANCELLED"] as ChequeStatus[]).includes(شيك.status);
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
  // ── شيك افتتاحي (محسوب ضمن الرصيد الافتتاحي) ──
  isOpening?: boolean | null;
  /** الحالة التي دخل بها الشيك الافتتاحي (خط الأساس) — لا تُنشئ أثراً، بل تُعرّف نقطة البداية. */
  openingBaseline?: ChequeStatus | null;
  /** حساب الخزنة الذي «افتُرض» أن الشيك الافتتاحي فيه وقت البداية (لعكسه عند خروجه). */
  openingAccountId?: number | null;
  openingSubAccountId?: number | null;
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
  // النموذج الجديد (v2) للشيكات الواردة فقط — الواردة القديمة تُبقي منطق v1
  if ((شيك.accountingVersion ?? 1) >= 2 && شيك.direction === "INCOMING") {
    return زامن_آثار_الشيك_v2(tx, شيك, الحالة_الهدف, خيارات ?? {}, فاعل);
  }
  // الشيكات الصادرة: نموذج الدلتا (مرآة الوارد) — يدعم الشيك الافتتاحي، ومطابق لـ v1 للشيك العادي
  if (شيك.direction === "OUTGOING") {
    return زامن_آثار_الشيك_صادر(tx, شيك, الحالة_الهدف, خيارات ?? {}, فاعل);
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
 * «مواقع القيمة» لكل حالة شيك وارد (نموذج الدلتا الموحّد).
 * لكل حالة نُعرّف أين تقع قيمة الشيك V على ثلاثة محاور (كل قيمة ∈ {−1، 0، +1}):
 *  • عميل: −1 = دين العميل مخصوم (استلمنا منه) ← قيد دائن؛  +1 = دينه راجع ← قيد مدين.
 *  • خزنة: +1 = فلوس داخلة الخزنة/البنك ← إيراد؛  −1 = خارجة ← مصروف.
 *  • مورد: −1 = مستحق المورد مخصوم (ظهّرناه له) ← قيد مدين؛  +1 = مستحقه راجع ← قيد دائن.
 * الشيك «العادي» خط أساسه = كل الأصفار (يبدأ من الصفر). الشيك «الافتتاحي» خط أساسه = مواقع
 * حالة الدخول (openingBaseline) لأن هذه الآثار مُحتسَبة سلفاً ضمن الرصيد الافتتاحي — فلا تُنشأ.
 * الدلتا = مواقع(الهدف) − مواقع(الأساس)، وهي وحدها ما يُترجَم لقيود/حركات فعلية.
 */
function مواقع_حالة_وارد(حالة: ChequeStatus): { عميل: number; خزنة: number; مورد: number } {
  switch (حالة) {
    case "REGISTERED": return { عميل: -1, خزنة: 0, مورد: 0 };
    case "DEPOSITED":  return { عميل: -1, خزنة: 1, مورد: 0 };
    case "COLLECTED":  return { عميل: -1, خزنة: 1, مورد: 0 };
    case "ENDORSED":   return { عميل: -1, خزنة: 0, مورد: -1 };
    case "BOUNCED":    return { عميل: 0, خزنة: 0, مورد: 0 };
    case "CANCELLED":  return { عميل: 0, خزنة: 0, مورد: 0 };
    default:           return { عميل: 0, خزنة: 0, مورد: 0 };
  }
}

/**
 * «مواقع القيمة» لكل حالة شيك صادر (نفس نموذج الدلتا — مرآة الوارد). محوران لكل حالة (∈ {−1، 0، +1}):
 *  • مورد: +1 = مستحق المورد مخصوم (سلّمناه الشيك) ← قيد مدين؛  −1 = مستحقه راجع ← قيد دائن.
 *  • خزنة: −1 = فلوس خارجة (صرف الشيك من البنك) ← مصروف؛  +1 = راجعة للخزنة ← إيراد.
 * الشيك «العادي» خط أساسه = كل الأصفار ⇒ سلوكه مطابق تماماً للنموذج القديم (v1). الشيك «الافتتاحي»
 * خط أساسه = مواقع حالة الدخول (openingBaseline) لأن أثره محتسَب سلفاً ضمن الرصيد الافتتاحي.
 * ملاحظة: SETTLED (تسوية على دفعات) لها نفس مواقع «مسلَّم» — الدفعات نفسها حركات خزنة مستقلة.
 */
function مواقع_حالة_صادر(حالة: ChequeStatus): { مورد: number; خزنة: number } {
  switch (حالة) {
    case "PENDING":   return { مورد: 1, خزنة: 0 };
    case "DEPOSITED": return { مورد: 1, خزنة: 0 };
    case "ENDORSED":  return { مورد: 1, خزنة: 0 };
    case "SETTLED":   return { مورد: 1, خزنة: 0 };
    case "COLLECTED": return { مورد: 1, خزنة: -1 }; // صُرف من البنك
    default:          return { مورد: 0, خزنة: 0 };  // REGISTERED / BOUNCED / CANCELLED
  }
}

/** إشارة قيد دفتر أستاذ قائم: +1 مدين، −1 دائن، 0 غير موجود/محذوف. */
async function إشارة_قيد(tx: Prisma.TransactionClient, id: number | null): Promise<number> {
  if (!id) return 0;
  const q = await tx.ledgerEntry.findUnique({ where: { id }, select: { debit: true, credit: true, deletedAt: true } });
  if (!q || q.deletedAt) return 0;
  if (Number(q.debit) > 0) return 1;
  if (Number(q.credit) > 0) return -1;
  return 0;
}

/** إشارة حركة خزنة قائمة: +1 إيراد، −1 مصروف، 0 غير موجود/محذوف. */
async function إشارة_حركة(tx: Prisma.TransactionClient, id: number | null): Promise<number> {
  if (!id) return 0;
  const h = await tx.treasuryTxn.findUnique({ where: { id }, select: { kind: true, deletedAt: true } });
  if (!h || h.deletedAt) return 0;
  return h.kind === TxnKind.INCOME ? 1 : h.kind === TxnKind.EXPENSE ? -1 : 0;
}

/**
 * النموذج الجديد v2 — الشيكات الواردة فقط (نموذج «خزنة الشيكات») بمنطق الدلتا الموحّد.
 * يوحّد الشيك العادي والافتتاحي: نحسب الدلتا بين مواقع الحالة الهدف ومواقع خط الأساس، ثم نوفّق
 * ثلاثة آثار مستقلة (idempotent) مع تلك الدلتا. للشيك العادي (خط أساس = أصفار) يُنتج نفس سلوك v2
 * السابق تماماً؛ للشيك الافتتاحي لا يُنشئ أثراً عند الدخول (الدلتا = صفر) ويُنشئ حركات حقيقية فقط
 * عند الانتقالات اللاحقة (مثلاً: تحصيل ← إيراد، ارتداد ← يرجع دين العميل + يخرج من البنك).
 */
async function زامن_آثار_الشيك_v2(
  tx: Prisma.TransactionClient,
  شيك: شيك_للمزامنة,
  الحالة_الهدف: ChequeStatus,
  خيارات: خيارات_مزامنة,
  فاعل: number
): Promise<void> {
  const V = شيك.amount;
  const وصف = `شيك وارد${شيك.isOpening ? " افتتاحي" : ""}${شيك.chequeNumber ? " رقم " + شيك.chequeNumber : ""}`;
  const أساس = شيك.isOpening && شيك.openingBaseline
    ? مواقع_حالة_وارد(شيك.openingBaseline)
    : { عميل: 0, خزنة: 0, مورد: 0 };
  const هدف = مواقع_حالة_وارد(الحالة_الهدف);
  const دلتا = { عميل: هدف.عميل - أساس.عميل, خزنة: هدف.خزنة - أساس.خزنة, مورد: هدف.مورد - أساس.مورد };

  let معرف_قيد_الطرف = شيك.partyLedgerEntryId;
  let معرف_قيد_التظهير = شيك.endorseLedgerEntryId;
  let مظهَّر_لـ = شيك.endorsedToId;
  let معرف_حركة_التحصيل = شيك.collectedTxnId;

  // ── 1) أثر العميل (partyLedgerEntryId): دلتا.عميل ∈ {−1: دائن (يقل دينه)، +1: مدين (يرجع دينه)} ──
  if (شيك.partyId) {
    const إشارة_حالية = await إشارة_قيد(tx, معرف_قيد_الطرف);
    if (إشارة_حالية !== دلتا.عميل) {
      if (معرف_قيد_الطرف) { await احذف_قيد_ناعم(tx, معرف_قيد_الطرف); معرف_قيد_الطرف = null; }
      if (دلتا.عميل !== 0) {
        const قيد = await أضف_قيد(tx, {
          معرف_الطرف: شيك.partyId,
          التاريخ: new Date(),
          البيان: `${وصف} — ${دلتا.عميل < 0 ? "استلام من العميل" : "ارتداد/إلغاء — يرجع دين العميل"}`,
          دائن: دلتا.عميل < 0 ? V : 0,
          مدين: دلتا.عميل > 0 ? V : 0,
          أنشأ: فاعل,
        });
        معرف_قيد_الطرف = قيد.id;
      }
    }
  }

  // ── 2) أثر المورد/التظهير (endorseLedgerEntryId): دلتا.مورد ∈ {−1: مدين (تظهير)، +1: دائن (يرجع مستحقه)} ──
  const مورد_الهدف = الحالة_الهدف === "ENDORSED"
    ? (خيارات.معرف_المورد_للتظهير ?? شيك.endorsedToId ?? null)
    : (شيك.endorsedToId ?? null); // للعكس نستخدم المورد المُخزَّن سابقاً (أو الأساس الافتتاحي)
  {
    const إشارة_حالية = await إشارة_قيد(tx, معرف_قيد_التظهير);
    if (إشارة_حالية !== دلتا.مورد) {
      if (معرف_قيد_التظهير) { await احذف_قيد_ناعم(tx, معرف_قيد_التظهير); معرف_قيد_التظهير = null; }
      if (دلتا.مورد !== 0 && مورد_الهدف) {
        const قيد = await أضف_قيد(tx, {
          معرف_الطرف: مورد_الهدف,
          التاريخ: new Date(),
          البيان: `${وصف} — ${دلتا.مورد < 0 ? "تظهير سداداً للمورد" : "ارتداد التظهير — يرجع مستحق المورد"}`,
          مدين: دلتا.مورد < 0 ? V : 0,
          دائن: دلتا.مورد > 0 ? V : 0,
          أنشأ: فاعل,
        });
        معرف_قيد_التظهير = قيد.id;
      }
    }
  }
  // «مظهَّر لـ» يبقى مسجّلاً طالما الشيك عند المورد (هدف مظهّر، أو افتتاحي خط أساسه مظهّر ولم يخرج)
  مظهَّر_لـ = (الحالة_الهدف === "ENDORSED" || (شيك.isOpening && شيك.openingBaseline === "ENDORSED"))
    ? مورد_الهدف
    : شيك.endorsedToId;

  // ── 3) أثر الخزنة/البنك (collectedTxnId): دلتا.خزنة ∈ {+1: إيراد (داخل)، −1: مصروف (خارج)} ──
  {
    const إشارة_حالية = await إشارة_حركة(tx, معرف_حركة_التحصيل);
    if (إشارة_حالية !== دلتا.خزنة) {
      if (معرف_حركة_التحصيل) { await احذف_حركة_خزنة_ناعم(tx, معرف_حركة_التحصيل); معرف_حركة_التحصيل = null; }
      if (دلتا.خزنة !== 0) {
        let معرف_الحساب: number | null;
        let معرف_فرعي: number | null = null;
        if (دلتا.خزنة > 0) {
          // فلوس داخلة: مودع/محصّل ← الحساب المختار (بنك للإيداع، نقدي للتحصيل افتراضياً)
          if (الحالة_الهدف === "DEPOSITED") {
            معرف_الحساب = خيارات.معرف_حساب_التحصيل ??
              (await tx.treasuryAccount.findFirst({ where: { type: TreasuryAccountType.BANK }, select: { id: true } }))?.id ?? null;
            معرف_فرعي = خيارات.معرف_حساب_فرعي ?? null;
          } else {
            معرف_الحساب = خيارات.معرف_حساب_التحصيل ??
              (await tx.treasuryAccount.findFirst({ where: { type: TreasuryAccountType.CASH }, select: { id: true } }))?.id ?? null;
            معرف_فرعي = خيارات.معرف_حساب_فرعي ?? null;
          }
        } else {
          // فلوس خارجة (عكس أثر افتتاحي مُحتسَب سلفاً): من الحساب الذي كان الشيك فيه وقت البداية
          معرف_الحساب = شيك.openingAccountId ??
            (await tx.treasuryAccount.findFirst({ where: { type: TreasuryAccountType.BANK }, select: { id: true } }))?.id ?? null;
          معرف_فرعي = شيك.openingSubAccountId ?? null;
        }
        if (!معرف_الحساب) throw new Error("لا يوجد حساب خزنة للتحصيل");
        const حركة = await أضف_حركة_خزنة(tx, {
          التاريخ: new Date(),
          النوع: دلتا.خزنة > 0 ? TxnKind.INCOME : TxnKind.EXPENSE,
          المبلغ: V,
          معرف_الحساب,
          معرف_حساب_فرعي: معرف_فرعي,
          البيان: `${دلتا.خزنة > 0 ? (الحالة_الهدف === "DEPOSITED" ? "إيداع" : "تحصيل") : "خروج شيك افتتاحي مرتد"} ${وصف} — ${شيك.drawerName}`,
          اسم_الطرف_الخارجي: شيك.drawerName,
          أنشأ: فاعل,
        });
        معرف_حركة_التحصيل = حركة.id;
      }
    }
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

/**
 * الشيكات الصادرة بمنطق الدلتا الموحّد (مرآة v2 للوارد) — أثران مستقلان:
 *  1) أثر المورد (partyLedgerEntryId): مدين عند التسليم (يقل المستحق)، دائن عند الارتداد/الإلغاء (يرجع).
 *  2) أثر الخزنة (collectedTxnId): مصروف عند الصرف من البنك، وإيراد عند عكس صرف افتتاحي محتسَب سلفاً.
 * للشيك العادي (خط أساس = أصفار) النتيجة مطابقة للنموذج القديم؛ وللافتتاحي لا يُنشأ أثر عند الإدخال
 * (الدلتا = صفر) وتُنشأ حركات حقيقية فقط عند الانتقالات اللاحقة.
 */
async function زامن_آثار_الشيك_صادر(
  tx: Prisma.TransactionClient,
  شيك: شيك_للمزامنة,
  الحالة_الهدف: ChequeStatus,
  خيارات: خيارات_مزامنة,
  فاعل: number
): Promise<void> {
  const V = شيك.amount;
  const وصف = `شيك صادر${شيك.isOpening ? " افتتاحي" : ""}${شيك.chequeNumber ? " رقم " + شيك.chequeNumber : ""}`;
  const أساس = شيك.isOpening && شيك.openingBaseline
    ? مواقع_حالة_صادر(شيك.openingBaseline)
    : { مورد: 0, خزنة: 0 };
  const هدف = مواقع_حالة_صادر(الحالة_الهدف);
  const دلتا = { مورد: هدف.مورد - أساس.مورد, خزنة: هدف.خزنة - أساس.خزنة };

  let معرف_قيد_المورد = شيك.partyLedgerEntryId;
  let معرف_حركة_الصرف = شيك.collectedTxnId;

  // ── 1) أثر المورد: دلتا.مورد ∈ {+1: مدين (يقل المستحق)، −1: دائن (يرجع المستحق)} ──
  if (شيك.partyId) {
    const إشارة_حالية = await إشارة_قيد(tx, معرف_قيد_المورد);
    if (إشارة_حالية !== دلتا.مورد) {
      if (معرف_قيد_المورد) { await احذف_قيد_ناعم(tx, معرف_قيد_المورد); معرف_قيد_المورد = null; }
      if (دلتا.مورد !== 0) {
        const قيد = await أضف_قيد(tx, {
          معرف_الطرف: شيك.partyId,
          التاريخ: new Date(),
          البيان: `${وصف} — ${دلتا.مورد > 0 ? "تسليم للمورد" : "ارتداد/إلغاء — يرجع مستحق المورد"}`,
          مدين: دلتا.مورد > 0 ? V : 0,
          دائن: دلتا.مورد < 0 ? V : 0,
          أنشأ: فاعل,
        });
        معرف_قيد_المورد = قيد.id;
      }
    }
  }

  // ── 2) أثر الخزنة: دلتا.خزنة ∈ {−1: مصروف (صرف الشيك)، +1: إيراد (عكس صرف افتتاحي)} ──
  {
    const إشارة_حالية = await إشارة_حركة(tx, معرف_حركة_الصرف);
    if (إشارة_حالية !== دلتا.خزنة) {
      if (معرف_حركة_الصرف) { await احذف_حركة_خزنة_ناعم(tx, معرف_حركة_الصرف); معرف_حركة_الصرف = null; }
      if (دلتا.خزنة !== 0) {
        // فلوس خارجة: الحساب المختار (بنك افتراضياً). راجعة (عكس افتتاحي): الحساب الذي خرجت منه وقت البداية.
        const معرف_الحساب =
          (دلتا.خزنة < 0 ? خيارات.معرف_حساب_التحصيل : شيك.openingAccountId) ??
          (await tx.treasuryAccount.findFirst({ where: { type: TreasuryAccountType.BANK }, select: { id: true } }))?.id ??
          null;
        const معرف_فرعي = (دلتا.خزنة < 0 ? خيارات.معرف_حساب_فرعي : شيك.openingSubAccountId) ?? null;
        if (!معرف_الحساب) throw new Error("لا يوجد حساب خزنة للصرف");
        const حركة = await أضف_حركة_خزنة(tx, {
          التاريخ: new Date(),
          النوع: دلتا.خزنة < 0 ? TxnKind.EXPENSE : TxnKind.INCOME,
          المبلغ: V,
          معرف_الحساب,
          معرف_حساب_فرعي: معرف_فرعي,
          البيان: `${دلتا.خزنة < 0 ? "صرف" : "رجوع شيك صادر افتتاحي"} ${وصف} — ${شيك.drawerName}`,
          اسم_الطرف_الخارجي: شيك.drawerName,
          أنشأ: فاعل,
        });
        معرف_حركة_الصرف = حركة.id;
      }
    }
  }

  await tx.cheque.update({
    where: { id: شيك.id },
    data: {
      status: الحالة_الهدف,
      partyLedgerEntryId: معرف_قيد_المورد,
      collectedTxnId: معرف_حركة_الصرف,
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
