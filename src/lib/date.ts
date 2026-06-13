import { format, parse, isValid, startOfMonth, endOfMonth } from "date-fns";

/** عرض التاريخ بنمط dd/mm/yyyy */
export function تنسيق_تاريخ(التاريخ: Date | string | null | undefined): string {
  if (!التاريخ) return "";
  const د = typeof التاريخ === "string" ? new Date(التاريخ) : التاريخ;
  if (!isValid(د)) return "";
  return format(د, "dd/MM/yyyy");
}

/** عرض التاريخ والوقت dd/mm/yyyy HH:mm */
export function تنسيق_تاريخ_ووقت(التاريخ: Date | string | null | undefined): string {
  if (!التاريخ) return "";
  const د = typeof التاريخ === "string" ? new Date(التاريخ) : التاريخ;
  if (!isValid(د)) return "";
  return format(د, "dd/MM/yyyy HH:mm");
}

/** اسم الشهر بالعربية + السنة، مثل: "يونيو 2026" */
const أشهر_عربية = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
export function اسم_الشهر(التاريخ: Date | string): string {
  const د = typeof التاريخ === "string" ? new Date(التاريخ) : التاريخ;
  if (!isValid(د)) return "";
  return `${أشهر_عربية[د.getMonth()]} ${د.getFullYear()}`;
}

/** مفتاح شهر للتجميع: yyyy-MM */
export function مفتاح_الشهر(التاريخ: Date | string): string {
  const د = typeof التاريخ === "string" ? new Date(التاريخ) : التاريخ;
  return format(د, "yyyy-MM");
}

/** قبول dd/mm/yyyy أو yyyy-MM-dd وإرجاع Date أو null */
export function تحليل_تاريخ(الإدخال: string | null | undefined): Date | null {
  if (!الإدخال) return null;
  const نص = الإدخال.trim();
  for (const نمط of ["yyyy-MM-dd", "dd/MM/yyyy", "d/M/yyyy", "yyyy/MM/dd"]) {
    const د = parse(نص, نمط, new Date());
    if (isValid(د)) return د;
  }
  const احتياطي = new Date(نص);
  return isValid(احتياطي) ? احتياطي : null;
}

export function اليوم(): Date {
  const الآن = new Date();
  return new Date(الآن.getFullYear(), الآن.getMonth(), الآن.getDate());
}

export { startOfMonth as بداية_الشهر, endOfMonth as نهاية_الشهر };
