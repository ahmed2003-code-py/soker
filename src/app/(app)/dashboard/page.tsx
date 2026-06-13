import { ترويسة_الصفحة } from "@/components/page-header";
import { حالة_فارغة } from "@/components/empty-state";

export const metadata = { title: "الرئيسية — سُكر" };

export default function صفحة_الرئيسية() {
  return (
    <div>
      <ترويسة_الصفحة العنوان="الرئيسية" الوصف="لوحة تحكم النظام" />
      <حالة_فارغة العنوان="لوحة التحكم" الوصف="ستُعرض المؤشرات والرسوم في المرحلة 10." />
    </div>
  );
}
