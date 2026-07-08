import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { المستخدم_الحالي } from "@/lib/session";
import { تنسيق_مبلغ } from "@/lib/money";

export const dynamic = "force-dynamic";

type عنصر = { id: number; عنوان: string; وصف: string; رابط: string };
type مجموعة = { النوع: string; العناصر: عنصر[] };

/** بحث موحّد عبر العملاء/الموردين/الفواتير/الشيكات/حركات الخزنة. */
export async function GET(req: Request) {
  const م = await المستخدم_الحالي();
  if (!م) return NextResponse.json({ خطأ: "غير مصرّح" }, { status: 401 });

  const q = new URL(req.url).searchParams.get("q")?.trim() ?? "";
  if (q.length < 1) return NextResponse.json({ المجموعات: [] });
  const حد = 6;
  const رقمي = /^\d+$/.test(q);
  const c = { contains: q, mode: "insensitive" as const };

  const [عملاء, موردون, فواتير, شيكات, حركات] = await Promise.all([
    prisma.party.findMany({
      where: { type: "CUSTOMER", OR: [{ name: c }, { phone: c }] },
      take: حد,
    }),
    prisma.party.findMany({
      where: { type: "SUPPLIER", OR: [{ name: c }, { phone: c }] },
      take: حد,
    }),
    prisma.invoice.findMany({
      where: {
        OR: [
          ...(رقمي ? [{ number: Number(q) }] : []),
          { customer: { name: c } },
        ],
      },
      include: { customer: { select: { name: true } } },
      take: حد,
      orderBy: { number: "desc" },
    }),
    prisma.cheque.findMany({
      where: {
        OR: [{ drawerName: c }, { bankName: c }, { beneficiary: c }, { chequeNumber: c }],
      },
      take: حد,
      orderBy: { dueDate: "asc" },
    }),
    prisma.treasuryTxn.findMany({
      where: { OR: [{ description: c }, { party: { name: c } }] },
      include: { party: { select: { name: true } } },
      take: حد,
      orderBy: { date: "desc" },
    }),
  ]);

  const المجموعات: مجموعة[] = [];
  if (عملاء.length)
    المجموعات.push({
      النوع: "العملاء",
      العناصر: عملاء.map((p) => ({ id: p.id, عنوان: p.name, وصف: p.phone ?? "", رابط: `/customers/${p.id}` })),
    });
  if (موردون.length)
    المجموعات.push({
      النوع: "الموردون",
      العناصر: موردون.map((p) => ({ id: p.id, عنوان: p.name, وصف: p.phone ?? "", رابط: `/suppliers/${p.id}` })),
    });
  if (فواتير.length)
    المجموعات.push({
      النوع: "الفواتير",
      العناصر: فواتير.map((f) => ({
        id: f.id,
        عنوان: `فاتورة ${String(f.number).padStart(7, "0")}`,
        وصف: `${f.customer?.name ?? "عميل نقدي"} — ${تنسيق_مبلغ(f.totalAmount)}`,
        رابط: `/invoices/${f.id}`,
      })),
    });
  if (شيكات.length)
    المجموعات.push({
      النوع: "الشيكات",
      العناصر: شيكات.map((ch) => ({
        id: ch.id,
        عنوان: ch.drawerName,
        وصف: `${ch.bankName ?? ""} — ${تنسيق_مبلغ(ch.amount)}`,
        رابط: `/cheques`,
      })),
    });
  if (حركات.length)
    المجموعات.push({
      النوع: "حركات الخزنة",
      العناصر: حركات.map((t) => ({
        id: t.id,
        عنوان: t.description,
        وصف: `${t.party?.name ?? ""} — ${تنسيق_مبلغ(t.amount)}`,
        رابط: `/treasury`,
      })),
    });

  return NextResponse.json({ المجموعات });
}
