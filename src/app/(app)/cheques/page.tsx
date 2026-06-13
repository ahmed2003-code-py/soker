import { ترويسة_الصفحة } from "@/components/page-header";
import { حالة_فارغة } from "@/components/empty-state";

export const metadata = { title: "الشيكات — سُكر" };

export default function صفحة_الشيكات() {
  return (
    <div>
      <ترويسة_الصفحة العنوان="الشيكات" الوصف="إدارة الشيكات والتجميع الشهري" />
      <حالة_فارغة العنوان="الشيكات" الوصف="تُبنى في المرحلتين 7 و 8." />
    </div>
  );
}
