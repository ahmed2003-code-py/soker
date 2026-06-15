import * as React from "react";
import { cn } from "@/lib/utils";

export interface خصائص_الحقل
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** تحديد كامل النص عند التركيز (للإدخال السريع للأرقام) */
  selectOnFocus?: boolean;
}

// أنواع الحقول التي يجب أن تبقى LTR دائماً (تواريخ/أوقات/أرقام)
const أنواع_LTR = new Set(["date", "month", "time", "datetime-local", "week", "number", "tel", "email", "url"]);

const الحقل = React.forwardRef<HTMLInputElement, خصائص_الحقل>(
  ({ className, type, selectOnFocus, onFocus, dir, ...props }, ref) => {
    const نوع_LTR = !!type && أنواع_LTR.has(type);
    const تاريخي = type === "date" || type === "month" || type === "time" || type === "datetime-local" || type === "week";
    // اتجاه ذكي: التواريخ/الأرقام LTR، والنص المختلط عربي/إنجليزي يتأقلم حسب المحتوى
    const الاتجاه = dir ?? (نوع_LTR ? "ltr" : "auto");
    return (
      <input
        type={type}
        dir={الاتجاه}
        className={cn(
          "flex h-10 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm shadow-soft placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
          تاريخي && "field-date text-start",
          className
        )}
        ref={ref}
        onFocus={(e) => {
          if (selectOnFocus) e.currentTarget.select();
          onFocus?.(e);
        }}
        {...props}
      />
    );
  }
);
الحقل.displayName = "الحقل";

const منطقة_نص = React.forwardRef<
  HTMLTextAreaElement,
  React.TextareaHTMLAttributes<HTMLTextAreaElement>
>(({ className, dir, ...props }, ref) => (
  <textarea
    ref={ref}
    dir={dir ?? "auto"}
    className={cn(
      "flex min-h-[80px] w-full rounded-xl border border-input bg-card px-3 py-2 text-sm shadow-soft placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
منطقة_نص.displayName = "منطقة_نص";

export { الحقل, منطقة_نص };
