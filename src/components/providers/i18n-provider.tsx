"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  إنشاء_مترجم,
  اتجاه,
  اسم_كوكي_اللغة,
  اسم_كوكي_المظهر,
  type لغة,
  type مظهر,
  type مفتاح_ترجمة,
} from "@/lib/i18n";

type سياق_التطبيق = {
  لغة: لغة;
  مظهر: مظهر;
  اتجاه: "rtl" | "ltr";
  t: (مفتاح: مفتاح_ترجمة, متغيّرات?: Record<string, string | number>) => string;
  تبديل_اللغة: () => void;
  تبديل_المظهر: () => void;
};

const السياق = React.createContext<سياق_التطبيق | null>(null);

function اضبط_كوكي(الاسم: string, القيمة: string) {
  // سنة كاملة، متاح لكل المسارات
  document.cookie = `${الاسم}=${القيمة}; path=/; max-age=31536000; samesite=lax`;
}

export function مزود_اللغة_والمظهر({
  اللغة_الابتدائية,
  المظهر_الابتدائي,
  children,
}: {
  اللغة_الابتدائية: لغة;
  المظهر_الابتدائي: مظهر;
  children: React.ReactNode;
}) {
  const router = useRouter();
  const [ل, تعيين_ل] = React.useState<لغة>(اللغة_الابتدائية);
  const [م, تعيين_م] = React.useState<مظهر>(المظهر_الابتدائي);

  const تبديل_المظهر = React.useCallback(() => {
    const جديد: مظهر = م === "dark" ? "light" : "dark";
    const root = document.documentElement;
    root.classList.add("theme-transitioning");
    window.setTimeout(() => root.classList.remove("theme-transitioning"), 220);
    root.classList.toggle("dark", جديد === "dark");
    اضبط_كوكي(اسم_كوكي_المظهر, جديد);
    تعيين_م(جديد);
  }, [م]);

  const تبديل_اللغة = React.useCallback(() => {
    const جديد: لغة = ل === "ar" ? "en" : "ar";
    const root = document.documentElement;
    root.setAttribute("lang", جديد);
    root.setAttribute("dir", اتجاه(جديد));
    اضبط_كوكي(اسم_كوكي_اللغة, جديد);
    تعيين_ل(جديد);
    // تحديث مكوّنات الخادم (نصوص مترجمة على الخادم)
    router.refresh();
  }, [ل, router]);

  const قيمة = React.useMemo<سياق_التطبيق>(
    () => ({
      لغة: ل,
      مظهر: م,
      اتجاه: اتجاه(ل),
      t: إنشاء_مترجم(ل),
      تبديل_اللغة,
      تبديل_المظهر,
    }),
    [ل, م, تبديل_اللغة, تبديل_المظهر]
  );

  return <السياق.Provider value={قيمة}>{children}</السياق.Provider>;
}

/** هوك الترجمة + التبديل لمكوّنات العميل. */
export function استخدام_اللغة(): سياق_التطبيق {
  const قيمة = React.useContext(السياق);
  if (!قيمة) {
    throw new Error("استخدام_اللغة يجب أن يُستعمل داخل مزود_اللغة_والمظهر");
  }
  return قيمة;
}
