"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Upload, ImageIcon } from "lucide-react";
import { الزر } from "@/components/ui/button";
import { الحقل } from "@/components/ui/input";
import { العنوان } from "@/components/ui/label";
import { useإشعار } from "@/components/ui/toast";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";
import { حفظ_الإعدادات_العامة, حفظ_شعار_الشركة, حفظ_حدود_الخزنة } from "./actions";

type قيم = {
  اسم_الشركة: string;
  شعار_الشركة: string;
  حد_الائتمان_الافتراضي: string;
  طرق_الدفع: string[];
};

type حساب_خزنة = { id: number; التسمية: string; الحد_الأدنى: string };

export function شاشة_الإعدادات({
  القيم,
  الحسابات,
}: {
  القيم: قيم;
  الحسابات: حساب_خزنة[];
}) {
  return (
    <div className="grid gap-6 lg:grid-cols-2">
      <بطاقة_الشركة الابتدائي={القيم} />
      <بطاقة_الشعار الشعار={القيم.شعار_الشركة} />
      <بطاقة_حدود_الخزنة الحسابات={الحسابات} />
    </div>
  );
}

// ============================================================
// بطاقة 1: بيانات الشركة + حد الائتمان + طرق الدفع
// ============================================================
function بطاقة_الشركة({ الابتدائي }: { الابتدائي: قيم }) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t } = استخدام_اللغة();
  const [اسم, تعيين_اسم] = React.useState(الابتدائي.اسم_الشركة);
  const [حد, تعيين_حد] = React.useState(الابتدائي.حد_الائتمان_الافتراضي);
  const [طرق, تعيين_طرق] = React.useState<string[]>(الابتدائي.طرق_الدفع);
  const [طريقة_جديدة, تعيين_طريقة_جديدة] = React.useState("");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  function أضف_طريقة() {
    const ن = طريقة_جديدة.trim();
    if (!ن) return;
    if (طرق.includes(ن)) {
      إشعار.خطأ(t("set.method_exists"));
      return;
    }
    تعيين_طرق([...طرق, ن]);
    تعيين_طريقة_جديدة("");
  }

  function احذف_طريقة(ن: string) {
    if (طرق.length === 1) {
      إشعار.خطأ(t("set.method_keep_one"));
      return;
    }
    تعيين_طرق(طرق.filter((x) => x !== ن));
  }

  async function احفظ() {
    تعيين_جارٍ(true);
    const r = await حفظ_الإعدادات_العامة({
      اسم_الشركة: اسم,
      حد_الائتمان_الافتراضي: حد,
      طرق_الدفع: طرق,
    });
    تعيين_جارٍ(false);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    إشعار.نجاح(r.رسالة!);
    router.refresh();
  }

  return (
    <div className="card-soft p-5">
      <h2 className="text-base font-bold">{t("set.company.title")}</h2>
      <p className="text-xs text-muted-foreground">{t("set.company.hint")}</p>
      <div className="mt-4 space-y-4">
        <div className="space-y-1.5">
          <العنوان مطلوب>{t("set.company.name")}</العنوان>
          <الحقل value={اسم} onChange={(e) => تعيين_اسم(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <العنوان>{t("set.company.credit")}</العنوان>
          <الحقل selectOnFocus value={حد} onChange={(e) => تعيين_حد(e.target.value)} placeholder="0.00" />
          <p className="text-xs text-muted-foreground">{t("set.company.credit_hint")}</p>
        </div>
        <div className="space-y-1.5">
          <العنوان>{t("set.methods")}</العنوان>
          <div className="flex flex-wrap gap-2">
            {طرق.map((ن) => (
              <span key={ن} className="inline-flex items-center gap-1 rounded-full border border-border bg-appgray/60 px-3 py-1 text-sm">
                {ن}
                <button onClick={() => احذف_طريقة(ن)} className="text-muted-foreground hover:text-danger" type="button">
                  <Trash2 className="size-3.5" />
                </button>
              </span>
            ))}
          </div>
          <div className="mt-2 flex gap-2">
            <الحقل
              value={طريقة_جديدة}
              onChange={(e) => تعيين_طريقة_جديدة(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") {
                  e.preventDefault();
                  أضف_طريقة();
                }
              }}
              placeholder={t("set.method_new")}
            />
            <الزر variant="outline" onClick={أضف_طريقة} type="button">
              <Plus className="size-4" /> {t("common.add")}
            </الزر>
          </div>
        </div>
      </div>
      <div className="mt-5 flex justify-end">
        <الزر variant="success" onClick={احفظ} disabled={جارٍ}>
          {جارٍ ? t("common.saving") : t("common.save")}
        </الزر>
      </div>
    </div>
  );
}

// ============================================================
// بطاقة 2: شعار الشركة
// ============================================================
function بطاقة_الشعار({ الشعار }: { الشعار: string }) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t } = استخدام_اللغة();
  const [معاينة, تعيين_معاينة] = React.useState(الشعار);
  const [جارٍ, تعيين_جارٍ] = React.useState(false);
  const مرجع = React.useRef<HTMLInputElement>(null);

  function اختر_ملف(ملف: File) {
    if (!ملف.type.startsWith("image/")) {
      إشعار.خطأ(t("set.logo.must_image"));
      return;
    }
    if (ملف.size > 1_500_000) {
      إشعار.خطأ(t("set.logo.too_large"));
      return;
    }
    const قارئ = new FileReader();
    قارئ.onload = () => تعيين_معاينة(قارئ.result as string);
    قارئ.readAsDataURL(ملف);
  }

  async function احفظ() {
    تعيين_جارٍ(true);
    const r = await حفظ_شعار_الشركة(معاينة || null);
    تعيين_جارٍ(false);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    إشعار.نجاح(r.رسالة!);
    router.refresh();
  }

  async function احذف() {
    تعيين_معاينة("");
    تعيين_جارٍ(true);
    const r = await حفظ_شعار_الشركة(null);
    تعيين_جارٍ(false);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    إشعار.نجاح(r.رسالة!);
    router.refresh();
  }

  return (
    <div className="card-soft p-5">
      <h2 className="text-base font-bold">{t("set.logo.title")}</h2>
      <p className="text-xs text-muted-foreground">{t("set.logo.hint")}</p>
      <div className="mt-4 flex items-start gap-4">
        <div className="flex size-32 shrink-0 items-center justify-center rounded-xl border border-dashed border-border bg-appgray/40 p-2">
          {معاينة ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img src={معاينة} alt={t("set.logo.alt")} className="max-h-full max-w-full object-contain" />
          ) : (
            <ImageIcon className="size-10 text-muted-foreground" />
          )}
        </div>
        <div className="flex-1 space-y-2">
          <input
            ref={مرجع}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={(e) => {
              const f = e.target.files?.[0];
              if (f) اختر_ملف(f);
            }}
          />
          <div className="flex flex-wrap gap-2">
            <الزر variant="outline" onClick={() => مرجع.current?.click()} type="button">
              <Upload className="size-4" /> {t("set.logo.choose")}
            </الزر>
            {معاينة && (
              <الزر variant="outline" onClick={احذف} disabled={جارٍ} type="button">
                <Trash2 className="size-4 text-danger" /> {t("common.delete")}
              </الزر>
            )}
            <الزر variant="success" onClick={احفظ} disabled={جارٍ || !معاينة || معاينة === الشعار}>
              {جارٍ ? t("common.saving") : t("set.logo.save")}
            </الزر>
          </div>
        </div>
      </div>
    </div>
  );
}

// ============================================================
// بطاقة 3: حدود الخزنة الدنيا
// ============================================================
function بطاقة_حدود_الخزنة({ الحسابات }: { الحسابات: حساب_خزنة[] }) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t } = استخدام_اللغة();
  const [قيم, تعيين] = React.useState<Record<number, string>>(() =>
    Object.fromEntries(الحسابات.map((h) => [h.id, h.الحد_الأدنى]))
  );
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  async function احفظ() {
    تعيين_جارٍ(true);
    const r = await حفظ_حدود_الخزنة(
      Object.fromEntries(Object.entries(قيم).map(([k, v]) => [k, v || "0"]))
    );
    تعيين_جارٍ(false);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    إشعار.نجاح(r.رسالة!);
    router.refresh();
  }

  return (
    <div className="card-soft p-5 lg:col-span-2">
      <h2 className="text-base font-bold">{t("set.thresholds.title")}</h2>
      <p className="text-xs text-muted-foreground">
        {t("set.thresholds.hint")}
      </p>
      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        {الحسابات.map((h) => (
          <div key={h.id} className="space-y-1.5">
            <العنوان>{h.التسمية}</العنوان>
            <الحقل
              selectOnFocus
              value={قيم[h.id] ?? "0"}
              onChange={(e) => تعيين({ ...قيم, [h.id]: e.target.value })}
              placeholder="0.00"
            />
          </div>
        ))}
      </div>
      <div className="mt-4 flex justify-end">
        <الزر variant="success" onClick={احفظ} disabled={جارٍ}>
          {جارٍ ? t("common.saving") : t("set.thresholds.save")}
        </الزر>
      </div>
    </div>
  );
}
