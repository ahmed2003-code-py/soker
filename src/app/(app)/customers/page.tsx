import { ترويسة_الصفحة } from "@/components/page-header";
import { حالة_فارغة } from "@/components/empty-state";

export const metadata = { title: "العملاء — سُكر" };

export default function صفحة_العملاء() {
  return (
    <div>
      <ترويسة_الصفحة العنوان="العملاء" الوصف="إدارة العملاء وكشوف حساباتهم" />
      <حالة_فارغة العنوان="العملاء" الوصف="تُبنى في المرحلة 4." />
    </div>
  );
}
