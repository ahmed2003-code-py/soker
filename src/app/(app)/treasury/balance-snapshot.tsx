"use client";
import * as React from "react";
import { createPortal } from "react-dom";
import type { TreasuryAccountType } from "@prisma/client";
import { نص_مبلغ } from "@/components/money-text";
import { أيقونة_الحساب } from "@/components/account-icon";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";

export type رصيد_حساب = { النوع: TreasuryAccountType; التسمية: string; رصيد: number };

/**
 * تلميح (hover) يعرض أرصدة الحسابات الأربعة + الإجمالي كما هي بعد معاملة معيّنة.
 * يُعرض عبر portal لتفادي القَص داخل الجدول.
 */
export function لقطة_الأرصدة({
  children,
  أرصدة,
  إجمالي,
}: {
  children: React.ReactNode;
  أرصدة: رصيد_حساب[];
  إجمالي: number;
}) {
  const { لغة } = استخدام_اللغة();
  const [ظاهر, تعيين_ظاهر] = React.useState(false);
  const [موضع, تعيين_موضع] = React.useState({ x: 0, y: 0 });
  const مرجع = React.useRef<HTMLSpanElement>(null);
  const [مهيأ, تعيين_مهيأ] = React.useState(false);
  React.useEffect(() => تعيين_مهيأ(true), []);

  function ادخل() {
    const r = مرجع.current?.getBoundingClientRect();
    if (r) تعيين_موضع({ x: r.left + r.width / 2, y: r.top });
    تعيين_ظاهر(true);
  }

  return (
    <span
      ref={مرجع}
      onMouseEnter={ادخل}
      onMouseLeave={() => تعيين_ظاهر(false)}
      className="cursor-help underline decoration-dotted decoration-muted-foreground/40 underline-offset-4"
    >
      {children}
      {مهيأ && ظاهر &&
        createPortal(
          <div
            style={{ position: "fixed", left: موضع.x, top: موضع.y - 10, transform: "translate(-50%, -100%)" }}
            className="z-[100] w-60 rounded-xl border border-border bg-card p-3 text-foreground shadow-card"
          >
            <p className="mb-2 text-[11px] font-semibold text-muted-foreground">
              {لغة === "ar" ? "الأرصدة بعد هذه المعاملة" : "Balances after this transaction"}
            </p>
            <div className="space-y-1.5">
              {أرصدة.map((a) => (
                <div key={a.النوع} className="flex items-center justify-between gap-2 text-xs">
                  <span className="flex items-center gap-1.5">
                    <أيقونة_الحساب النوع={a.النوع} حجم="sm" /> {a.التسمية}
                  </span>
                  <نص_مبلغ القيمة={a.رصيد} مع_العملة={false} className={a.رصيد < 0 ? "text-danger" : undefined} />
                </div>
              ))}
            </div>
            <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs font-bold">
              <span>{لغة === "ar" ? "إجمالي الخزنة" : "Total treasury"}</span>
              <نص_مبلغ القيمة={إجمالي} مع_العملة={false} className={إجمالي < 0 ? "text-danger" : undefined} />
            </div>
          </div>,
          document.body
        )}
    </span>
  );
}
