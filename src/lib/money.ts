/**
 * أدوات عرض/إدخال المبالغ — نقية (آمنة للعميل والخادم).
 * كل الحسابات الدقيقة تتم عبر Prisma.Decimal في الخادم (انظر lib/decimal.ts).
 * هنا فقط: تنسيق للعرض + تحليل إدخال المستخدم. لا نستخدم عمليات JS العائمة للمنطق المالي.
 */

const منسق_المبلغ = new Intl.NumberFormat("en-US", {
  minimumFractionDigits: 2,
  maximumFractionDigits: 2,
});

const منسق_رقم = new Intl.NumberFormat("en-US", {
  maximumFractionDigits: 3,
});

/** تحويل أي قيمة (Decimal/سلسلة/رقم) إلى سلسلة رقمية خام */
function إلى_سلسلة(القيمة: unknown): string {
  if (القيمة === null || القيمة === undefined) return "0";
  if (typeof القيمة === "number") return String(القيمة);
  if (typeof القيمة === "string") return القيمة;
  // كائنات Prisma.Decimal وغيرها تحوي toString
  return String(القيمة);
}

/** تنسيق مبلغ بالجنيه المصري: 1,250,475.00 */
export function تنسيق_مبلغ(القيمة: unknown): string {
  const رقم = Number(إلى_سلسلة(القيمة));
  if (!Number.isFinite(رقم)) return "0.00";
  return منسق_المبلغ.format(رقم);
}

/** تنسيق رقم عام (كمية/وزن) بحد أقصى 3 منازل */
export function تنسيق_رقم(القيمة: unknown): string {
  const رقم = Number(إلى_سلسلة(القيمة));
  if (!Number.isFinite(رقم)) return "0";
  return منسق_رقم.format(رقم);
}

/**
 * تحليل إدخال المستخدم: يقبل "1,250,475.50" أو "1250475.5" أو الأرقام العربية.
 * يعيد سلسلة رقمية صالحة (للتمرير إلى Decimal) أو null إن كان الإدخال غير صالح.
 */
export function تحليل_مبلغ(الإدخال: string | number | null | undefined): string | null {
  if (الإدخال === null || الإدخال === undefined) return null;
  let نص = String(الإدخال).trim();
  if (نص === "") return null;
  // تحويل الأرقام العربية إلى لاتينية
  نص = نص.replace(/[٠-٩]/g, (d) => String("٠١٢٣٤٥٦٧٨٩".indexOf(d)));
  نص = نص.replace(/[۰-۹]/g, (d) => String("۰۱۲۳۴۵۶۷۸۹".indexOf(d)));
  // إزالة فواصل الآلاف والمسافات والرمز
  نص = نص.replace(/[,\s]/g, "").replace(/[٫]/g, ".");
  if (!/^-?\d*\.?\d+$/.test(نص)) return null;
  return نص;
}

export { العملة };
const العملة = "ج.م";
