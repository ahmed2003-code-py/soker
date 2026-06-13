import { redirect } from "next/navigation";

export default function الصفحة_الرئيسية() {
  // في المرحلة 0 نوجّه إلى دليل الأنماط؛ يُستبدل لاحقاً بلوحة التحكم/تسجيل الدخول.
  redirect("/style-guide");
}
