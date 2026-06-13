import { ترويسة_الصفحة } from "@/components/page-header";
import { حالة_فارغة } from "@/components/empty-state";

export const metadata = { title: "التقارير — سُكر" };

export default function صفحة_التقارير() {
  return (
    <div>
      <ترويسة_الصفحة العنوان="التقارير" الوصف="تقارير وتصدير PDF/Excel" />
      <حالة_فارغة العنوان="التقارير" الوصف="تُبنى في المرحلة 12." />
    </div>
  );
}
