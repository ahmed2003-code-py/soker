import { parse, isValid, startOfMonth, endOfMonth } from "date-fns";

const TZ = "Africa/Cairo";

/** استخرج مكوّنات التاريخ والوقت بتوقيت القاهرة (UTC+3، بلا DST منذ 2011) */
function أجزاء_قاهرة(د: Date) {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit", hour12: false,
  }).formatToParts(د);
  const g = (t: string) => parts.find((p) => p.type === t)?.value ?? "00";
  return {
    year: parseInt(g("year")),
    month: parseInt(g("month")) - 1,
    day: parseInt(g("day")),
    hour: parseInt(g("hour")),
    minute: parseInt(g("minute")),
  };
}

/** عرض التاريخ بنمط dd/mm/yyyy بتوقيت القاهرة */
export function تنسيق_تاريخ(التاريخ: Date | string | null | undefined): string {
  if (!التاريخ) return "";
  const د = typeof التاريخ === "string" ? new Date(التاريخ) : التاريخ;
  if (!isValid(د)) return "";
  const { day, month, year } = أجزاء_قاهرة(د);
  return `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year}`;
}

/** عرض التاريخ والوقت dd/mm/yyyy HH:mm بتوقيت القاهرة */
export function تنسيق_تاريخ_ووقت(التاريخ: Date | string | null | undefined): string {
  if (!التاريخ) return "";
  const د = typeof التاريخ === "string" ? new Date(التاريخ) : التاريخ;
  if (!isValid(د)) return "";
  const { day, month, year, hour, minute } = أجزاء_قاهرة(د);
  return `${String(day).padStart(2, "0")}/${String(month + 1).padStart(2, "0")}/${year} ${String(hour).padStart(2, "0")}:${String(minute).padStart(2, "0")}`;
}

/** اسم الشهر بالعربية + السنة بتوقيت القاهرة */
const أشهر_عربية = [
  "يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو",
  "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر",
];
export function اسم_الشهر(التاريخ: Date | string): string {
  const د = typeof التاريخ === "string" ? new Date(التاريخ) : التاريخ;
  if (!isValid(د)) return "";
  const { month, year } = أجزاء_قاهرة(د);
  return `${أشهر_عربية[month]} ${year}`;
}

/** مفتاح شهر للتجميع: yyyy-MM بتوقيت القاهرة */
export function مفتاح_الشهر(التاريخ: Date | string): string {
  const د = typeof التاريخ === "string" ? new Date(التاريخ) : التاريخ;
  const { year, month } = أجزاء_قاهرة(د);
  return `${year}-${String(month + 1).padStart(2, "0")}`;
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

/** اليوم الحالي كمنتصف ليل بتوقيت القاهرة */
export function اليوم(): Date {
  const { year, month, day } = أجزاء_قاهرة(new Date());
  return new Date(year, month, day);
}

export { startOfMonth as بداية_الشهر, endOfMonth as نهاية_الشهر };
