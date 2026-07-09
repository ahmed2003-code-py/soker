import { notFound } from "next/navigation";
import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { مترجم_الخادم } from "@/lib/i18n/server";
import { نموذج_فاتورة } from "../../form";
import { احصل_قوائم_الفواتير } from "../../actions";
import { تسمية_حساب_الخزنة } from "@/lib/enums";
import { اجلب_خريطة_حسابات_فرعية } from "@/app/(app)/treasury/sub-account-actions";

export const metadata = { title: "تعديل فاتورة — سُكر" };

export default async function صفحة_تعديل_فاتورة({ params }: { params: { id: string } }) {
  const id = Number(params.id);
  const { t } = مترجم_الخادم();
  const [فاتورة, عملاء, موردون, { تصنيفات, شركات }, حسابات, حسابات_فرعية] = await Promise.all([
    prisma.invoice.findUnique({
      where: { id },
      include: {
        lines: true,
        treasuryTxns: { where: { deletedAt: null }, select: { amount: true } },
      },
    }),
    prisma.party.findMany({
      where: { type: "CUSTOMER" },
      select: { id: true, name: true, phone: true, balance: true },
      orderBy: { name: "asc" },
    }),
    prisma.party.findMany({
      where: { type: "SUPPLIER" },
      select: { id: true, name: true, phone: true, balance: true },
      orderBy: { name: "asc" },
    }),
    احصل_قوائم_الفواتير(),
    prisma.treasuryAccount.findMany({ orderBy: { id: "asc" } }),
    اجلب_خريطة_حسابات_فرعية(),
  ]);
  if (!فاتورة) notFound();

  const نوع_الفاتورة = (فاتورة.invoiceType ?? "SALE") as "SALE" | "PURCHASE" | "SUPPLIER_RETURN";
  const هو_مورد = نوع_الفاتورة !== "SALE";
  const عميل_زائر = !فاتورة.customerId;

  // حساب إجمالي دفعات الفاتورة الموجودة
  const إجمالي_الدفعات_الموجودة = فاتورة.treasuryTxns.reduce((s, t) => s + Number(t.amount), 0);

  // totalAmount = صافي (مبيعات − مرتجعات). لاستعادة رصيد ما قبل الفاتورة:
  // balance_current = balance_before + totalAmount - payments
  // → balance_before = balance_current - totalAmount + payments
  const طرح_الفاتورة = هو_مورد && نوع_الفاتورة === "PURCHASE"
    ? Number(فاتورة.totalAmount)   // جاية → دائن على المورد
    : هو_مورد
    ? -Number(فاتورة.totalAmount)  // رايحة → مدين على المورد
    : Number(فاتورة.totalAmount);  // بيع/مختلط → صافي على العميل

  const عملاء_معدّلة = عملاء.map((c) => ({
    ...c,
    balance: c.id === فاتورة.customerId && !هو_مورد
      ? Number(c.balance) - طرح_الفاتورة + إجمالي_الدفعات_الموجودة
      : Number(c.balance),
  }));
  const موردون_معدّلة = موردون.map((s) => ({
    ...s,
    balance: s.id === فاتورة.customerId && هو_مورد
      ? Number(s.balance) - طرح_الفاتورة + إجمالي_الدفعات_الموجودة
      : Number(s.balance),
  }));

  return (
    <div>
      <ترويسة_الصفحة العنوان={t("inv.edit_title", {
          number: فاتورة.number ? String(فاتورة.number).padStart(7, "0") : (فاتورة.externalRef ?? "—"),
        })} />
      <نموذج_فاتورة
        العملاء={عملاء_معدّلة}
        الموردون={موردون_معدّلة}
        حسابات_الخزنة={حسابات.map((h) => ({ id: h.id, النوع: h.type, التسمية: تسمية_حساب_الخزنة[h.type] }))}
        حسابات_فرعية={حسابات_فرعية}
        التصنيفات={تصنيفات}
        الشركات={شركات}
        فاتورة={{
          id: فاتورة.id,
          الرقم: فاتورة.number,
          نوع_الفاتورة,
          مرجع_خارجي: فاتورة.externalRef ?? null,
          معرف_العميل: عميل_زائر ? null : (فاتورة.customerId ?? null),
          اسم_الزائر: عميل_زائر ? (فاتورة.guestName ?? null) : null,
          الهاتف: فاتورة.phone,
          التاريخ: فاتورة.date.toISOString(),
          ملاحظات: فاتورة.notes,
          البنود: فاتورة.lines.map((l) => ({
            نوع_البند: (l.lineType === "RETURN" ? "RETURN" : "SALE") as "SALE" | "RETURN",
            اللون: l.color,
            الشركة: l.company ?? "",
            الكمية: String(Number(l.qty)),
            الوزن: String(Number(l.weight)),
            التصنيف: l.category,
            السعر: l.price != null ? String(Number(l.price)) : "",
            ملاحظات: l.notes ?? "",
          })),
        }}
      />
    </div>
  );
}
