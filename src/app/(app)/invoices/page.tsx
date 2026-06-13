import { ترويسة_الصفحة } from "@/components/page-header";
import { حالة_فارغة } from "@/components/empty-state";

export const metadata = { title: "الفواتير — سُكر" };

export default function صفحة_الفواتير() {
  return (
    <div>
      <ترويسة_الصفحة العنوان="الفواتير" الوصف="إدارة الفواتير" />
      <حالة_فارغة العنوان="الفواتير" الوصف="تُبنى في المرحلة 6." />
    </div>
  );
}
