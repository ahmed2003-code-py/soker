/**
 * تنقّل بالكيبورد داخل الحوارات (البوب-أب):
 * - Enter في حقل إدخال → ينتقل للحقل التالي (زي الفاتورة).
 * - القوائم المنبثقة (combobox) تتحكم بنفسها بالأسهم وتنتقل تلقائياً بعد الاختيار.
 */
import type React from "react";

/** العناصر القابلة للتركيز داخل جذر (حقول إدخال + مُشغّلات القوائم). */
export function عناصر_قابلة_للتركيز(جذر: Element): HTMLElement[] {
  return Array.from(
    جذر.querySelectorAll<HTMLElement>(
      'input:not([disabled]):not([type="hidden"]), textarea:not([disabled]), button[data-cb-trigger]:not([disabled])'
    )
  ).filter((el) => el.offsetParent !== null);
}

/** ركّز العنصر التالي للعنصر الحالي داخل أقرب حوار. */
export function ركّز_التالي(الحالي: HTMLElement): void {
  const حوار = الحالي.closest('[role="dialog"]');
  if (!حوار) return; // خارج الحوارات لا ننقل التركيز (فلاتر الصفحات)
  const عناصر = عناصر_قابلة_للتركيز(حوار);
  const i = عناصر.indexOf(الحالي);
  if (i >= 0 && i < عناصر.length - 1) عناصر[i + 1].focus();
}

/**
 * معالج Enter على مستوى الحوار: ينقل التركيز من حقل الإدخال للتالي.
 * يُركَّب على عنصر محتوى الحوار: <div onKeyDown={عند_إنتر_للتالي}>.
 */
export function عند_إنتر_للتالي(e: React.KeyboardEvent<HTMLElement>): void {
  if (e.key !== "Enter") return;
  const هدف = e.target as HTMLElement;
  const وسم = هدف.tagName;
  // نتعامل فقط مع حقول <input> النصية/الرقمية
  if (وسم !== "INPUT") return;
  const نوع = (هدف as HTMLInputElement).type;
  if (نوع === "checkbox" || نوع === "radio" || نوع === "button" || نوع === "submit") return;
  // قائمة منبثقة مفتوحة → اترك الاختيار يتم بداخلها
  if (document.querySelector("[data-radix-popper-content-wrapper]")) return;
  e.preventDefault();
  ركّز_التالي(هدف);
}
