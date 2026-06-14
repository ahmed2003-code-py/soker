import { redirect } from "next/navigation";
import { المستخدم_الحالي } from "@/lib/session";
import { مترجم_الخادم } from "@/lib/i18n/server";
import { نموذج_تغيير_كلمة } from "./form";

export const metadata = { title: "تغيير كلمة المرور — سُكر" };

export default async function صفحة_تغيير_كلمة() {
  const م = await المستخدم_الحالي();
  if (!م) redirect("/login");
  const { t } = مترجم_الخادم();
  return (
    <div className="auth-aurora flex min-h-screen items-center justify-center bg-appgray p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-2xl font-bold text-primary">{t("cpw.title")}</h1>
          {م.mustChangePassword && (
            <p className="mt-2 rounded-lg bg-warning-soft px-3 py-2 text-sm text-warning">
              {t("cpw.must_change")}
            </p>
          )}
        </div>
        <div className="glass-card p-6 sm:p-8">
          <نموذج_تغيير_كلمة />
        </div>
      </div>
    </div>
  );
}
