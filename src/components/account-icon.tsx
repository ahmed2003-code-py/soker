"use client";
import * as React from "react";
import { Banknote, Landmark, Smartphone, Zap } from "lucide-react";
import type { TreasuryAccountType } from "@prisma/client";
import { cn } from "@/lib/utils";

// ألوان وهوية كل نوع حساب (احتياطي لو لم تُرفع صور اللوجو)
const إعداد: Record<
  TreasuryAccountType,
  { أيقونة: typeof Banknote; خلفية: string; لون: string; ملف: string }
> = {
  CASH: { أيقونة: Banknote, خلفية: "bg-success/15", لون: "text-success", ملف: "/accounts/cash.png" },
  INSTAPAY: { أيقونة: Zap, خلفية: "bg-[#5a2d8c]/15", لون: "text-[#5a2d8c] dark:text-[#b794e6]", ملف: "/accounts/instapay.png" },
  BANK: { أيقونة: Landmark, خلفية: "bg-slate-500/15", لون: "text-slate-600 dark:text-slate-300", ملف: "/accounts/bank.png" },
  VODAFONE: { أيقونة: Smartphone, خلفية: "bg-[#e60000]/15", لون: "text-[#e60000] dark:text-[#ff6b6b]", ملف: "/accounts/vodafone.png" },
};

/**
 * أيقونة نوع الحساب. تحاول عرض اللوجو الحقيقي من /public/accounts/<type>.png،
 * وإن لم يوجد الملف تعود تلقائياً لأيقونة ملوّنة بهوية العلامة.
 * لإظهار اللوجوهات الأصلية: ضع الملفات في public/accounts/
 *   cash.png · instapay.png · bank.png · vodafone.png
 */
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
  const [فشل, تعيين_فشل] = React.useState(false);
  const أبعاد = حجم === "sm" ? "size-7" : "size-9";

  if (!فشل) {
    return (
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={c.ملف}
        alt=""
        onError={() => تعيين_فشل(true)}
        className={cn("shrink-0 rounded-lg object-contain", أبعاد, className)}
      />
    );
  }

  const Icon = c.أيقونة;
  return (
    <span
      className={cn(
        "inline-flex shrink-0 items-center justify-center rounded-lg",
        c.خلفية,
        c.لون,
        أبعاد,
        className
      )}
    >
      <Icon className={حجم === "sm" ? "size-4" : "size-5"} />
    </span>
  );
}
