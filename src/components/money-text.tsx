import { cn } from "@/lib/utils";
import { تنسيق_مبلغ, العملة } from "@/lib/money";

type الخصائص = {
  القيمة: unknown;
  /** التلوين: محايد افتراضياً، أو إيراد(أخضر)/مصروف(أحمر) */
  النوع?: "محايد" | "إيراد" | "مصروف";
  مع_العملة?: boolean;
  className?: string;
};

/** عرض المبالغ بتنسيق موحّد LTR مع فاصل آلاف */
export function نص_مبلغ({
  القيمة,
  النوع = "محايد",
  مع_العملة = true,
  className,
}: الخصائص) {
  return (
    <span
      className={cn(
        "ltr-nums font-medium tabular-nums",
        النوع === "إيراد" && "text-success",
        النوع === "مصروف" && "text-danger",
        className
      )}
    >
      {تنسيق_مبلغ(القيمة)}
      {مع_العملة && <span className="ms-1 text-xs opacity-70">{العملة}</span>}
    </span>
  );
}
