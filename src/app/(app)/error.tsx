"use client";
import * as React from "react";
import { AlertTriangle, RotateCw } from "lucide-react";
import { الزر } from "@/components/ui/button";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";

/** حدّ خطأ لمنطقة التطبيق — يحتوي أي استثناء في الصفحة بدل كسر الواجهة كاملة. */
export default function خطأ_التطبيق({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  const { t, لغة } = استخدام_اللغة();
  React.useEffect(() => {
    // eslint-disable-next-line no-console
    console.error(error);
  }, [error]);

  const عنوان = لغة === "ar" ? "حصل خطأ غير متوقع" : "Something went wrong";
  const وصف =
    لغة === "ar"
      ? "حصلت مشكلة أثناء عرض هذه الصفحة. جرّب تحديثها — لو تكررت أبلغنا."
      : "An error occurred while rendering this page. Try again — if it persists, let us know.";

  return (
    <div className="flex min-h-[60vh] flex-col items-center justify-center gap-4 text-center">
      <div className="flex size-16 items-center justify-center rounded-2xl bg-danger-soft text-danger">
        <AlertTriangle className="size-8" />
      </div>
      <div>
        <h2 className="text-lg font-bold">{عنوان}</h2>
        <p className="mt-1 max-w-sm text-sm text-muted-foreground">{وصف}</p>
        {error?.message && (
          <p className="mt-2 max-w-md break-words rounded-lg bg-appgray px-3 py-2 text-xs text-muted-foreground ltr-nums">
            {error.message}
          </p>
        )}
      </div>
      <الزر onClick={reset}>
        <RotateCw className="size-4" /> {t("common.loading") === "Loading…" ? "Retry" : "إعادة المحاولة"}
      </الزر>
    </div>
  );
}
