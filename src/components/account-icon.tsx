import { Banknote, Landmark, Smartphone, Zap } from "lucide-react";
import type { TreasuryAccountType } from "@prisma/client";
import { cn } from "@/lib/utils";

// ألوان وهوية كل نوع حساب (قريبة من ألوان العلامات)
const إعداد: Record<
  TreasuryAccountType,
  { أيقونة: typeof Banknote; خلفية: string; لون: string }
> = {
  CASH: { أيقونة: Banknote, خلفية: "bg-success/15", لون: "text-success" },
  INSTAPAY: { أيقونة: Zap, خلفية: "bg-[#5a2d8c]/15", لون: "text-[#5a2d8c] dark:text-[#b794e6]" },
  BANK: { أيقونة: Landmark, خلفية: "bg-slate-500/15", لون: "text-slate-600 dark:text-slate-300" },
  VODAFONE: { أيقونة: Smartphone, خلفية: "bg-[#e60000]/15", لون: "text-[#e60000] dark:text-[#ff6b6b]" },
};

export function أيقونة_الحساب({
  النوع,
  حجم = "md",
  className,
}: {
  النوع: TreasuryAccountType;
  حجم?: "sm" | "md";
  className?: string;
}) {
  const c = إعداد[النوع];
  const Icon = c.أيقونة;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg",
        c.خلفية,
        c.لون,
        حجم === "sm" ? "size-7" : "size-9",
        className
      )}
    >
      <Icon className={حجم === "sm" ? "size-4" : "size-5"} />
    </span>
  );
}
