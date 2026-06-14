"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import type { ActivityAction } from "@prisma/client";
import { جدول_بيانات, type عمود } from "@/components/data-table";
import { قائمة_اختيار } from "@/components/combobox";
import { الحقل } from "@/components/ui/input";
import { العنوان } from "@/components/ui/label";
import { الزر } from "@/components/ui/button";
import { شارة_حالة } from "@/components/status-badge";
import { نص_تاريخ } from "@/components/date-text";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";
import type { مفتاح_ترجمة } from "@/lib/i18n";

type صف = {
  id: number;
  العملية: ActivityAction;
  بواسطة: string;
  نوع_الكيان: string;
  معرف_الكيان: number | null;
  التاريخ: string;
  التفاصيل: unknown;
};

const أنواع_الكيانات = [
  "الطرف",
  "الفاتورة",
  "بند_الفاتورة",
  "حركة_الحساب",
  "حركة_الخزنة",
  "الشيك",
  "المستخدم",
  "الإعدادات",
];

export function سجل_العمليات_العرض({
  البيانات,
  المستخدمون,
  القيم,
}: {
  البيانات: صف[];
  المستخدمون: { id: number; name: string }[];
  القيم: { المستخدم?: string; النوع?: string; من?: string; إلى?: string };
}) {
  const router = useRouter();
  const { t } = استخدام_اللغة();
  const [مستخدم, تعيين_مستخدم] = React.useState(القيم.المستخدم ?? "");
  const [نوع, تعيين_نوع] = React.useState(القيم.النوع ?? "");
  const [من, تعيين_من] = React.useState(القيم.من ?? "");
  const [إلى, تعيين_إلى] = React.useState(القيم.إلى ?? "");

  function طبّق() {
    const p = new URLSearchParams();
    if (مستخدم) p.set("المستخدم", مستخدم);
    if (نوع) p.set("النوع", نوع);
    if (من) p.set("من", من);
    if (إلى) p.set("إلى", إلى);
    router.push(`/activity-log?${p.toString()}`);
  }
  function امسح() {
    تعيين_مستخدم("");
    تعيين_نوع("");
    تعيين_من("");
    تعيين_إلى("");
    router.push("/activity-log");
  }

  const أعمدة: عمود<صف>[] = [
    {
      المفتاح: "التاريخ",
      العنوان: t("common.date"),
      خلية: (ص) => <نص_تاريخ القيمة={ص.التاريخ} مع_الوقت />,
      قيمة: (ص) => ص.التاريخ,
      قابل_للفرز: true,
    },
    { المفتاح: "بواسطة", العنوان: t("activity.col.by"), قابل_للفرز: true },
    {
      المفتاح: "العملية",
      العنوان: t("activity.col.action"),
      خلية: (ص) => (
        <شارة_حالة
          الحالة={t(`action.${ص.العملية}` as const)}
          متغيّر={
            ص.العملية === "DELETE"
              ? "danger"
              : ص.العملية === "CREATE"
                ? "success"
                : "warning"
          }
        />
      ),
    },
    {
      المفتاح: "نوع_الكيان",
      العنوان: t("activity.col.entity"),
      خلية: (ص) => t(`entity.${ص.نوع_الكيان}` as مفتاح_ترجمة),
    },
    {
      المفتاح: "معرف_الكيان",
      العنوان: t("activity.col.id"),
      خلية: (ص) => <span className="ltr-nums">{ص.معرف_الكيان ?? "—"}</span>,
      مخفي_موبايل: true,
    },
  ];

  return (
    <div className="space-y-4">
      <div className="card-soft grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
        <div className="space-y-1.5">
          <العنوان>{t("activity.person")}</العنوان>
          <قائمة_اختيار
            الخيارات={[
              { القيمة: "", التسمية: t("common.all") },
              ...المستخدمون.map((u) => ({ القيمة: String(u.id), التسمية: u.name })),
            ]}
            القيمة={مستخدم}
            عند_التغيير={تعيين_مستخدم}
          />
        </div>
        <div className="space-y-1.5">
          <العنوان>{t("activity.entity_type")}</العنوان>
          <قائمة_اختيار
            الخيارات={[
              { القيمة: "", التسمية: t("common.all") },
              ...أنواع_الكيانات.map((ك) => ({ القيمة: ك, التسمية: t(`entity.${ك}` as مفتاح_ترجمة) })),
            ]}
            القيمة={نوع}
            عند_التغيير={تعيين_نوع}
          />
        </div>
        <div className="space-y-1.5">
          <العنوان>{t("activity.from")}</العنوان>
          <الحقل type="date" value={من} onChange={(e) => تعيين_من(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <العنوان>{t("activity.to")}</العنوان>
          <الحقل type="date" value={إلى} onChange={(e) => تعيين_إلى(e.target.value)} />
        </div>
        <div className="flex items-end gap-2">
          <الزر onClick={طبّق}>{t("activity.apply")}</الزر>
          <الزر variant="outline" onClick={امسح}>
            {t("activity.clear")}
          </الزر>
        </div>
      </div>

      <جدول_بيانات
        الأعمدة={أعمدة}
        البيانات={البيانات}
        مفتاح_الصف={(ص) => ص.id}
        رسالة_فراغ={t("activity.empty")}
      />
    </div>
  );
}
