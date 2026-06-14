import * as React from "react";
import { cn } from "@/lib/utils";

export interface خصائص_الحقل
  extends React.InputHTMLAttributes<HTMLInputElement> {
  /** تحديد كامل النص عند التركيز (للإدخال السريع للأرقام) */
  selectOnFocus?: boolean;
}

const الحقل = React.forwardRef<HTMLInputElement, خصائص_الحقل>(
  ({ className, type, selectOnFocus, onFocus, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          "flex h-10 w-full rounded-xl border border-input bg-card px-3 py-2 text-sm shadow-soft placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-1 disabled:cursor-not-allowed disabled:opacity-50",
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
>(({ className, ...props }, ref) => (
  <textarea
    ref={ref}
    className={cn(
      "flex min-h-[80px] w-full rounded-xl border border-input bg-card px-3 py-2 text-sm shadow-soft placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
      className
    )}
    {...props}
  />
));
منطقة_نص.displayName = "منطقة_نص";

export { الحقل, منطقة_نص };
