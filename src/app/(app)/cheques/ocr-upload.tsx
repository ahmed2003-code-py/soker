"use client";
import * as React from "react";
import { Upload, ScanLine, Loader2, Camera, X } from "lucide-react";
import { الزر } from "@/components/ui/button";
import { useإشعار } from "@/components/ui/toast";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";

type حقول_مستخرجة = Partial<{
  اسم_المدين: string;
  المبلغ: string;
  المستفيد: string;
  محول_من: string;
  اسم_البنك: string;
  تاريخ_الاستحقاق: string;
  رقم_الشيك: string;
}>;

/**
 * رفع صورة الشيك + استخراج تلقائي عبر OCR (المرحلة 8).
 * يخزّن الصورة كـ base64 (تُحفظ في Postgres) ويملأ الحقول المكتشفة.
 */
export function حقول_OCR_للشيك({
  عند_الاستخراج,
  عند_الصورة,
  عند_المسح,
}: {
  عند_الاستخراج: (حقول: حقول_مستخرجة, نص_خام: string) => void;
  عند_الصورة: (base64: string, mime: string, نص?: string) => void;
  عند_المسح?: () => void;
}) {
  const إشعار = useإشعار();
  const { t, لغة } = استخدام_اللغة();
  const [معاينة, تعيين_معاينة] = React.useState<string | null>(null);
  const [جارٍ, تعيين_جارٍ] = React.useState(false);
  const [ملف, تعيين_ملف] = React.useState<File | null>(null);
  const مرجع = React.useRef<HTMLInputElement>(null);

  function امسح_الصورة() {
    تعيين_معاينة(null);
    تعيين_ملف(null);
    if (مرجع.current) مرجع.current.value = "";
    عند_المسح?.();
  }

  function اختر(f: File | null) {
    if (!f) return;
    if (f.size > 6 * 1024 * 1024) {
      إشعار.خطأ(t("ocr.too_large"));
      return;
    }
    تعيين_ملف(f);
    const reader = new FileReader();
    reader.onload = () => {
      const base64 = reader.result as string;
      تعيين_معاينة(base64);
      عند_الصورة(base64, f.type);
    };
    reader.readAsDataURL(f);
  }

  async function استخرج() {
    if (!ملف) {
      إشعار.خطأ(t("ocr.choose_first"));
      return;
    }
    تعيين_جارٍ(true);
    try {
      const fd = new FormData();
      fd.append("image", ملف);
      const res = await fetch("/api/cheques/ocr", { method: "POST", body: fd });
      if (!res.ok) throw new Error(t("ocr.failed"));
      const data = await res.json();
      const حقول: حقول_مستخرجة = {};
      for (const [ك, ق] of Object.entries(data.حقول ?? {})) {
        const v = (ق as { القيمة?: string } | null)?.القيمة;
        if (v) (حقول as Record<string, string>)[ك] = v;
      }
      عند_الاستخراج(حقول, data.نص_OCR ?? "");
      if (معاينة) عند_الصورة(معاينة, ملف.type, data.نص_OCR ?? "");
      const عدد = Object.keys(حقول).length;
      إشعار.نجاح(
        عدد ? t("ocr.extracted", { count: عدد }) : t("ocr.none_detected"),
        t("ocr.review_hint")
      );
    } catch (e) {
      إشعار.خطأ((e as Error).message, t("ocr.manual_hint"));
    } finally {
      تعيين_جارٍ(false);
    }
  }

  return (
    <div className="mb-4 rounded-xl border border-dashed border-border bg-appgray/50 p-4">
      <div className="flex flex-wrap items-center gap-3">
        <input
          ref={مرجع}
          type="file"
          accept="image/*"
          capture="environment"
          className="hidden"
          onChange={(e) => اختر(e.target.files?.[0] ?? null)}
        />
        <الزر type="button" variant="outline" size="sm" onClick={() => مرجع.current?.click()}>
          <Upload className="size-4" /> {t("ocr.upload")}
        </الزر>
        <الزر type="button" variant="blue" size="sm" onClick={استخرج} disabled={!ملف || جارٍ}>
          {جارٍ ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />}
          {t("ocr.extract")}
        </الزر>
        {معاينة && (
          <الزر type="button" variant="ghost" size="sm" onClick={امسح_الصورة} disabled={جارٍ}>
            <X className="size-4 text-danger" /> {لغة === "ar" ? "مسح الصورة" : "Remove image"}
          </الزر>
        )}
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Camera className="size-3.5" /> {t("ocr.camera_hint")}
        </span>
      </div>
      {معاينة && (
        <div className="relative mt-3 inline-block">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={معاينة} alt={t("ocr.preview_alt")} className="max-h-40 rounded-lg border border-border" />
          <button
            type="button"
            onClick={امسح_الصورة}
            title={لغة === "ar" ? "مسح الصورة" : "Remove image"}
            className="absolute end-2 top-2 rounded-full bg-black/60 p-1 text-white transition hover:bg-danger"
          >
            <X className="size-4" />
          </button>
        </div>
      )}
    </div>
  );
}
