import { redirect } from "next/navigation";
import { المستخدم_الحالي } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { تسمية_حالة_الشيك } from "@/lib/enums";
import { زر_طباعة_التقرير } from "./print-btn";

export const metadata = { title: "تقرير معاملة الشيكات — سُكر" };
export const dynamic = "force-dynamic";

const نص_مبلغ = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const نص_يوم = (d: Date | null) => (d ? new Intl.DateTimeFormat("en-GB", { day: "2-digit", month: "2-digit", year: "numeric" }).format(d) : "—");

export default async function صفحة_تقرير_المعاملة({ searchParams }: { searchParams: { ids?: string; party?: string; type?: string } }) {
  const م = await المستخدم_الحالي();
  if (!م) redirect("/login");

  const معرفات = (searchParams.ids ?? "").split(",").map((s) => Number(s.trim())).filter((n) => Number.isFinite(n) && n > 0);
  const مورد_سياق = searchParams.type === "SUPPLIER";

  const شيكات = معرفات.length
    ? await prisma.cheque.findMany({
        where: { id: { in: معرفات } },
        orderBy: { dueDate: "asc" },
        select: {
          id: true, chequeNumber: true, amount: true, dueDate: true, bankName: true, status: true,
          drawerName: true, transferredFrom: true, endorsedAt: true,
          party: { select: { name: true } }, endorsedTo: { select: { name: true } },
        },
      })
    : [];

  const اسم_الطرف = searchParams.party
    ? (await prisma.party.findUnique({ where: { id: Number(searchParams.party) }, select: { name: true } }))?.name ?? null
    : null;

  const إجمالي = شيكات.reduce((س, ش) => س + Number(ش.amount), 0);

  return (
    <div dir="rtl" className="mx-auto max-w-4xl bg-white p-8 text-[#111827]">
      <style>{`@media print { .no-print { display:none !important } body { background:#fff } @page { margin: 14mm } }`}</style>

      <div className="mb-6 flex items-start justify-between border-b-2 border-[#1F3864] pb-4">
        <div>
          <h1 className="text-2xl font-bold text-[#1F3864]">تقرير معاملة الشيكات</h1>
          <p className="mt-1 text-sm text-gray-600">
            {مورد_سياق ? "شيكات مُظهَّرة للمورد" : "شيكات مستلَمة من العميل"}
            {اسم_الطرف ? ` — ${اسم_الطرف}` : ""}
          </p>
        </div>
        <div className="text-left text-xs text-gray-500">
          <div>سُكر — نظام إدارة الأعمال</div>
          <div>تاريخ الإصدار: {نص_يوم(new Date())}</div>
          <div>بواسطة: {م.name}</div>
        </div>
      </div>

      <div className="mb-5 grid grid-cols-2 gap-3 sm:grid-cols-3">
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="text-xs text-gray-500">عدد الشيكات</div>
          <div className="text-lg font-bold ltr-nums">{شيكات.length}</div>
        </div>
        <div className="rounded-lg border border-gray-200 bg-gray-50 p-3">
          <div className="text-xs text-gray-500">إجمالي القيمة</div>
          <div className="text-lg font-bold ltr-nums">{نص_مبلغ(إجمالي)} ج.م</div>
        </div>
      </div>

      <table className="w-full border-collapse text-sm">
        <thead>
          <tr className="bg-[#1F3864] text-white">
            <th className="border border-gray-300 px-2 py-2 text-start font-medium">#</th>
            <th className="border border-gray-300 px-2 py-2 text-start font-medium">رقم الشيك</th>
            <th className="border border-gray-300 px-2 py-2 text-start font-medium">المدين / محوّل من</th>
            <th className="border border-gray-300 px-2 py-2 text-start font-medium">البنك</th>
            <th className="border border-gray-300 px-2 py-2 text-start font-medium">الاستحقاق</th>
            <th className="border border-gray-300 px-2 py-2 text-start font-medium">الحالة</th>
            {مورد_سياق && <th className="border border-gray-300 px-2 py-2 text-start font-medium">تاريخ التظهير</th>}
            <th className="border border-gray-300 px-2 py-2 text-end font-medium">المبلغ</th>
          </tr>
        </thead>
        <tbody>
          {شيكات.map((ش, i) => (
            <tr key={ش.id} className="odd:bg-white even:bg-gray-50">
              <td className="border border-gray-300 px-2 py-1.5 text-gray-500">{i + 1}</td>
              <td className="border border-gray-300 px-2 py-1.5 ltr-nums">{ش.chequeNumber || "—"}</td>
              <td className="border border-gray-300 px-2 py-1.5">{ش.transferredFrom || ش.party?.name || ش.drawerName}</td>
              <td className="border border-gray-300 px-2 py-1.5">{ش.bankName || "—"}</td>
              <td className="border border-gray-300 px-2 py-1.5 ltr-nums">{نص_يوم(ش.dueDate)}</td>
              <td className="border border-gray-300 px-2 py-1.5">{تسمية_حالة_الشيك[ش.status] ?? ش.status}</td>
              {مورد_سياق && <td className="border border-gray-300 px-2 py-1.5 ltr-nums">{نص_يوم(ش.endorsedAt)}</td>}
              <td className="border border-gray-300 px-2 py-1.5 text-end ltr-nums">{نص_مبلغ(Number(ش.amount))}</td>
            </tr>
          ))}
        </tbody>
        <tfoot>
          <tr className="bg-gray-100 font-bold">
            <td className="border border-gray-300 px-2 py-2" colSpan={مورد_سياق ? 7 : 6}>الإجمالي</td>
            <td className="border border-gray-300 px-2 py-2 text-end ltr-nums">{نص_مبلغ(إجمالي)} ج.م</td>
          </tr>
        </tfoot>
      </table>

      <div className="mt-6 flex justify-end">
        <زر_طباعة_التقرير />
      </div>
    </div>
  );
}
