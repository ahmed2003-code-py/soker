"use client";
import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { الزر } from "@/components/ui/button";
import { الحقل } from "@/components/ui/input";
import { العنوان } from "@/components/ui/label";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";

export function نموذج_الدخول() {
  const router = useRouter();
  const { t } = استخدام_اللغة();
  const [اسم, تعيين_اسم] = React.useState("");
  const [كلمة, تعيين_كلمة] = React.useState("");
  const [خطأ, تعيين_خطأ] = React.useState<boolean>(false);
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  async function إرسال(e: React.FormEvent) {
    e.preventDefault();
    تعيين_خطأ(false);
    تعيين_جارٍ(true);
    const res = await signIn("credentials", {
      username: اسم,
      password: كلمة,
      redirect: false,
    });
    تعيين_جارٍ(false);
    if (res?.error) {
      تعيين_خطأ(true);
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={إرسال} className="space-y-4">
      <h2 className="text-lg font-semibold">{t("login.title")}</h2>
      <div className="space-y-1.5">
        <العنوان مطلوب htmlFor="username">{t("login.username")}</العنوان>
        <الحقل
          id="username"
          autoFocus
          value={اسم}
          onChange={(e) => تعيين_اسم(e.target.value)}
          placeholder="ahmed"
          className="ltr-nums"
          autoComplete="username"
        />
      </div>
      <div className="space-y-1.5">
        <العنوان مطلوب htmlFor="password">{t("login.password")}</العنوان>
        <الحقل
          id="password"
          type="password"
          value={كلمة}
          onChange={(e) => تعيين_كلمة(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
        />
      </div>
      {خطأ && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{t("login.error")}</p>
      )}
      <الزر type="submit" className="w-full" disabled={جارٍ}>
        {جارٍ ? t("login.submitting") : t("login.submit")}
      </الزر>
      <p className="text-center text-xs text-muted-foreground">{t("login.forgot")}</p>
    </form>
  );
}
