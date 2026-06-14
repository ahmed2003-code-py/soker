"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { عنصر_تنقل } from "./nav-items";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";

export function الشريط_الجانبي({
  العناصر,
  مطوي,
  عند_النقر,
}: {
  العناصر: عنصر_تنقل[];
  مطوي?: boolean;
  عند_النقر?: () => void;
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
              "flex items-center gap-3 rounded-xl px-3 py-2.5 text-sm font-medium transition-colors",
              نشط
                ? "bg-primary text-primary-foreground shadow-soft"
                : "text-foreground hover:bg-appgray",
              مطوي && "justify-center"
            )}
          >
            <Icon className="size-5 shrink-0" />
            {!مطوي && <span>{العنوان}</span>}
          </Link>
        );
      })}
    </nav>
  );
}
