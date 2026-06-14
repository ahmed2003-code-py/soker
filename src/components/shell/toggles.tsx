"use client";
import { Moon, Sun, Languages } from "lucide-react";
import { الزر } from "@/components/ui/button";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";

/** زر تبديل المظهر (فاتح/داكن). */
export function زر_المظهر() {
  const { مظهر, تبديل_المظهر, t } = استخدام_اللغة();
  return (
    <الزر
      variant="ghost"
      size="icon"
      onClick={تبديل_المظهر}
      title={t("topbar.theme_toggle")}
      aria-label={t("topbar.theme_toggle")}
    >
      {مظهر === "dark" ? <Sun className="size-5" /> : <Moon className="size-5" />}
    </الزر>
  );
}

/** زر تبديل اللغة (عربي/إنجليزي) — يظهر اللغة الهدف. */
export function زر_اللغة() {
  const { لغة, تبديل_اللغة, t } = استخدام_اللغة();
  return (
    <الزر
      variant="ghost"
      size="icon"
      onClick={تبديل_اللغة}
      title={t("topbar.lang_toggle")}
      aria-label={t("topbar.lang_toggle")}
      className="relative"
    >
      <Languages className="size-5" />
      <span className="absolute -bottom-0.5 end-0.5 text-[9px] font-bold leading-none text-muted-foreground">
        {لغة === "ar" ? "EN" : "ع"}
      </span>
    </الزر>
  );
}
