import type { PrismaClient } from "@prisma/client";
import { prisma as عميل_افتراضي } from "@/lib/prisma";
import { تسمية_حساب_الخزنة } from "@/lib/enums";

export type دفعة_تسوية_شيك = {
  نوع: "خزنة" | "شيك" | "عميل";
  id: number;
  المبلغ: number;
  الطريقة: string | null;
  التاريخ: string; // ISO
  البيان: string;
};

/**
 * بيانات «تقرير تسوية شيك صادر على دفعات» — كل الدفعات (خزنة/شيك وارد/تحويل عميل)
 * التي موّلت تسوية شيك صادر بعينه، مقسّمة إلى «دفعات اليوم» و«دفعات سابقة».
 */
export async function اجلب_تقرير_تسوية_شيك(معرف_الشيك: number, p: PrismaClient = عميل_افتراضي) {
  const [شيك, دفعات, شيكات_ممولة, تحويلات_عملاء] = await Promise.all([
    p.cheque.findUnique({
      where: { id: معرف_الشيك },
      select: {
        id: true, amount: true, chequeNumber: true, bankName: true, dueDate: true, status: true,
        drawerName: true, party: { select: { name: true } },
      },
    }),
    p.treasuryTxn.findMany({
      where: { chequeId: معرف_الشيك, deletedAt: null },
      orderBy: { date: "asc" },
      select: {
        id: true, amount: true, method: true, date: true, description: true,
        account: { select: { type: true } }, subAccount: { select: { name: true } },
      },
    }),
    p.cheque.findMany({
      where: { settlesChequeId: معرف_الشيك },
      orderBy: { dueDate: "asc" },
      select: { id: true, amount: true, chequeNumber: true, bankName: true, drawerName: true, dueDate: true, party: { select: { name: true } } },
    }),
    p.ledgerEntry.findMany({
      where: { chequeSettlementId: معرف_الشيك, deletedAt: null },
      orderBy: { date: "asc" },
      select: { id: true, credit: true, date: true, description: true, party: { select: { name: true } } },
    }),
  ]);
  if (!شيك) return null;

  const دفعات_خزنة: دفعة_تسوية_شيك[] = دفعات.map((د) => ({
    نوع: "خزنة",
    id: د.id,
    المبلغ: Number(د.amount),
    الطريقة: [د.method || تسمية_حساب_الخزنة[د.account.type], د.subAccount?.name].filter(Boolean).join(" — "),
    التاريخ: د.date.toISOString(),
    البيان: د.description,
  }));
  const دفعات_شيك: دفعة_تسوية_شيك[] = شيكات_ممولة.map((ش) => ({
    نوع: "شيك",
    id: ش.id,
    المبلغ: Number(ش.amount),
    الطريقة: "شيك وارد",
    التاريخ: ش.dueDate.toISOString(),
    البيان: `شيك وارد${ش.chequeNumber ? " رقم " + ش.chequeNumber : ""} — ${ش.party?.name ?? ش.drawerName ?? ""}`,
  }));
  const دفعات_عملاء: دفعة_تسوية_شيك[] = تحويلات_عملاء.map((ق) => ({
    نوع: "عميل",
    id: ق.id,
    المبلغ: Number(ق.credit),
    الطريقة: `تحويل من عميل — ${ق.party?.name ?? "عميل"}`,
    التاريخ: ق.date.toISOString(),
    البيان: ق.description,
  }));

  const الدفعات = [...دفعات_خزنة, ...دفعات_شيك, ...دفعات_عملاء].sort((a, b) => a.التاريخ.localeCompare(b.التاريخ));
  const اليوم = new Date().toISOString().slice(0, 10);
  const دفعات_اليوم = الدفعات.filter((د) => د.التاريخ.slice(0, 10) === اليوم);
  const دفعات_سابقة = الدفعات.filter((د) => د.التاريخ.slice(0, 10) !== اليوم).reverse(); // الأحدث أولاً
  const المُسدَّد = الدفعات.reduce((س, د) => س + د.المبلغ, 0);

  return {
    شيك: {
      id: شيك.id,
      المبلغ: Number(شيك.amount),
      رقم_الشيك: شيك.chequeNumber,
      اسم_البنك: شيك.bankName,
      تاريخ_الاستحقاق: شيك.dueDate.toISOString(),
      الحالة: شيك.status,
      اسم_المستفيد: شيك.party?.name ?? شيك.drawerName ?? "—",
    },
    دفعات_اليوم,
    دفعات_سابقة,
    إجمالي_اليوم: دفعات_اليوم.reduce((س, د) => س + د.المبلغ, 0),
    إجمالي_سابق: دفعات_سابقة.reduce((س, د) => س + د.المبلغ, 0),
    المُسدَّد,
    المتبقي: Number(شيك.amount) - المُسدَّد,
  };
}
