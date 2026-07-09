"use client";
import * as React from "react";

export function مبدّل_رصيد_الفاتورة({
  الرصيد_السابق,
  قيمة_الفاتورة,
  إجمالي_الدفعات = 0,
  اسم_الطرف,
  نوع_الطرف = "عميل",
  اتجاه_الفاتورة = "زيادة", // زيادة = الفاتورة ترفع الرصيد | نقصان = تخفّضه
}: {
  الرصيد_السابق: number;
  قيمة_الفاتورة: number;
  إجمالي_الدفعات?: number;
  اسم_الطرف: string;
  نوع_الطرف?: "عميل" | "مورد";
  اتجاه_الفاتورة?: "زيادة" | "نقصان";
}) {
  const [مُظهَر, تعيين_مُظهَر] = React.useState(false);

  function عند_التبديل(قيمة: boolean) {
    تعيين_مُظهَر(قيمة);
    const url = new URL(window.location.href);
    if (قيمة) url.searchParams.set("balance", "1");
    else url.searchParams.delete("balance");
    window.history.replaceState(null, "", url.toString());
  }

  const الرصيد_الجديد =
    اتجاه_الفاتورة === "زيادة"
      ? الرصيد_السابق + قيمة_الفاتورة - إجمالي_الدفعات
      : الرصيد_السابق - قيمة_الفاتورة + إجمالي_الدفعات;

  const نص_رصيد = (r: number) => {
    const مبلغ = Math.abs(r).toLocaleString("en-US", { minimumFractionDigits: 2 });
    if (نوع_الطرف === "مورد") {
      const نوع = r > 0 ? "مستحق للمورد" : r < 0 ? "زيادة دفع" : "مُسوَّى";
      return `${مبلغ} ج.م  (${نوع})`;
    }
    const نوع = r > 0 ? "مديونية" : r < 0 ? "سلفة" : "مُسوَّى";
    return `${مبلغ} ج.م  (${نوع})`;
  };

  const تسمية_طرف = نوع_الطرف === "مورد" ? "المورد" : "العميل";
  const علامة_الفاتورة = اتجاه_الفاتورة === "زيادة" ? "+" : "−";
  const تسمية_الدفعة = نوع_الطرف === "مورد" ? "− دفعة للمورد" : "− دفعة مسجّلة مع الفاتورة";

  return (
    <>
      <div className="no-print mt-4 flex items-center gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
        <input
          type="checkbox"
          id="toggle-balance"
          checked={مُظهَر}
          onChange={(e) => عند_التبديل(e.target.checked)}
          className="size-4 cursor-pointer rounded accent-primary"
        />
        <label htmlFor="toggle-balance" className="cursor-pointer select-none">
          إظهار رصيد {تسمية_طرف} في الطباعة
        </label>
      </div>

      {مُظهَر && (
        <div className="mt-3 rounded-xl border border-foreground/25 p-3 text-[13px] space-y-1.5 print:rounded-none">
          <p className="font-semibold mb-2 print:text-black">رصيد {تسمية_طرف}: {اسم_الطرف}</p>
          <div className="flex justify-between text-muted-foreground print:text-black/70">
            <span>الرصيد السابق</span>
            <span className="ltr-nums">{نص_رصيد(الرصيد_السابق)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground print:text-black/70">
            <span>{علامة_الفاتورة} هذه الفاتورة</span>
            <span className="ltr-nums">
              {قيمة_الفاتورة.toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
            </span>
          </div>
          {إجمالي_الدفعات > 0 && (
            <div className="flex justify-between text-green-700 print:text-black/70">
              <span>{تسمية_الدفعة}</span>
              <span className="ltr-nums">
                {إجمالي_الدفعات.toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
              </span>
            </div>
          )}
          <div className="flex justify-between border-t border-foreground/20 pt-1.5 font-bold print:text-black">
            <span>الرصيد الإجمالي بعد الفاتورة</span>
            <span className="ltr-nums">{نص_رصيد(الرصيد_الجديد)}</span>
          </div>
        </div>
      )}
    </>
  );
}
