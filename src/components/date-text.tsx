import { cn } from "@/lib/utils";
import { تنسيق_تاريخ, تنسيق_تاريخ_ووقت } from "@/lib/date";

type الخصائص = {
  القيمة: Date | string | null | undefined;
  مع_الوقت?: boolean;
  className?: string;
};

/** عرض التاريخ بنمط dd/mm/yyyy (LTR) */
export function نص_تاريخ({ القيمة, مع_الوقت, className }: الخصائص) {
  const نص = مع_الوقت ? تنسيق_تاريخ_ووقت(القيمة) : تنسيق_تاريخ(القيمة);
  return <span className={cn("ltr-nums tabular-nums", className)}>{نص || "—"}</span>;
}
