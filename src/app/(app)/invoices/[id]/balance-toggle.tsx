"use client";
import * as React from "react";

export function مبدّل_رصيد_الفاتورة({
  الرصيد_الحالي,
  قيمة_الفاتورة,
  إجمالي_الدفعات = 0,
  اسم_العميل,
}: {
  الرصيد_الحالي: number;
  قيمة_الفاتورة: number;
  إجمالي_الدفعات?: number;
  اسم_العميل: string;
}) {
  const [مُظهَر, تعيين_مُظهَر] = React.useState(false);
  const الرصيد_الجديد = الرصيد_الحالي + قيمة_الفاتورة - إجمالي_الدفعات;

  const نص_رصيد = (r: number) => {
    const مبلغ = Math.abs(r).toLocaleString("en-US", { minimumFractionDigits: 2 });
    const نوع = r > 0 ? "مديونية" : r < 0 ? "سلفة" : "مُسوَّى";
    return `${مبلغ} ج.م  (${نوع})`;
  };

  return (
    <>
      {/* مربع التحكم — يُخفى عند الطباعة */}
      <div className="no-print mt-4 flex items-center gap-2 border-t border-border pt-3 text-sm text-muted-foreground">
        <input
          type="checkbox"
          id="toggle-balance"
          checked={مُظهَر}
          onChange={(e) => تعيين_مُظهَر(e.target.checked)}
          className="size-4 cursor-pointer rounded accent-primary"
        />
        <label htmlFor="toggle-balance" className="cursor-pointer select-none">
          إظهار رصيد العميل في الطباعة
        </label>
      </div>

      {/* قسم الرصيد — يظهر في الشاشة والطباعة معاً عند التفعيل */}
      {مُظهَر && (
        <div className="mt-3 rounded-xl border border-foreground/25 p-3 text-[13px] space-y-1.5 print:rounded-none">
          <p className="font-semibold mb-2 print:text-black">رصيد العميل: {اسم_العميل}</p>
          <div className="flex justify-between text-muted-foreground print:text-black/70">
            <span>الرصيد السابق</span>
            <span className="ltr-nums">{نص_رصيد(الرصيد_الحالي)}</span>
          </div>
          <div className="flex justify-between text-muted-foreground print:text-black/70">
            <span>+ هذه الفاتورة</span>
            <span className="ltr-nums">
              {قيمة_الفاتورة.toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م
            </span>
          </div>
          {إجمالي_الدفعات > 0 && (
            <div className="flex justify-between text-green-700 print:text-black/70">
              <span>− دفعة مسجّلة مع الفاتورة</span>
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
