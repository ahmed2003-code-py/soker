import { Inbox } from "lucide-react";

type الخصائص = {
  العنوان?: string;
  الوصف?: string;
  أيقونة?: React.ReactNode;
  إجراء?: React.ReactNode;
};

export function حالة_فارغة({
  العنوان = "لا توجد بيانات",
  الوصف,
  أيقونة,
  إجراء,
}: الخصائص) {
  return (
    <div className="flex flex-col items-center justify-center gap-3 rounded-xl border border-dashed border-border bg-white px-6 py-14 text-center">
      <div className="rounded-full bg-appgray p-4 text-muted-foreground">
        {أيقونة ?? <Inbox className="size-7" />}
      </div>
      <p className="font-medium text-foreground">{العنوان}</p>
      {الوصف && <p className="max-w-sm text-sm text-muted-foreground">{الوصف}</p>}
      {إجراء && <div className="mt-2">{إجراء}</div>}
    </div>
  );
}
