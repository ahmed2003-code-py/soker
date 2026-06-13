import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { نص_مبلغ } from "@/components/money-text";
import { نص_تاريخ } from "@/components/date-text";
import { سطر_المساءلة } from "@/components/accountability-line";
import { تفقيط } from "@/lib/tafqit";
import { جمّع_حسب_التصنيف } from "@/lib/invoice";
import { شريط_إجراءات_الفاتورة } from "./actions-bar";

export const metadata = { title: "عرض فاتورة — سُكر" };

export default async function صفحة_عرض_فاتورة({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const [فاتورة, إعدادات] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: {
        customer: true,
        lines: { orderBy: { id: "asc" } },
        createdBy: { select: { name: true } },
        updatedBy: { select: { name: true } },
      },
    }),
    prisma.setting.findMany({ where: { key: { in: ["اسم_الشركة", "شعار_الشركة"] } } }),
  ]);
  if (!فاتورة) notFound();

  const اسم_الشركة = إعدادات.find((s) => s.key === "اسم_الشركة")?.value || "مؤسسة سكر";
  const شعار = إعدادات.find((s) => s.key === "شعار_الشركة")?.value || "";
  const رقم = String(فاتورة.number).padStart(7, "0");
  const تجميع = جمّع_حسب_التصنيف(
    فاتورة.lines.map((l) => ({ التصنيف: l.category, الكمية: l.qty, الوزن: l.weight }))
  );

  return (
    <div>
      <شريط_إجراءات_الفاتورة المعرف={فاتورة.id} الرقم={فاتورة.number} />

      {/* ورقة الفاتورة (قابلة للطباعة) */}
      <div className="mx-auto max-w-3xl card-soft p-8 print:border-0 print:shadow-none">
        <div className="flex items-start justify-between border-b-2 border-primary pb-4">
          <div className="flex items-center gap-3">
            {شعار ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img src={شعار} alt="الشعار" className="h-16 w-16 object-contain" />
            ) : null}
            <div>
              <h1 className="text-2xl font-bold text-primary">{اسم_الشركة}</h1>
              <p className="text-sm text-muted-foreground">فاتورة مبيعات</p>
            </div>
          </div>
          <div className="text-end">
            <p className="text-sm text-muted-foreground">رقم الفاتورة</p>
            <p className="ltr-nums text-xl font-bold">{رقم}</p>
            <p className="mt-1 text-sm">
              التاريخ: <نص_تاريخ القيمة={فاتورة.date} />
            </p>
          </div>
        </div>

        <div className="my-4 flex flex-wrap gap-x-8 gap-y-1 text-sm">
          <span>العميل: <span className="font-semibold">{فاتورة.customer.name}</span></span>
          <span>الهاتف: <span className="ltr-nums">{فاتورة.phone || فاتورة.customer.phone || "—"}</span></span>
        </div>

        <table className="w-full border-collapse text-sm">
          <thead>
            <tr className="bg-appgray text-muted-foreground">
              <th className="border border-border p-2 text-start">اللون / البيان</th>
              <th className="border border-border p-2 text-start">التصنيف</th>
              <th className="border border-border p-2 text-end">العدد</th>
              <th className="border border-border p-2 text-end">الوزن (كجم)</th>
              <th className="border border-border p-2 text-end">السعر/كجم</th>
              <th className="border border-border p-2 text-end">المجموع</th>
            </tr>
          </thead>
          <tbody>
            {فاتورة.lines.map((l) => (
              <tr key={l.id}>
                <td className="border border-border p-2">{l.color}</td>
                <td className="border border-border p-2">{l.category}</td>
                <td className="border border-border p-2 text-end ltr-nums">{Number(l.qty)}</td>
                <td className="border border-border p-2 text-end ltr-nums">{Number(l.weight)}</td>
                <td className="border border-border p-2 text-end ltr-nums">
                  {l.price != null ? Number(l.price).toLocaleString("en-US", { minimumFractionDigits: 2 }) : "—"}
                </td>
                <td className="border border-border p-2 text-end ltr-nums">
                  {Number(l.lineTotal).toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        {/* ملخص التجميع */}
        <div className="mt-4 grid gap-4 sm:grid-cols-2">
          <div>
            <h3 className="mb-2 font-semibold">ملخص حسب التصنيف</h3>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-appgray text-muted-foreground">
                  <th className="border border-border p-1.5 text-start">التصنيف</th>
                  <th className="border border-border p-1.5 text-end">العدد</th>
                  <th className="border border-border p-1.5 text-end">الوزن</th>
                </tr>
              </thead>
              <tbody>
                {تجميع.map((g) => (
                  <tr key={g.التصنيف}>
                    <td className="border border-border p-1.5">{g.التصنيف}</td>
                    <td className="border border-border p-1.5 text-end ltr-nums">{Number(g.الكمية)}</td>
                    <td className="border border-border p-1.5 text-end ltr-nums">{Number(g.الوزن)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <div className="space-y-2">
            <div className="flex justify-between"><span className="text-muted-foreground">إجمالي العدد</span><span className="ltr-nums">{Number(فاتورة.totalQty)}</span></div>
            <div className="flex justify-between"><span className="text-muted-foreground">إجمالي الوزن</span><span className="ltr-nums">{Number(فاتورة.totalWeight)} كجم</span></div>
            <div className="flex items-center justify-between rounded-lg bg-primary/5 p-3 text-lg">
              <span className="font-bold">الإجمالي</span>
              <نص_مبلغ القيمة={فاتورة.totalAmount} />
            </div>
            <p className="text-sm text-muted-foreground">
              فقط وقدره: {تفقيط(Number(فاتورة.totalAmount))}
            </p>
          </div>
        </div>

        {فاتورة.notes && (
          <p className="mt-4 text-sm text-muted-foreground">ملاحظات: {فاتورة.notes}</p>
        )}

        <div className="mt-6 border-t border-border pt-3 no-print">
          <سطر_المساءلة
            أنشأ={فاتورة.createdBy?.name}
            تاريخ_الإنشاء={فاتورة.createdAt}
            عدّل={فاتورة.updatedBy?.name}
            تاريخ_التعديل={فاتورة.updatedById ? فاتورة.updatedAt : null}
          />
        </div>
      </div>
    </div>
  );
}
