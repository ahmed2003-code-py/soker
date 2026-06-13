import { ترويسة_الصفحة } from "@/components/page-header";
import { حالة_فارغة } from "@/components/empty-state";

export const metadata = { title: "الخزنة — سُكر" };

export default function صفحة_الخزنة() {
  return (
    <div>
      <ترويسة_الصفحة العنوان="الخزنة" الوصف="الحسابات الأربعة وحركاتها" />
      <حالة_فارغة العنوان="الخزنة" الوصف="تُبنى في المرحلة 5." />
    </div>
  );
}
