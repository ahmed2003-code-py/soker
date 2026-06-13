import Link from "next/link";
import { cn } from "@/lib/utils";

type الخصائص = {
  العنوان: string;
  القيمة: React.ReactNode;
  أيقونة?: React.ReactNode;
  وصف?: string;
  لون?: "navy" | "success" | "danger" | "warning" | "neutral";
  رابط?: string;
};

const ألوان: Record<NonNullable<الخصائص["لون"]>, string> = {
  navy: "text-primary",
  success: "text-success",
  danger: "text-danger",
  warning: "text-warning",
  neutral: "text-foreground",
};

export function بطاقة_مؤشر({
  العنوان,
  القيمة,
  أيقونة,
  وصف,
  لون = "neutral",
  رابط,
}: الخصائص) {
  const المحتوى = (
    <div className="card-soft flex items-start justify-between gap-3 p-5 transition hover:shadow-card">
      <div className="min-w-0">
        <p className="text-sm text-muted-foreground">{العنوان}</p>
        <div className={cn("mt-2 text-2xl font-bold", ألوان[لون])}>{القيمة}</div>
        {وصف && <p className="mt-1 text-xs text-muted-foreground">{وصف}</p>}
      </div>
      {أيقونة && (
        <div className={cn("rounded-xl bg-appgray p-2.5", ألوان[لون])}>{أيقونة}</div>
      )}
    </div>
  );
  return رابط ? (
    <Link href={رابط} className="block">
      {المحتوى}
    </Link>
  ) : (
    المحتوى
  );
}
