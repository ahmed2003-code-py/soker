"use client";
import * as React from "react";
import {
  format,
  parseISO,
  isValid,
  addMonths,
  addDays,
  startOfMonth,
  startOfWeek,
  isSameMonth,
  isSameDay,
  setYear,
} from "date-fns";
import { Calendar, ChevronLeft, ChevronRight, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { منبثقة, مشغل_منبثقة, محتوى_منبثقة } from "@/components/ui/popover";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";

const أيام_عربية = ["السبت", "الأحد", "الإثنين", "الثلاثاء", "الأربعاء", "الخميس", "الجمعة"];
const أيام_ع_مختصرة = ["سبت", "أحد", "إثن", "ثلا", "أرب", "خمي", "جمع"];
const أيام_en = ["Sa", "Su", "Mo", "Tu", "We", "Th", "Fr"];
const أشهر_عربية = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];

function إلى_تاريخ(قيمة: string): Date | null {
  if (!قيمة) return null;
  const d = parseISO(قيمة);
  return isValid(d) ? d : null;
}

/**
 * منتقي تاريخ مخصّص (Popover) بتصميم النظام — RTL/دارك مود، حجم مناسب.
 * القيمة بصيغة yyyy-MM-dd (نفس صيغة input[type=date]) لسهولة الاستبدال.
 */
export function منتقي_تاريخ({
  القيمة,
  عند_التغيير,
  className,
  بديل,
}: {
  القيمة: string;
  عند_التغيير: (قيمة: string) => void;
  className?: string;
  بديل?: string;
}) {
  const { لغة } = استخدام_اللغة();
  const مختار = إلى_تاريخ(القيمة);
  const [مفتوح, تعيين_مفتوح] = React.useState(false);
  const [شهر, تعيين_شهر] = React.useState<Date>(مختار ?? new Date());

  React.useEffect(() => {
    if (مفتوح) تعيين_شهر(مختار ?? new Date());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [مفتوح]);

  const بداية_الشبكة = startOfWeek(startOfMonth(شهر), { weekStartsOn: 6 }); // السبت
  const أيام_الشبكة = Array.from({ length: 42 }, (_, i) => addDays(بداية_الشبكة, i));
  const أسماء_الأيام = لغة === "ar" ? أيام_ع_مختصرة : أيام_en;
  const عنوان_الشهر =
    لغة === "ar" ? `${أشهر_عربية[شهر.getMonth()]} ${شهر.getFullYear()}` : format(شهر, "MMMM yyyy");
  const نص_العرض = مختار ? format(مختار, "dd/MM/yyyy") : "";

  function اختر(d: Date) {
    عند_التغيير(format(d, "yyyy-MM-dd"));
    تعيين_مفتوح(false);
  }

  return (
    <منبثقة open={مفتوح} onOpenChange={تعيين_مفتوح}>
      <مشغل_منبثقة asChild>
        <button
          type="button"
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-input bg-card px-3 py-2 text-sm shadow-soft transition focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-1 hover:border-primary-blue/40",
            className
          )}
        >
          <span className={cn("ltr-nums tabular-nums", !نص_العرض && "text-muted-foreground")}>
            {نص_العرض || (بديل ?? (لغة === "ar" ? "اختر التاريخ" : "Pick a date"))}
          </span>
          <Calendar className="size-4 shrink-0 opacity-55" />
        </button>
      </مشغل_منبثقة>
      <محتوى_منبثقة align="start" className="w-auto p-3">
        {/* رأس التنقّل */}
        <div className="mb-2 flex items-center justify-between gap-2">
          <button
            type="button"
            onClick={() => تعيين_شهر((m) => addMonths(m, -1))}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-appgray hover:text-foreground"
            aria-label="prev"
          >
            <ChevronRight className="size-4" />
          </button>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">{عنوان_الشهر}</span>
            <select
              value={شهر.getFullYear()}
              onChange={(e) => تعيين_شهر((m) => setYear(m, Number(e.target.value)))}
              className="rounded-md border border-border bg-card px-1 py-0.5 text-xs ltr-nums"
            >
              {Array.from({ length: 21 }, (_, i) => شهر.getFullYear() - 12 + i).map((y) => (
                <option key={y} value={y}>{y}</option>
              ))}
            </select>
          </div>
          <button
            type="button"
            onClick={() => تعيين_شهر((m) => addMonths(m, 1))}
            className="rounded-lg p-1.5 text-muted-foreground transition hover:bg-appgray hover:text-foreground"
            aria-label="next"
          >
            <ChevronLeft className="size-4" />
          </button>
        </div>

        {/* الشبكة */}
        <div dir="ltr" className="select-none">
          <div className="mb-1 grid grid-cols-7 gap-0.5 text-center text-[11px] font-medium text-muted-foreground">
            {أسماء_الأيام.map((d) => (
              <div key={d} className="py-1">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-0.5">
            {أيام_الشبكة.map((d) => {
              const ضمن_الشهر = isSameMonth(d, شهر);
              const محدد = !!مختار && isSameDay(d, مختار);
              const اليوم = isSameDay(d, new Date());
              return (
                <button
                  key={d.toISOString()}
                  type="button"
                  onClick={() => اختر(d)}
                  className={cn(
                    "flex h-8 w-8 items-center justify-center rounded-lg text-xs tabular-nums transition",
                    !ضمن_الشهر && "text-muted-foreground/40",
                    ضمن_الشهر && !محدد && "hover:bg-appgray",
                    محدد && "bg-primary font-semibold text-primary-foreground",
                    !محدد && اليوم && "ring-1 ring-inset ring-primary-blue/50"
                  )}
                >
                  {d.getDate()}
                </button>
              );
            })}
          </div>
        </div>

        {/* تذييل */}
        <div className="mt-2 flex items-center justify-between border-t border-border pt-2 text-xs">
          <button
            type="button"
            onClick={() => اختر(new Date())}
            className="rounded-md px-2 py-1 text-primary-blue transition hover:bg-appgray"
          >
            {لغة === "ar" ? "اليوم" : "Today"}
          </button>
          {القيمة && (
            <button
              type="button"
              onClick={() => { عند_التغيير(""); تعيين_مفتوح(false); }}
              className="inline-flex items-center gap-1 rounded-md px-2 py-1 text-danger transition hover:bg-danger-soft"
            >
              <X className="size-3" /> {لغة === "ar" ? "مسح" : "Clear"}
            </button>
          )}
        </div>
      </محتوى_منبثقة>
    </منبثقة>
  );
}
