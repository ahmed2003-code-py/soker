"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import type { عنصر_تنقل } from "./nav-items";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";

export function الشريط_الجانبي({
  العناصر,
  مطوي,
  عند_النقر,
  معرف_المؤشر = "side",
}: {
  العناصر: عنصر_تنقل[];
  مطوي?: boolean;
  عند_النقر?: () => void;
  معرف_المؤشر?: string;
}) {
  const مسار = usePathname();
  const { t } = استخدام_اللغة();
  return (
    <nav className="flex h-full flex-col gap-1 p-3">
      <div className={cn("mb-4 px-2", مطوي && "text-center")}>
        <Link href="/dashboard" className="text-2xl font-bold text-primary">
          {مطوي ? "س" : t("app.name")}
        </Link>
      </div>
      {العناصر.map((ع) => {
        const نشط = مسار === ع.المسار || مسار.startsWith(ع.المسار + "/");
        const Icon = ع.الأيقونة;
        const العنوان = t(ع.المفتاح);
        return (
          <Link
            key={ع.المسار}
            href={ع.المسار}
            onClick={عند_النقر}
            title={العنوان}
            className={cn(
              "relative flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors duration-200",
              نشط ? "text-primary-foreground" : "text-foreground hover:bg-appgray",
              مطوي && "justify-center"
            )}
          >
            {نشط && (
              <motion.span
                layoutId={`مؤشر_التنقل_${معرف_المؤشر}`}
                className="absolute inset-0 -z-10 rounded-xl bg-primary shadow-soft"
                transition={{ type: "spring", stiffness: 420, damping: 34 }}
              />
            )}
            <Icon className="size-5 shrink-0" />
            {!مطوي && <span>{العنوان}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
