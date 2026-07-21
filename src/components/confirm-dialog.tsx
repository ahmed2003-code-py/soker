"use client";
import * as React from "react";
import {
  الحوار,
  محتوى_الحوار,
  رأس_الحوار,
  عنوان_الحوار,
  وصف_الحوار,
  تذييل_الحوار,
} from "@/components/ui/dialog";
import { الزر } from "@/components/ui/button";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";

type الخصائص = {
  مفتوح: boolean;
  عند_التغيير: (مفتوح: boolean) => void;
  العنوان?: string;
  الوصف?: string;
  تفاصيل?: React.ReactNode; // لوحة تفاصيل إضافية (مثل: الارتباطات التي ستُعكَس)
  نص_التأكيد?: string;
  نص_الإلغاء?: string;
  خطر?: boolean;
  عند_التأكيد: () => void | Promise<void>;
};

/** حوار تأكيد للإجراءات الحساسة (حذف، عكس قيد...) */
export function حوار_تأكيد({
  مفتوح,
  عند_التغيير,
  العنوان,
  الوصف,
  تفاصيل,
  نص_التأكيد,
  نص_الإلغاء,
  خطر = true,
  عند_التأكيد,
}: الخصائص) {
  const { t } = استخدام_اللغة();
  const [جارٍ, تعيين_جارٍ] = React.useState(false);
  return (
    <الحوار open={مفتوح} onOpenChange={عند_التغيير}>
      <محتوى_الحوار className="max-w-md">
        <رأس_الحوار>
          <عنوان_الحوار>{العنوان ?? t("confirm.title")}</عنوان_الحوار>
          <وصف_الحوار>{الوصف ?? t("confirm.desc")}</وصف_الحوار>
        </رأس_الحوار>
        {تفاصيل}
        <تذييل_الحوار>
          <الزر
            variant={خطر ? "danger" : "default"}
            disabled={جارٍ}
            onClick={async () => {
              try {
                تعيين_جارٍ(true);
                await عند_التأكيد();
                عند_التغيير(false);
              } finally {
                تعيين_جارٍ(false);
              }
            }}
          >
            {جارٍ ? t("confirm.processing") : (نص_التأكيد ?? t("confirm.confirm"))}
          </الزر>
          <الزر variant="outline" disabled={جارٍ} onClick={() => عند_التغيير(false)}>
            {نص_الإلغاء ?? t("common.cancel")}
          </الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}
