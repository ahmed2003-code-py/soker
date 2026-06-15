"use client";
import * as React from "react";
import { CalendarRange, X } from "lucide-react";
import { العنوان } from "@/components/ui/label";
import { منتقي_تاريخ } from "@/components/date-picker";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";

/**
 * فلتر فترة قابل لإعادة الاستخدام: فترات سريعة + من/إلى (LTR) + مسح.
 * يُدار من الخارج (controlled) عبر قيم من/إلى ودالة عند_التغيير.
 */
export function فلتر_فترة({
  من,
  إلى,
  عند_التغيير,
  className,
}: {
  من: string;
  إلى: string;
  عند_التغيير: (من: string, إلى: string) => void;
  className?: string;
}) {
  const { لغة } = استخدام_اللغة();
  const يوم = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  const الفترات = (() => {
    const n = new Date();
    const y = n.getFullYear();
    const m = n.getMonth();
    return [
      { م: لغة === "ar" ? "هذا الشهر" : "This month", ب: new Date(y, m, 1), هـ: new Date(y, m + 1, 0) },
      { م: لغة === "ar" ? "الشهر الماضي" : "Last month", ب: new Date(y, m - 1, 1), هـ: new Date(y, m, 0) },
      { م: لغة === "ar" ? "آخر 3 شهور" : "Last 3 months", ب: new Date(y, m - 2, 1), هـ: new Date(y, m + 1, 0) },
      { م: لغة === "ar" ? "هذه السنة" : "This year", ب: new Date(y, 0, 1), هـ: new Date(y, 11, 31) },
    ];
  })();
  const نشط = !!(من || إلى);

  return (
    <div className={`flex flex-wrap items-end gap-x-4 gap-y-2 ${className ?? ""}`}>
      <div className="flex items-end gap-2">
        <div className="w-36 space-y-1">
          <العنوان>{لغة === "ar" ? "من تاريخ" : "From"}</العنوان>
          <منتقي_تاريخ القيمة={من} عند_التغيير={(v) => عند_التغيير(v, إلى)} className="h-9" />
        </div>
        <div className="w-36 space-y-1">
          <العنوان>{لغة === "ar" ? "إلى تاريخ" : "To"}</العنوان>
          <منتقي_تاريخ القيمة={إلى} عند_التغيير={(v) => عند_التغيير(من, v)} className="h-9" />
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
        <CalendarRange className="size-4 text-muted-foreground" />
        {الفترات.map((f) => (
          <button
            key={f.م}
            type="button"
            onClick={() => عند_التغيير(يوم(f.ب), يوم(f.هـ))}
            className="rounded-full border border-border bg-card px-3 py-1 text-xs transition hover:border-primary-blue/40 hover:bg-appgray active:scale-95"
          >
            {f.م}
          </button>
        ))}
        {نشط && (
          <button
            type="button"
            onClick={() => عند_التغيير("", "")}
            className="inline-flex items-center gap-1 rounded-full border border-danger/40 px-2.5 py-1 text-xs text-danger transition hover:bg-danger-soft active:scale-95"
          >
            <X className="size-3" />
            {لغة === "ar" ? "مسح" : "Clear"}
          </button>
        )}
      </div>
    </div>
  );
}
