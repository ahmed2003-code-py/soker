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
      <div className="absolute top-4 end-4 flex items-center gap-1">
        <زر_اللغة />
        <زر_المظهر />
      </div>
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-4xl font-bold text-primary">{t("app.name")}</h1>
          <p className="mt-1 text-sm text-muted-foreground">{t("app.tagline")}</p>
        </div>
        <div className="glass-card p-6 sm:p-8">
          <نموذج_الدخول />
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          {t("login.owners_hint")}
        </p>
      </div>
    </div>
  );
}
