"use client";
import * as React from "react";
import { History } from "lucide-react";
import {
  الحوار,
  زر_الحوار,
  محتوى_الحوار,
  رأس_الحوار,
  عنوان_الحوار,
  وصف_الحوار,
} from "@/components/ui/dialog";
import { الزر } from "@/components/ui/button";
import { نص_تاريخ } from "@/components/date-text";
import { شارة_حالة } from "@/components/status-badge";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";
import { جلب_سجل_الكيان } from "@/app/(app)/activity-log/actions";
import type { نوع_الكيان } from "@/lib/activity";
import type { ActivityAction } from "@prisma/client";

type سجل = {
  id: number;
  العملية: ActivityAction;
  بواسطة: string;
  التاريخ: string;
  التفاصيل: unknown;
};

/** زر + حوار يعرض المسار الزمني (audit trail) لأي سجل */
export function سجل_التغييرات({
  النوع,
  المعرف,
  تسمية,
}: {
  النوع: نوع_الكيان;
  المعرف: number;
  تسمية?: string;
}) {
  const { t } = استخدام_اللغة();
  const [مفتوح, تعيين_مفتوح] = React.useState(false);
  const [سجلات, تعيين] = React.useState<سجل[] | null>(null);

  React.useEffect(() => {
    if (مفتوح && !سجلات) {
      جلب_سجل_الكيان(النوع, المعرف).then((r) => تعيين(r as سجل[]));
    }
  }, [مفتوح, سجلات, النوع, المعرف]);

  return (
    <الحوار open={مفتوح} onOpenChange={تعيين_مفتوح}>
      <زر_الحوار asChild>
        <الزر variant="ghost" size="sm">
          <History className="size-4" /> {تسمية ?? t("common.history")}
        </الزر>
      </زر_الحوار>
      <محتوى_الحوار className="max-w-lg">
        <رأس_الحوار>
          <عنوان_الحوار>{t("history.title")}</عنوان_الحوار>
          <وصف_الحوار>{t("history.desc")}</وصف_الحوار>
        </رأس_الحوار>
        <div className="max-h-96 space-y-2 overflow-y-auto">
          {!سجلات && <p className="text-sm text-muted-foreground">{t("common.loading")}</p>}
          {سجلات?.length === 0 && (
            <p className="text-sm text-muted-foreground">{t("history.empty")}</p>
          )}
          {سجلات?.map((س) => (
            <div key={س.id} className="rounded-lg border border-border p-3 text-sm">
              <div className="flex items-center justify-between">
                <شارة_حالة
                  الحالة={t(`action.${س.العملية}` as const)}
                  متغيّر={
                    س.العملية === "DELETE"
                      ? "danger"
                      : س.العملية === "CREATE"
                        ? "success"
                        : "warning"
                  }
                />
                <span className="text-muted-foreground">
                  {t("history.by", { name: س.بواسطة })} — <نص_تاريخ القيمة={س.التاريخ} مع_الوقت />
                </span>
              </div>
              {س.التفاصيل != null && Object.keys(س.التفاصيل as object).length > 0 && (
                <pre className="mt-2 overflow-x-auto rounded bg-appgray p-2 text-xs ltr-nums">
                  {JSON.stringify(س.التفاصيل, null, 1)}
                </pre>
              )}
            </div>
          ))}
        </div>
      </محتوى_الحوار>
    </الحوار>
  );
}
