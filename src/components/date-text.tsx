import { cn } from "@/lib/utils";
import { تنسيق_تاريخ, تنسيق_تاريخ_ووقت, وقت_فقط } from "@/lib/date";

type الخصائص = {
  القيمة: Date | string | null | undefined;
  مع_الوقت?: boolean;
  /** التاريخ في سطر والوقت تحته بخط أصغر (يتطلب مع_الوقت) بدل عرضهما في سطر واحد */
  مكدّس?: boolean;
  className?: string;
};

/** عرض التاريخ بنمط dd/mm/yyyy (LTR) */
export function نص_تاريخ({ القيمة, مع_الوقت, مكدّس, className }: الخصائص) {
  if (مع_الوقت && مكدّس) {
    return (
      <span className={cn("inline-flex flex-col leading-tight", className)}>
        <span className="ltr-nums tabular-nums">{تنسيق_تاريخ(القيمة) || "—"}</span>
        <span className="ltr-nums tabular-nums text-[11px] text-muted-foreground">{وقت_فقط(القيمة)}</span>
      </span>
    );
  }
  const نص = مع_الوقت ? تنسيق_تاريخ_ووقت(القيمة) : تنسيق_تاريخ(القيمة);
  return <span className={cn("ltr-nums tabular-nums", className)}>{نص || "—"}</span>;
}
