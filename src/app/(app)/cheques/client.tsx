"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Image as ImageIcon } from "lucide-react";
import { ChequeStatus } from "@prisma/client";
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
import { قائمة_اختيار } from "@/components/combobox";
import { جدول_بيانات, type عمود } from "@/components/data-table";
import { نص_مبلغ } from "@/components/money-text";
import { نص_تاريخ } from "@/components/date-text";
import { شارة_حالة } from "@/components/status-badge";
import { الشارة } from "@/components/ui/badge";
import { حوار_تأكيد } from "@/components/confirm-dialog";
import { سجل_التغييرات } from "@/components/record-history";
import { useإشعار } from "@/components/ui/toast";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";
import { حقول_OCR_للشيك } from "./ocr-upload";
import { إنشاء_شيك, تعديل_شيك, تغيير_حالة_شيك, حذف_شيك } from "./actions";

const حالات_الشيك = ["PENDING", "COLLECTED", "BOUNCED"] as const;
const لون_الحالة: Record<ChequeStatus, "warning" | "success" | "danger"> = {
  PENDING: "warning",
  COLLECTED: "success",
  BOUNCED: "danger",
};

export type شيك = {
  id: number;
  اسم_المدين: string;
  المبلغ: number;
  المستفيد: string | null;
  محول_من: string | null;
  اسم_البنك: string | null;
  تاريخ_الاستحقاق: string;
  رقم_الشيك: string | null;
  الحالة: ChequeStatus;
  ملاحظات: string | null;
  لها_صورة: boolean;
  متأخر: boolean;
};

export function شاشة_الشيكات({ البيانات }: { البيانات: شيك[] }) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t, لغة } = استخدام_اللغة();
  const خيارات_الحالة = حالات_الشيك.map((s) => ({ القيمة: s, التسمية: t(`cheque.status.${s}` as const) }));
  const [نموذج, تعيين_نموذج] = React.useState<{ شيك?: شيك } | null>(null);
  const [حذف, تعيين_حذف] = React.useState<شيك | null>(null);
  const [حالة_فلتر, تعيين_حالة_فلتر] = React.useState<string>("");
  const [من, تعيين_من] = React.useState("");
  const [إلى, تعيين_إلى] = React.useState("");

  function طبّق_الفلاتر(صفوف: شيك[]): شيك[] {
    return صفوف.filter((ش) => {
      if (حالة_فلتر === "متأخر") { if (!ش.متأخر) return false; }
      else if (حالة_فلتر) { if (ش.الحالة !== حالة_فلتر) return false; }
      const d = ش.تاريخ_الاستحقاق.slice(0, 10);
      if (من && d < من) return false;
      if (إلى && d > إلى) return false;
      return true;
    });
  }
  const فلاتر_نشطة = !!(حالة_فلتر || من || إلى);
  const يوم = (d: Date) =>
    `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  function فترة(بداية: Date, نهاية: Date) { تعيين_من(يوم(بداية)); تعيين_إلى(يوم(نهاية)); }
  const الفترات = (() => {
    const n = new Date(); const y = n.getFullYear(); const m = n.getMonth();
    return [
      { م: لغة === "ar" ? "هذا الشهر" : "This month", ب: new Date(y, m, 1), هـ: new Date(y, m + 1, 0) },
      { م: لغة === "ar" ? "الشهر الماضي" : "Last month", ب: new Date(y, m - 1, 1), هـ: new Date(y, m, 0) },
      { م: لغة === "ar" ? "آخر 3 شهور" : "Last 3 months", ب: new Date(y, m - 2, 1), هـ: new Date(y, m + 1, 0) },
      { م: لغة === "ar" ? "هذه السنة" : "This year", ب: new Date(y, 0, 1), هـ: new Date(y, 11, 31) },
    ];
  })();

  const أعمدة: عمود<شيك>[] = [
    { المفتاح: "اسم_المدين", العنوان: t("cheque.col.drawer"), قابل_للفرز: true },
    {
      المفتاح: "المبلغ",
      العنوان: t("pay.amount"),
      محاذاة: "end",
      قيمة: (ص) => ص.المبلغ,
      قابل_للفرز: true,
      خلية: (ص) => <نص_مبلغ القيمة={ص.المبلغ} />,
    },
    { المفتاح: "المستفيد", العنوان: t("cheque.col.beneficiary"), خلية: (ص) => ص.المستفيد || "—", مخفي_موبايل: true },
    { المفتاح: "اسم_البنك", العنوان: t("cheque.col.bank"), خلية: (ص) => ص.اسم_البنك || "—", مخفي_موبايل: true },
    {
      المفتاح: "تاريخ_الاستحقاق",
      العنوان: t("cheque.col.due"),
      قابل_للفرز: true,
      قيمة: (ص) => ص.تاريخ_الاستحقاق,
      خلية: (ص) => (
        <span className={ص.متأخر ? "font-semibold text-danger" : ""}>
          <نص_تاريخ القيمة={ص.تاريخ_الاستحقاق} />
        </span>
      ),
    },
    {
      المفتاح: "رقم_الشيك",
      العنوان: t("cheque.col.number"),
      خلية: (ص) => <span className="ltr-nums">{ص.رقم_الشيك || "—"}</span>,
      مخفي_موبايل: true,
    },
    {
      المفتاح: "الحالة",
      العنوان: t("cheque.col.status"),
      خلية: (ص) =>
        ص.متأخر ? (
          <الشارة variant="danger">{t("cheque.status.overdue")}</الشارة>
        ) : (
          <شارة_حالة الحالة={t(`cheque.status.${ص.الحالة}` as const)} متغيّر={لون_الحالة[ص.الحالة]} />
        ),
    },
  ];

  const جدول = (بيانات: شيك[]) => (
    <جدول_بيانات
      الأعمدة={أعمدة}
      البيانات={بيانات}
      مفتاح_الصف={(ص) => ص.id}
      نص_البحث={t("cheque.search")}
      رسالة_فراغ={t("cheque.empty")}
      إجراءات_الصف={(ص) => (
        <div className="flex justify-end gap-1">
          {ص.لها_صورة && (
            <a href={`/api/cheques/${ص.id}/image`} target="_blank" rel="noreferrer" title={t("cheque.view_image")}>
              <الزر size="sm" variant="ghost"><ImageIcon className="size-4" /></الزر>
            </a>
          )}
          <قائمة_اختيار
            className="h-8 w-28"
            الخيارات={خيارات_الحالة}
            القيمة={ص.الحالة}
            قابل_للبحث={false}
            عند_التغيير={async (v) => {
              const r = await تغيير_حالة_شيك(ص.id, v as ChequeStatus);
              r.نجاح ? إشعار.نجاح(r.رسالة!) : إشعار.خطأ(r.رسالة);
              if (r.نجاح) router.refresh();
            }}
          />
          <سجل_التغييرات النوع="الشيك" المعرف={ص.id} تسمية="" />
          <الزر size="sm" variant="ghost" onClick={() => تعيين_نموذج({ شيك: ص })}>
            <Pencil className="size-4" />
          </الزر>
          <الزر size="sm" variant="ghost" onClick={() => تعيين_حذف(ص)}>
            <Trash2 className="size-4 text-danger" />
          </الزر>
        </div>
      )}
    />
  );

  const حالات_الفلتر = [
    { ق: "", ت: t("common.all") },
    ...حالات_الشيك.map((s) => ({ ق: s, ت: t(`cheque.status.${s}` as const) })),
    { ق: "متأخر", ت: t("cheque.status.overdue") },
  ];

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <الزر onClick={() => تعيين_نموذج({})}>
          <Plus className="size-4" /> {t("cheque.add")}
        </الزر>
      </div>

      {/* فلاتر: الحالة + الفترة */}
      <div className="card-soft flex flex-wrap items-end gap-x-4 gap-y-3 p-4">
        <div className="flex flex-wrap items-center gap-1.5">
          {حالات_الفلتر.map((h) => (
            <button
              key={h.ق || "all"}
              type="button"
              onClick={() => تعيين_حالة_فلتر(h.ق)}
              className={`rounded-full border px-3 py-1 text-xs transition active:scale-95 ${
                حالة_فلتر === h.ق
                  ? "border-primary bg-primary text-primary-foreground"
                  : "border-border bg-card hover:bg-appgray"
              }`}
            >
              {h.ت}
            </button>
          ))}
        </div>
        <span className="hidden h-6 w-px bg-border sm:block" />
        <div className="flex items-end gap-2">
          <div className="space-y-1">
            <العنوان>{t("rep.from")}</العنوان>
            <الحقل type="date" dir="ltr" value={من} onChange={(e) => تعيين_من(e.target.value)} className="h-9 text-start" />
          </div>
          <div className="space-y-1">
            <العنوان>{t("rep.to")}</العنوان>
            <الحقل type="date" dir="ltr" value={إلى} onChange={(e) => تعيين_إلى(e.target.value)} className="h-9 text-start" />
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {الفترات.map((f) => (
            <button
              key={f.م}
              type="button"
              onClick={() => فترة(f.ب, f.هـ)}
              className="rounded-full border border-border bg-card px-3 py-1 text-xs transition hover:border-primary-blue/40 hover:bg-appgray active:scale-95"
            >
              {f.م}
            </button>
          ))}
          {فلاتر_نشطة && (
            <button
              type="button"
              onClick={() => { تعيين_حالة_فلتر(""); تعيين_من(""); تعيين_إلى(""); }}
              className="rounded-full border border-danger/40 px-3 py-1 text-xs text-danger transition hover:bg-danger-soft active:scale-95"
            >
              {لغة === "ar" ? "مسح الفلاتر" : "Clear filters"}
            </button>
          )}
        </div>
      </div>

      {جدول(طبّق_الفلاتر(البيانات))}

      {نموذج && <حوار_شيك شيك={نموذج.شيك} عند_الإغلاق={() => تعيين_نموذج(null)} />}
      {حذف && (
        <حوار_تأكيد
          مفتوح
          عند_التغيير={(o) => !o && تعيين_حذف(null)}
          العنوان={t("cheque.delete_title", { name: حذف.اسم_المدين })}
          عند_التأكيد={async () => {
            const r = await حذف_شيك(حذف.id);
            r.نجاح ? إشعار.نجاح(r.رسالة!) : إشعار.خطأ(r.رسالة);
            if (r.نجاح) router.refresh();
          }}
        />
      )}
    </div>
  );
}

export function حوار_شيك({ شيك, عند_الإغلاق }: { شيك?: شيك; عند_الإغلاق: () => void }) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t } = استخدام_اللغة();
  const خيارات_الحالة = حالات_الشيك.map((s) => ({ القيمة: s, التسمية: t(`cheque.status.${s}` as const) }));
  const [ق, تعيين] = React.useState({
    اسم_المدين: شيك?.اسم_المدين ?? "",
    المبلغ: شيك ? String(شيك.المبلغ) : "",
    المستفيد: شيك?.المستفيد ?? "",
    محول_من: شيك?.محول_من ?? "",
    اسم_البنك: شيك?.اسم_البنك ?? "",
    تاريخ_الاستحقاق: شيك?.تاريخ_الاستحقاق?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    رقم_الشيك: شيك?.رقم_الشيك ?? "",
    الحالة: (شيك?.الحالة ?? "PENDING") as ChequeStatus,
    ملاحظات: شيك?.ملاحظات ?? "",
  });
  const [صورة, تعيين_صورة] = React.useState<{ base64: string; mime: string; نص?: string } | null>(null);
  const [جارٍ, تعيين_جارٍ] = React.useState(false);
  const حدّث = (ك: string, v: string) => تعيين((س) => ({ ...س, [ك]: v }));

  async function احفظ() {
    تعيين_جارٍ(true);
    const payload = {
      ...ق,
      صورة_base64: صورة?.base64 ?? null,
      صورة_mime: صورة?.mime ?? null,
      نص_OCR: صورة?.نص ?? null,
    };
    const r = شيك ? await تعديل_شيك(شيك.id, payload) : await إنشاء_شيك(payload);
    تعيين_جارٍ(false);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    إشعار.نجاح(r.رسالة!);
    عند_الإغلاق();
    router.refresh();
  }

  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإغلاق()}>
      <محتوى_الحوار className="max-w-2xl">
        <رأس_الحوار>
          <عنوان_الحوار>{شيك ? t("cheque.dlg.edit") : t("cheque.dlg.add")}</عنوان_الحوار>
        </رأس_الحوار>

        {!شيك && (
          <حقول_OCR_للشيك
            عند_الاستخراج={(ح, خام) => {
              تعيين((س) => ({
                ...س,
                اسم_المدين: ح.اسم_المدين ?? س.اسم_المدين,
                المبلغ: ح.المبلغ ?? س.المبلغ,
                المستفيد: ح.المستفيد ?? س.المستفيد,
                محول_من: ح.محول_من ?? س.محول_من,
                اسم_البنك: ح.اسم_البنك ?? س.اسم_البنك,
                تاريخ_الاستحقاق: ح.تاريخ_الاستحقاق ?? س.تاريخ_الاستحقاق,
                رقم_الشيك: ح.رقم_الشيك ?? س.رقم_الشيك,
              }));
            }}
            عند_الصورة={(base64, mime, نص) => تعيين_صورة({ base64, mime, نص })}
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          <Field label={t("cheque.col.drawer")} مطلوب value={ق.اسم_المدين} onChange={(v) => حدّث("اسم_المدين", v)} autoFocus />
          <Field label={t("pay.amount")} مطلوب value={ق.المبلغ} onChange={(v) => حدّث("المبلغ", v)} رقمي />
          <Field label={t("cheque.col.beneficiary")} value={ق.المستفيد} onChange={(v) => حدّث("المستفيد", v)} />
          <Field label={t("cheque.f.transferred_from")} value={ق.محول_من} onChange={(v) => حدّث("محول_من", v)} />
          <Field label={t("cheque.col.bank")} value={ق.اسم_البنك} onChange={(v) => حدّث("اسم_البنك", v)} />
          <div className="space-y-1.5">
            <العنوان مطلوب>{t("cheque.col.due")}</العنوان>
            <الحقل type="date" value={ق.تاريخ_الاستحقاق} onChange={(e) => حدّث("تاريخ_الاستحقاق", e.target.value)} />
          </div>
          <Field label={t("cheque.col.number")} value={ق.رقم_الشيك} onChange={(v) => حدّث("رقم_الشيك", v)} />
          <div className="space-y-1.5">
            <العنوان>{t("cheque.col.status")}</العنوان>
            <قائمة_اختيار
              الخيارات={خيارات_الحالة}
              القيمة={ق.الحالة}
              عند_التغيير={(v) => حدّث("الحالة", v)}
              قابل_للبحث={false}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <العنوان>{t("party.f.notes")}</العنوان>
            <منطقة_نص value={ق.ملاحظات} onChange={(e) => حدّث("ملاحظات", e.target.value)} />
          </div>
        </div>

        <تذييل_الحوار>
          <الزر variant="success" onClick={احفظ} disabled={جارٍ}>
            {جارٍ ? t("common.saving") : t("common.save")}
          </الزر>
          <الزر variant="outline" onClick={عند_الإغلاق}>{t("common.cancel")}</الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}

function Field({
  label,
  value,
  onChange,
  مطلوب,
  رقمي,
  autoFocus,
}: {
  label: string;
  value: string;
  onChange: (v: string) => void;
  مطلوب?: boolean;
  رقمي?: boolean;
  autoFocus?: boolean;
}) {
  return (
    <div className="space-y-1.5">
      <العنوان مطلوب={مطلوب}>{label}</العنوان>
      <الحقل
        autoFocus={autoFocus}
        selectOnFocus={رقمي}
        className={رقمي ? "ltr-nums" : undefined}
        value={value}
        onChange={(e) => onChange(e.target.value)}
      />
    </div>
  );
}
