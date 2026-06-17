"use client";
import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { Eye, EyeOff, LogIn } from "lucide-react";
import { الزر } from "@/components/ui/button";
import { الحقل } from "@/components/ui/input";
import { العنوان } from "@/components/ui/label";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";

export function نموذج_الدخول() {
  const router = useRouter();
  const { t } = استخدام_اللغة();
  const [اسم, تعيين_اسم] = React.useState("");
  const [كلمة, تعيين_كلمة] = React.useState("");
  const [إظهار, تعيين_إظهار] = React.useState(false);
  const [خطأ, تعيين_خطأ] = React.useState(false);
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  async function إرسال(e: React.FormEvent) {
    e.preventDefault();
    تعيين_خطأ(false);
    تعيين_جارٍ(true);
    const res = await signIn("credentials", { username: اسم, password: كلمة, redirect: false });
    تعيين_جارٍ(false);
    if (res?.error) { تعيين_خطأ(true); return; }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={إرسال} className="space-y-5">
      {/* اسم المستخدم */}
      <div className="space-y-1.5">
        <العنوان مطلوب htmlFor="username">{t("login.username")}</العنوان>
        <الحقل
          id="username"
          autoFocus
          value={اسم}
          onChange={(e) => تعيين_اسم(e.target.value)}
          placeholder="ahmed"
          className="h-11 ltr-nums"
          autoComplete="username"
        />
      </div>

      {/* كلمة المرور مع toggle */}
      <div className="space-y-1.5">
        <العنوان مطلوب htmlFor="password">{t("login.password")}</العنوان>
        <div className="relative">
          <الحقل
            id="password"
            type={إظهار ? "text" : "password"}
            value={كلمة}
            onChange={(e) => تعيين_كلمة(e.target.value)}
            placeholder="••••••••"
            className="h-11 ps-10"
            autoComplete="current-password"
          />
          <button
            type="button"
            onClick={() => تعيين_إظهار((v) => !v)}
            className="absolute start-3 top-1/2 -translate-y-1/2 rounded-md p-1 text-muted-foreground transition-colors hover:bg-muted hover:text-foreground focus:outline-none"
            tabIndex={-1}
            aria-label={إظهار ? "إخفاء" : "إظهار"}
          >
            {إظهار ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
          </button>
        </div>
      </div>

      {/* رسالة الخطأ */}
      {خطأ && (
        <div className="flex items-center gap-2 rounded-lg border border-danger/20 bg-danger-soft px-3 py-2.5 text-sm text-danger">
          <span className="size-1.5 shrink-0 rounded-full bg-danger" />
          {t("login.error")}
        </div>
      )}

      {/* زر الدخول */}
      <الزر type="submit" className="h-11 w-full gap-2 text-base" disabled={جارٍ}>
        {جارٍ ? (
          <>
            <span className="size-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
            {t("login.submitting")}
          </>
        ) : (
          <>
            <LogIn className="size-4" />
            {t("login.submit")}
          </>
        )}
      </الزر>

      <p className="text-center text-xs text-muted-foreground">{t("login.forgot")}</p>
    </form>
  );
}
