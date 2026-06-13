import type { Role } from "@prisma/client";

export type إجراء =
  | "قراءة"
  | "كتابة" // إنشاء/تعديل سجلات الأعمال
  | "حذف"
  | "إدارة_المستخدمين"
  | "إدارة_الإعدادات";

/** صلاحية موحّدة — تُفرض على الخادم في كل إجراء بغض النظر عن الواجهة */
export function يستطيع(الدور: Role, الإجراء: إجراء): boolean {
  switch (الدور) {
    case "ADMIN":
      return true;
    case "ACCOUNTANT":
      return الإجراء === "قراءة" || الإجراء === "كتابة" || الإجراء === "حذف";
    case "READONLY":
      return الإجراء === "قراءة";
    default:
      return false;
  }
}

/** يرمي خطأ إن لم يكن مصرّحاً */
export function تحقق_الصلاحية(الدور: Role, الإجراء: إجراء) {
  if (!يستطيع(الدور, الإجراء)) {
    throw new Error("غير مصرّح: لا تملك صلاحية هذا الإجراء");
  }
}
