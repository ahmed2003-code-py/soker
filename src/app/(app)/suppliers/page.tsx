import { ترويسة_الصفحة } from "@/components/page-header";
import { حالة_فارغة } from "@/components/empty-state";

export const metadata = { title: "الموردون — سُكر" };

export default function صفحة_الموردين() {
  return (
    <div>
      <ترويسة_الصفحة العنوان="الموردون" الوصف="إدارة الموردين وكشوف حساباتهم" />
      <حالة_فارغة العنوان="الموردون" الوصف="تُبنى في المرحلة 4." />
    </div>
  );
}
