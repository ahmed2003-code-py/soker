import { القاموس, type مفتاح_ترجمة } from "./dictionary";

export type لغة = "ar" | "en";
export type مظهر = "light" | "dark";

export const اللغة_الافتراضية: لغة = "ar";
export const المظهر_الافتراضي: مظهر = "light";

export const اسم_كوكي_اللغة = "soker_lang";
export const اسم_كوكي_المظهر = "soker_theme";

/** اتجاه الصفحة حسب اللغة. */
export function اتجاه(ل: لغة): "rtl" | "ltr" {
  return ل === "ar" ? "rtl" : "ltr";
}

export function لغة_صالحة(قيمة: string | undefined | null): لغة {
  return قيمة === "en" ? "en" : "ar";
}

export function مظهر_صالح(قيمة: string | undefined | null): مظهر {
  return قيمة === "dark" ? "dark" : "light";
}

/** ينشئ دالة ترجمة `t` مربوطة بلغة. تدعم استبدال متغيّرات {name}. */
export function إنشاء_مترجم(ل: لغة) {
  const جدول = القاموس[ل] ?? القاموس.ar;
  return function t(مفتاح: مفتاح_ترجمة, متغيّرات?: Record<string, string | number>): string {
    let نص: string = (جدول as Record<string, string>)[مفتاح] ?? (القاموس.ar as Record<string, string>)[مفتاح] ?? مفتاح;
    if (متغيّرات) {
      for (const [ك, ق] of Object.entries(متغيّرات)) {
        نص = نص.replace(new RegExp(`\\{${ك}\\}`, "g"), String(ق));
      }
    }
    return نص;
  };
}

export type { مفتاح_ترجمة };
