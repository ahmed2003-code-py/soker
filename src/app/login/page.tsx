import { redirect } from "next/navigation";
import { المستخدم_الحالي } from "@/lib/session";
import { مترجم_الخادم } from "@/lib/i18n/server";
import { نموذج_الدخول } from "./form";
import { زر_المظهر, زر_اللغة } from "@/components/shell/toggles";
import { FileText, Wallet, Users, CheckSquare } from "lucide-react";

export const metadata = { title: "تسجيل الدخول — سُكر" };

export default async function صفحة_الدخول() {
  const م = await المستخدم_الحالي();
  if (م) redirect("/");
  const { t } = مترجم_الخادم();

  const الميزات = [
    { أيقونة: FileText, نص: "فواتير احترافية بالتفاصيل الكاملة" },
    { أيقونة: Wallet,   نص: "خزنة ذكية لمتابعة كل الحسابات" },
    { أيقونة: Users,    نص: "إدارة العملاء والموردين في مكان واحد" },
    { أيقونة: CheckSquare, نص: "شيكات واردة وصادرة مع تتبع تلقائي" },
  ];

  return (
    <div className="flex min-h-screen bg-appgray">
      {/* ===== اليمين: لوحة العلامة التجارية ===== */}
      <div className="relative hidden overflow-hidden md:flex md:w-1/2 lg:w-[55%]">
        {/* خلفية متدرجة */}
        <div
          className="absolute inset-0"
          style={{
            background:
              "linear-gradient(135deg, #0f2347 0%, #1F3864 45%, #2a4f8a 100%)",
          }}
        />
        {/* دوائر زخرفية */}
        <div className="absolute -top-32 -start-32 size-96 rounded-full bg-white/5" />
        <div className="absolute -bottom-40 -end-20 size-[28rem] rounded-full bg-white/5" />
        <div className="absolute top-1/2 start-1/2 -translate-x-1/2 -translate-y-1/2 size-[600px] rounded-full bg-white/[0.03]" />

        {/* المحتوى */}
        <div className="relative z-10 flex flex-col justify-between p-10 text-white lg:p-14">
          {/* الشعار */}
          <div>
            <div className="text-5xl font-extrabold tracking-tight lg:text-6xl">سُكر</div>
            <p className="mt-2 text-base text-white/60 lg:text-lg">{t("app.tagline")}</p>
          </div>

          {/* الميزات */}
          <div className="space-y-5">
            <p className="text-sm font-semibold uppercase tracking-widest text-white/40">
              كل أعمالك في منصة واحدة
            </p>
            {الميزات.map(({ أيقونة: Icon, نص }) => (
              <div key={نص} className="flex items-center gap-4">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-white/10">
                  <Icon className="size-5 text-white/80" />
                </span>
                <span className="text-sm text-white/75">{نص}</span>
              </div>
            ))}
          </div>

          {/* التذييل */}
          <p className="text-xs text-white/30">
            {t("login.owners_hint")}
          </p>
        </div>
      </div>

      {/* ===== الشمال: لوحة النموذج ===== */}
      <div className="relative flex flex-1 flex-col items-center justify-center px-6 py-12 md:px-10 lg:px-16">
        {/* أزرار الإعدادات */}
        <div className="absolute top-4 end-4 flex items-center gap-1">
          <زر_اللغة />
          <زر_المظهر />
        </div>

        <div className="w-full max-w-sm">
          {/* ترويسة صغيرة على الموبايل */}
          <div className="mb-8 md:hidden text-center">
            <div className="text-4xl font-extrabold text-primary">سُكر</div>
            <p className="mt-1 text-sm text-muted-foreground">{t("app.tagline")}</p>
          </div>

          {/* العنوان */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-foreground">أهلاً بك 👋</h1>
            <p className="mt-1 text-sm text-muted-foreground">
              سجّل دخولك لمتابعة أعمالك
            </p>
          </div>

          {/* خط فاصل */}
          <div className="mb-6 flex items-center gap-3">
            <div className="h-px flex-1 bg-border" />
            <span className="text-xs text-muted-foreground">بيانات الدخول</span>
            <div className="h-px flex-1 bg-border" />
          </div>

          {/* النموذج */}
          <نموذج_الدخول />
        </div>
      </div>
    </div>
  );
}
