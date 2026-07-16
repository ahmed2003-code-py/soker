"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Eye, X } from "lucide-react";
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
import type { هاتف_طرف } from "@/lib/schemas/party";
import { إنشاء_طرف, تعديل_طرف, حذف_طرف } from "./actions";
import { استخدم_تراجع_الحذف } from "@/hooks/use-undo-delete";

export type صف_طرف = {
  id: number;
  الاسم: string;
  الهاتف: string | null;
  أرقام_الهواتف: هاتف_طرف[];
  العنوان: string | null;
  الرصيد: number;
  رصيد_ابتدائي: number;
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
  const { t } = استخدام_اللغة();
  const أساس = النوع === "CUSTOMER" ? "/customers" : "/suppliers";
  const نص_الإضافة = النوع === "CUSTOMER" ? t("party.add_customer") : t("party.add_supplier");
  const نص_الفراغ = النوع === "CUSTOMER" ? t("party.empty_customers") : t("party.empty_suppliers");
  const [نموذج, تعيين_نموذج] = React.useState<{ صف?: صف_طرف } | null>(null);
  const { احذف, معلقة } = استخدم_تراجع_الحذف();

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
        البيانات={البيانات.filter((ص) => !معلقة.has(ص.id))}
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
            <الزر
              size="sm"
              variant="ghost"
              onClick={() => احذف(ص.id, () => حذف_طرف(ص.id))}
            >
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
  const [أرقام, تعيين_أرقام] = React.useState<هاتف_طرف[]>(() => {
    if (الصف?.أرقام_الهواتف?.length) return الصف.أرقام_الهواتف;
    if (الصف?.الهاتف) return [{ رقم: الصف.الهاتف, تسمية: null }];
    return [{ رقم: "", تسمية: null }];
  });
  const [العنوان_, تعيين_العنوان] = React.useState(الصف?.العنوان ?? "");
  const [حد, تعيين_حد] = React.useState(الصف?.حد_الائتمان != null ? String(الصف.حد_الائتمان) : "");
  const [رصيد_افتتاحي, تعيين_رصيد_افتتاحي] = React.useState(
    الصف?.رصيد_ابتدائي != null && الصف.رصيد_ابتدائي !== 0 ? String(الصف.رصيد_ابتدائي) : ""
  );
  const [ملاحظات, تعيين_ملاحظات] = React.useState(الصف?.ملاحظات ?? "");

  function عدّل_رقم(idx: number, حقل: keyof هاتف_طرف, قيمة: string) {
    تعيين_أرقام((prev) => prev.map((h, i) => i === idx ? { ...h, [حقل]: قيمة || null } : h));
  }
  function احذف_رقم(idx: number) {
    تعيين_أرقام((prev) => prev.filter((_, i) => i !== idx));
  }
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  async function حفظ() {
    تعيين_جارٍ(true);
    const payload = {
      الاسم,
      الهاتف: أرقام[0]?.رقم || null,
      أرقام_الهواتف: أرقام.filter((h) => h.رقم.trim()),
      العنوان: العنوان_,
      النوع,
      حد_الائتمان: حد || null,
      رصيد_ابتدائي: رصيد_افتتاحي || "0",
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
          <div className="space-y-2 sm:col-span-2">
            <العنوان>{t("party.col.phone")}</العنوان>
            {أرقام.map((هاتف, idx) => (
              <div key={idx} className="flex gap-2 items-center">
                <الحقل
                  className="ltr-nums flex-1"
                  value={هاتف.رقم}
                  onChange={(e) => عدّل_رقم(idx, "رقم", e.target.value)}
                  placeholder="رقم الهاتف"
                />
                <الحقل
                  className="flex-1 text-sm"
                  value={هاتف.تسمية ?? ""}
                  onChange={(e) => عدّل_رقم(idx, "تسمية", e.target.value)}
                  placeholder="تسمية — مثلاً: المحاسب"
                />
                {أرقام.length > 1 && (
                  <button
                    type="button"
                    onClick={() => احذف_رقم(idx)}
                    className="shrink-0 rounded-lg p-1 text-muted-foreground hover:text-danger hover:bg-danger/10"
                  >
                    <X className="size-4" />
                  </button>
                )}
              </div>
            ))}
            <button
              type="button"
              onClick={() => تعيين_أرقام((prev) => [...prev, { رقم: "", تسمية: null }])}
              className="flex items-center gap-1 text-sm text-primary-blue hover:underline"
            >
              <Plus className="size-3.5" /> إضافة رقم آخر
            </button>
          </div>
          <div className="space-y-1.5">
            <العنوان>{t("party.f.credit_limit")}</العنوان>
            <الحقل selectOnFocus value={حد} onChange={(e) => تعيين_حد(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <العنوان>الرصيد الابتدائي</العنوان>
            <الحقل
              selectOnFocus
              value={رصيد_افتتاحي}
              onChange={(e) => تعيين_رصيد_افتتاحي(e.target.value)}
              placeholder="0.00 — الرصيد قبل استخدام البرنامج"
            />
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
