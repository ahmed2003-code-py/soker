import { redirect, notFound } from "next/navigation";
import { المستخدم_الحالي } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { المخزن_مفعّل } from "@/lib/flags";
import { اجلب_أرصدة_المخزن } from "@/lib/stock";
import { شاشة_المخزن } from "./client";

export const metadata = { title: "المخزن — سُكر" };
export const dynamic = "force-dynamic";

export default async function صفحة_المخزن({ searchParams }: { searchParams: { q?: string } }) {
  const م = await المستخدم_الحالي();
  if (!م) redirect("/login");
  // المخزن مقفول من الإعدادات — الصفحة نفسها مش موجودة لحد ما يتفعّل
  if (!(await المخزن_مفعّل())) notFound();

  const بحث = searchParams.q?.trim() || "";
  const [أرصدة, حدود, موردون, لطات_الكتالوج, قوائم] = await Promise.all([
    اجلب_أرصدة_المخزن(بحث),
    prisma.stockMinimum.findMany({ orderBy: [{ category: "asc" }, { color: "asc" }] }),
    prisma.party.findMany({ where: { type: "SUPPLIER", archivedAt: null }, select: { id: true, name: true }, orderBy: { name: "asc" } }),
    prisma.lot.findMany({ select: { company: true, category: true, color: true } }),
    prisma.setting.findMany({ where: { key: { in: ["قائمة_التصنيفات", "قائمة_الشركات"] } } }),
  ]);

  // قوائم الاقتراح عند إضافة رصيد: الموجود في المخزن + قوائم الفواتير المحفوظة
  const اقرأ = (مفتاح: string): string[] => {
    try { return JSON.parse(قوائم.find((x) => x.key === مفتاح)?.value ?? "[]") as string[]; } catch { return []; }
  };
  const الكتالوج = {
    شركات: [...new Set([...لطات_الكتالوج.map((l) => l.company).filter(Boolean) as string[], ...اقرأ("قائمة_الشركات")])].sort(),
    أصناف: [...new Set([...لطات_الكتالوج.map((l) => l.category), ...اقرأ("قائمة_التصنيفات")])].sort(),
    ألوان: [...new Set(لطات_الكتالوج.map((l) => l.color))].sort(),
  };

  return (
    <div>
      <ترويسة_الصفحة
        العنوان="المخزن"
        الوصف="رصيد كل صنف ولون ولط — الوارد من فواتير الشراء والصادر من فواتير البيع"
      />
      <شاشة_المخزن
        الأرصدة={أرصدة}
        البحث={بحث}
        الحدود={حدود.map((h) => ({
          id: h.id, التصنيف: h.category, اللون: h.color,
          الكمية: Number(h.minQty), الوزن: Number(h.minWeight),
        }))}
        الموردون={موردون}
        الكتالوج={الكتالوج}
      />
    </div>
  );
}
