"use client";
import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { X } from "lucide-react";
import type { Role } from "@prisma/client";
import { cn } from "@/lib/utils";
import { الشريط_الجانبي } from "./sidebar";
import { الشريط_العلوي } from "./topbar";
import { عناصر_مرئية } from "./nav-items";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";

export function هيكل_التطبيق({
  المستخدم,
  children,
}: {
  المستخدم: { name: string; role: Role };
  children: React.ReactNode;
}) {
  const [مطوي, تعيين_مطوي] = React.useState(false);
  const [درج, تعيين_درج] = React.useState(false);
  const مسار = usePathname();
  const { t } = استخدام_اللغة();
  const العناصر = عناصر_مرئية(المستخدم.role);
  const الشريط_السفلي = العناصر.filter((ع) => ع.ضمن_الشريط_السفلي).slice(0, 4);

  // إغلاق الدرج عند تغيّر المسار (موبايل)
  React.useEffect(() => {
    تعيين_درج(false);
  }, [مسار]);

  return (
    <div className="flex min-h-screen bg-appgray">
      {/* الشريط الجانبي — سطح المكتب (يمين في RTL) */}
      <aside
        className={cn(
          "no-print hidden shrink-0 border-e border-border bg-sidebar transition-all lg:block",
          مطوي ? "w-[76px]" : "w-64"
        )}
      >
        <div className="sticky top-0 h-screen overflow-y-auto">
          <الشريط_الجانبي العناصر={العناصر} مطوي={مطوي} />
        </div>
      </aside>

      {/* درج الموبايل */}
      {درج && (
        <div className="no-print fixed inset-0 z-40 lg:hidden">
          <div
            className="absolute inset-0 bg-black/40"
            onClick={() => تعيين_درج(false)}
          />
          <aside className="absolute inset-y-0 end-0 w-72 bg-sidebar shadow-card">
            <div className="flex justify-start p-2">
              <button onClick={() => تعيين_درج(false)} className="rounded-lg p-2 hover:bg-appgray">
                <X className="size-5" />
              </button>
            </div>
            <الشريط_الجانبي العناصر={العناصر} عند_النقر={() => تعيين_درج(false)} معرف_المؤشر="drawer" />
          </aside>
        </div>
      )}

      {/* المحتوى */}
      <div className="flex min-w-0 flex-1 flex-col">
        <div className="no-print">
          <الشريط_العلوي
            المستخدم={المستخدم}
            مطوي={مطوي}
            عند_طي_الجانبي={() => تعيين_مطوي((v) => !v)}
            عند_فتح_الدرج={() => تعيين_درج(true)}
          />
        </div>
        <main className="flex-1 p-4 pb-24 sm:p-6 lg:pb-6">{children}</main>

        {/* شريط سفلي للموبايل */}
        <nav className="no-print fixed inset-x-0 bottom-0 z-30 flex border-t border-border bg-card lg:hidden">
          {الشريط_السفلي.map((ع) => {
            const نشط = مسار === ع.المسار || مسار.startsWith(ع.المسار + "/");
            const Icon = ع.الأيقونة;
            return (
              <Link
                key={ع.المسار}
                href={ع.المسار}
                className={cn(
                  "flex flex-1 flex-col items-center gap-0.5 py-2 text-xs",
                  نشط ? "text-primary" : "text-muted-foreground"
                )}
              >
                <Icon className="size-5" />
                {t(ع.المفتاح)}
              </Link>
            );
          })}
        </nav>
      </div>
    </div>
  );
}
