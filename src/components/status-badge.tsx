import { الشارة } from "@/components/ui/badge";

type متغير = "default" | "navy" | "success" | "danger" | "warning" | "outline";

/** خريطة الحالات الشائعة إلى ألوان الشارة */
const خريطة: Record<string, متغير> = {
  // الشيكات
  منتظر: "warning",
  محصّل: "success",
  مرتجع: "danger",
  متأخر: "danger",
  // عام
  نشط: "success",
  متوقف: "default",
  // الخزنة
  إيراد: "success",
  مصروف: "danger",
  // الأطراف
  عميل: "navy",
  مورد: "navy",
};

export function شارة_حالة({
  الحالة,
  متغيّر,
}: {
  الحالة: string;
  متغيّر?: متغير;
}) {
  return <الشارة variant={متغيّر ?? خريطة[الحالة] ?? "default"}>{الحالة}</الشارة>;
}
