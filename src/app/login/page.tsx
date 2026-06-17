import { redirect } from "next/navigation";
import { المستخدم_الحالي } from "@/lib/session";
import { مترجم_الخادم } from "@/lib/i18n/server";
import { نموذج_الدخول } from "./form";
import { زر_المظهر, زر_اللغة } from "@/components/shell/toggles";

export const metadata = { title: "تسجيل الدخول — سُكر" };

export default async function صفحة_الدخول() {
  const م = await المستخدم_الحالي();
  if (م) redirect("/");
  const { t } = مترجم_الخادم();

  return (
    <div className="auth-aurora relative flex min-h-screen items-center justify-center bg-appgray p-4">
      {/* أزرار الإعدادات — أعلى اليمين */}
      <div className="absolute top-4 end-4 flex items-center gap-1">
        <زر_اللغة />
        <زر_المظهر />
      </div>

      <div className="w-full max-w-md">
        {/* بطاقة الدخول */}
        <div className="overflow-hidden rounded-2xl border border-border bg-card shadow-xl">

          {/* رأس البطاقة — لون التمييز */}
          <div className="bg-primary px-8 py-7 text-center">
            <div className="mb-1 text-5xl font-extrabold tracking-tight text-white">
              سُكر
            </div>
            <p className="text-sm text-white/70">{t("app.tagline")}</p>
          </div>

          {/* خط فاصل ناعم */}
          <div className="relative flex items-center px-8">
            <div className="flex-1 border-t border-border" />
            <span className="mx-3 rounded-full border border-border bg-card px-3 py-1 text-xs text-muted-foreground">
              {t("login.title")}
            </span>
            <div className="flex-1 border-t border-border" />
          </div>

          {/* النموذج */}
          <div className="px-8 py-6">
            <نموذج_الدخول />
          </div>
        </div>

        {/* تلميح أسفل البطاقة */}
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t("login.owners_hint")}
        </p>
      </div>
    </div>
  );
}
