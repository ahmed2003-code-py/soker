"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Eye } from "lucide-react";
import { PartyType } from "@prisma/client";
import { الزر } from "@/components/ui/button";
import { الحقل, منطقة_نص } from "@/components/ui/input";
import { العنوان } from "@/components/ui/label";
import {
  الحوار,
  محتوى_الحوار,
  رأس_الحوار,
  عنوان_الحوار,
  تذييل_الحوار,
} from "@/components/ui/dialog";
import { جدول_بيانات, type عمود } from "@/components/data-table";
import { نص_مبلغ } from "@/components/money-text";
import { نص_تاريخ } from "@/components/date-text";
import { الشارة } from "@/components/ui/badge";
import { حوار_تأكيد } from "@/components/confirm-dialog";
import { سجل_التغييرات } from "@/components/record-history";
import { useإشعار } from "@/components/ui/toast";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";
import type { مفتاح_ترجمة } from "@/lib/i18n";
import { إنشاء_طرف, تعديل_طرف, حذف_طرف } from "./actions";

export type صف_طرف = {
  id: number;
  الاسم: string;
  الهاتف: string | null;
  العنوان: string | null;
  الرصيد: number;
  حد_الائتمان: number | null;
  ملاحظات: string | null;
  آخر_تحديث?: string;
};

/** تسمية الرصيد للعرض (نسخة عميل من منطق lib/ledger) */
function وصف(نوع: PartyType, رصيد: number): { مفتاح: مفتاح_ترجمة; لون: "danger" | "success" | "default" } {
  if (نوع === "CUSTOMER") {
    if (رصيد > 0) return { مفتاح: "party.bal.debt", لون: "danger" };
    if (رصيد < 0) return { مفتاح: "party.bal.advance", لون: "success" };
  } else {
    if (رصيد > 0) return { مفتاح: "party.bal.payable", لون: "danger" };
    if (رصيد < 0) return { مفتاح: "party.bal.advance", لون: "success" };
  }
  return { مفتاح: "party.bal.settled", لون: "default" };
}

export function قائمة_الأطراف({
  النوع,
  البيانات,
}: {
  النوع: PartyType;
  البيانات: صف_طرف[];
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t } = استخدام_اللغة();
  const أساس = النوع === "CUSTOMER" ? "/customers" : "/suppliers";
  const نص_الإضافة = النوع === "CUSTOMER" ? t("party.add_customer") : t("party.add_supplier");
  const نص_الفراغ = النوع === "CUSTOMER" ? t("party.empty_customers") : t("party.empty_suppliers");
  const [نموذج, تعيين_نموذج] = React.useState<{ صف?: صف_طرف } | null>(null);
  const [حذف, تعيين_حذف] = React.useState<صف_طرف | null>(null);

  const أعمدة: عمود<صف_طرف>[] = [
    { المفتاح: "الاسم", العنوان: t("party.col.name"), قابل_للفرز: true },
    {
      المفتاح: "آخر_تحديث",
      العنوان: "آخر نشاط",
      قابل_للفرز: true,
      قيمة: (ص) => ص.آخر_تحديث ?? "",
      خلية: (ص) => ص.آخر_تحديث
        ? <نص_تاريخ القيمة={ص.آخر_تحديث} مع_الوقت className="text-xs text-muted-foreground" />
        : <span>—</span>,
      مخفي_موبايل: true,
    },
    {
      المفتاح: "الهاتف",
      العنوان: t("party.col.phone"),
      خلية: (ص) => <span className="ltr-nums">{ص.الهاتف || "—"}</span>,
      مخفي_موبايل: true,
    },
    {
      المفتاح: "الرصيد",
      العنوان: t("party.col.balance"),
      قابل_للفرز: true,
      قيمة: (ص) => ص.الرصيد,
      محاذاة: "end",
      خلية: (ص) => {
        const و = وصف(النوع, ص.الرصيد);
        return (
          <div className="flex items-center justify-end gap-2">
            <نص_مبلغ القيمة={Math.abs(ص.الرصيد)} النوع={و.لون === "danger" ? "مصروف" : "محايد"} />
            <الشارة variant={و.لون}>{t(و.مفتاح)}</الشارة>
          </div>
        );
      },
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <الزر onClick={() => تعيين_نموذج({})}>
          <Plus className="size-4" /> {نص_الإضافة}
        </الزر>
      </div>

      <جدول_بيانات
        الأعمدة={أعمدة}
        البيانات={البيانات}
        مفتاح_الصف={(ص) => ص.id}
        عند_النقر={(ص) => router.push(`${أساس}/${ص.id}`)}
        رسالة_فراغ={نص_الفراغ}
        إجراءات_الصف={(ص) => (
          <div className="flex justify-end gap-1">
            <الزر size="sm" variant="ghost" onClick={() => router.push(`${أساس}/${ص.id}`)}>
              <Eye className="size-4" />
            </الزر>
            <سجل_التغييرات النوع="الطرف" المعرف={ص.id} تسمية="" />
            <الزر size="sm" variant="ghost" onClick={() => تعيين_نموذج({ صف: ص })}>
              <Pencil className="size-4" />
            </الزر>
            <الزر size="sm" variant="ghost" onClick={() => تعيين_حذف(ص)}>
              <Trash2 className="size-4 text-danger" />
            </الزر>
          </div>
        )}
      />

      {نموذج && (
        <نموذج_طرف
          النوع={النوع}
          الصف={نموذج.صف}
          عند_الإغلاق={() => تعيين_نموذج(null)}
        />
      )}
      {حذف && (
        <حوار_تأكيد
          مفتوح
          عند_التغيير={(o) => !o && تعيين_حذف(null)}
          العنوان={t("party.delete_title", { name: حذف.الاسم })}
          الوصف={t("party.delete_desc")}
          عند_التأكيد={async () => {
            const r = await حذف_طرف(حذف.id);
            r.نجاح ? إشعار.نجاح(r.رسالة!) : إشعار.خطأ(r.رسالة);
            if (r.نجاح) router.refresh();
          }}
        />
      )}
    </>
  );
}

function نموذج_طرف({
  النوع,
  الصف,
  عند_الإغلاق,
}: {
  النوع: PartyType;
  الصف?: صف_طرف;
  عند_الإغلاق: () => void;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t } = استخدام_اللغة();
  const العنوان_النموذج = الصف
    ? النوع === "CUSTOMER" ? t("party.edit_customer") : t("party.edit_supplier")
    : النوع === "CUSTOMER" ? t("party.add_customer") : t("party.add_supplier");
  const [الاسم, تعيين_الاسم] = React.useState(الصف?.الاسم ?? "");
  const [الهاتف, تعيين_الهاتف] = React.useState(الصف?.الهاتف ?? "");
  const [العنوان_, تعيين_العنوان] = React.useState(الصف?.العنوان ?? "");
  const [حد, تعيين_حد] = React.useState(الصف?.حد_الائتمان != null ? String(الصف.حد_الائتمان) : "");
  const [ملاحظات, تعيين_ملاحظات] = React.useState(الصف?.ملاحظات ?? "");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  async function حفظ() {
    تعيين_جارٍ(true);
    const payload = {
      الاسم,
      الهاتف,
      العنوان: العنوان_,
      النوع,
      حد_الائتمان: حد || null,
      ملاحظات,
    };
    const r = الصف ? await تعديل_طرف(الصف.id, payload) : await إنشاء_طرف(payload);
    تعيين_جارٍ(false);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    إشعار.نجاح(r.رسالة!);
    عند_الإغلاق();
    router.refresh();
  }

  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإغلاق()}>
      <محتوى_الحوار>
        <رأس_الحوار>
          <عنوان_الحوار>{العنوان_النموذج}</عنوان_الحوار>
        </رأس_الحوار>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5 sm:col-span-2">
            <العنوان مطلوب>{t("party.col.name")}</العنوان>
            <الحقل autoFocus value={الاسم} onChange={(e) => تعيين_الاسم(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <العنوان>{t("party.col.phone")}</العنوان>
            <الحقل className="ltr-nums" value={الهاتف} onChange={(e) => تعيين_الهاتف(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <العنوان>{t("party.f.credit_limit")}</العنوان>
            <الحقل selectOnFocus value={حد} onChange={(e) => تعيين_حد(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <العنوان>{t("party.f.address")}</العنوان>
            <الحقل value={العنوان_} onChange={(e) => تعيين_العنوان(e.target.value)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <العنوان>{t("party.f.notes")}</العنوان>
            <منطقة_نص value={ملاحظات} onChange={(e) => تعيين_ملاحظات(e.target.value)} />
          </div>
        </div>
        <تذييل_الحوار>
          <الزر variant="success" onClick={حفظ} disabled={جارٍ}>
            {جارٍ ? t("common.saving") : t("common.save")}
          </الزر>
          <الزر variant="outline" onClick={عند_الإغلاق}>
            {t("common.cancel")}
          </الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}
