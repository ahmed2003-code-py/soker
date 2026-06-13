"use client";
import * as React from "react";
import { Upload, ScanLine, Loader2, Camera } from "lucide-react";
import { الزر } from "@/components/ui/button";
import { useإشعار } from "@/components/ui/toast";

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
}: {
  عند_الاستخراج: (حقول: حقول_مستخرجة, نص_خام: string) => void;
  عند_الصورة: (base64: string, mime: string, نص?: string) => void;
}) {
  const إشعار = useإشعار();
  const [معاينة, تعيين_معاينة] = React.useState<string | null>(null);
  const [جارٍ, تعيين_جارٍ] = React.useState(false);
  const [ملف, تعيين_ملف] = React.useState<File | null>(null);
  const مرجع = React.useRef<HTMLInputElement>(null);

  function اختر(f: File | null) {
    if (!f) return;
    if (f.size > 6 * 1024 * 1024) {
      إشعار.خطأ("حجم الصورة كبير (الحد 6MB)");
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
      إشعار.خطأ("اختر صورة الشيك أولاً");
      return;
    }
    تعيين_جارٍ(true);
    try {
      const fd = new FormData();
      fd.append("image", ملف);
      const res = await fetch("/api/cheques/ocr", { method: "POST", body: fd });
      if (!res.ok) throw new Error("تعذّر الاستخراج");
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
        عدد ? `تم استخراج ${عدد} حقل` : "لم يتم اكتشاف حقول واضحة",
        "راجع البيانات وأكملها يدوياً"
      );
    } catch (e) {
      إشعار.خطأ((e as Error).message, "أكمل البيانات يدوياً");
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
          <Upload className="size-4" /> رفع صورة الشيك
        </الزر>
        <الزر type="button" variant="blue" size="sm" onClick={استخرج} disabled={!ملف || جارٍ}>
          {جارٍ ? <Loader2 className="size-4 animate-spin" /> : <ScanLine className="size-4" />}
          استخراج تلقائي (OCR)
        </الزر>
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Camera className="size-3.5" /> يمكن التقاط صورة بالكاميرا على الموبايل — أو تخطّي والإدخال يدوياً
        </span>
      </div>
      {معاينة && (
        // eslint-disable-next-line @next/next/no-img-element
        <img src={معاينة} alt="معاينة الشيك" className="mt-3 max-h-40 rounded-lg border border-border" />
      )}
    </div>
  );
}
