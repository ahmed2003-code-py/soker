/** نوع نتيجة موحّد لكل الإجراءات (Server Actions) */
export type نتيجة<ت = undefined> =
  | { نجاح: true; رسالة?: string; بيانات?: ت }
  | { نجاح: false; رسالة: string; بيانات?: undefined };

export function نجح<ت>(بيانات?: ت, رسالة?: string): نتيجة<ت> {
  return { نجاح: true, بيانات, رسالة };
}

export function فشل(رسالة: string): نتيجة<never> {
  return { نجاح: false, رسالة };
}
