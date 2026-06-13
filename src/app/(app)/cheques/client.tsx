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
import {
  التبويبات,
  قائمة_التبويبات,
  زر_تبويب,
  محتوى_تبويب,
} from "@/components/ui/tabs";
import { قائمة_اختيار } from "@/components/combobox";
import { جدول_بيانات, type عمود } from "@/components/data-table";
import { نص_مبلغ } from "@/components/money-text";
import { نص_تاريخ } from "@/components/date-text";
import { شارة_حالة } from "@/components/status-badge";
import { الشارة } from "@/components/ui/badge";
import { حوار_تأكيد } from "@/components/confirm-dialog";
import { سجل_التغييرات } from "@/components/record-history";
import { useإشعار } from "@/components/ui/toast";
import { تسمية_حالة_الشيك, خيارات_من } from "@/lib/enums";
import { حقول_OCR_للشيك } from "./ocr-upload";
import { إنشاء_شيك, تعديل_شيك, تغيير_حالة_شيك, حذف_شيك } from "./actions";

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

function مفتاح_شهر(iso: string) {
  return iso.slice(0, 7);
}
const أشهر_ع = ["يناير", "فبراير", "مارس", "أبريل", "مايو", "يونيو", "يوليو", "أغسطس", "سبتمبر", "أكتوبر", "نوفمبر", "ديسمبر"];
function اسم_شهر(iso: string) {
  const d = new Date(iso);
  return `${أشهر_ع[d.getMonth()]} ${d.getFullYear()}`;
}

export function شاشة_الشيكات({ البيانات }: { البيانات: شيك[] }) {
  const router = useRouter();
  const إشعار = useإشعار();
  const [نموذج, تعيين_نموذج] = React.useState<{ شيك?: شيك } | null>(null);
  const [حذف, تعيين_حذف] = React.useState<شيك | null>(null);

  const الأشهر = React.useMemo(() => {
    const م = new Map<string, { عدد: number; إجمالي: number }>();
    for (const ش of البيانات) {
      const ك = مفتاح_شهر(ش.تاريخ_الاستحقاق);
      const ح = م.get(ك) ?? { عدد: 0, إجمالي: 0 };
      ح.عدد += 1;
      ح.إجمالي += ش.المبلغ;
      م.set(ك, ح);
    }
    return [...م.entries()].sort((a, b) => a[0].localeCompare(b[0]));
  }, [البيانات]);

  const أعمدة: عمود<شيك>[] = [
    { المفتاح: "اسم_المدين", العنوان: "اسم المدين", قابل_للفرز: true },
    {
      المفتاح: "المبلغ",
      العنوان: "المبلغ",
      محاذاة: "end",
      قيمة: (ص) => ص.المبلغ,
      قابل_للفرز: true,
      خلية: (ص) => <نص_مبلغ القيمة={ص.المبلغ} />,
    },
    { المفتاح: "المستفيد", العنوان: "المستفيد", خلية: (ص) => ص.المستفيد || "—", مخفي_موبايل: true },
    { المفتاح: "اسم_البنك", العنوان: "البنك", خلية: (ص) => ص.اسم_البنك || "—", مخفي_موبايل: true },
    {
      المفتاح: "تاريخ_الاستحقاق",
      العنوان: "الاستحقاق",
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
      العنوان: "رقم الشيك",
      خلية: (ص) => <span className="ltr-nums">{ص.رقم_الشيك || "—"}</span>,
      مخفي_موبايل: true,
    },
    {
      المفتاح: "الحالة",
      العنوان: "الحالة",
      خلية: (ص) =>
        ص.متأخر ? (
          <الشارة variant="danger">متأخر</الشارة>
        ) : (
          <شارة_حالة الحالة={تسمية_حالة_الشيك[ص.الحالة]} />
        ),
    },
  ];

  const جدول = (بيانات: شيك[]) => (
    <جدول_بيانات
      الأعمدة={أعمدة}
      البيانات={بيانات}
      مفتاح_الصف={(ص) => ص.id}
      نص_البحث="ابحث بالاسم/البنك/الرقم…"
      رسالة_فراغ="لا توجد شيكات"
      إجراءات_الصف={(ص) => (
        <div className="flex justify-end gap-1">
          {ص.لها_صورة && (
            <a href={`/api/cheques/${ص.id}/image`} target="_blank" rel="noreferrer" title="عرض الصورة">
              <الزر size="sm" variant="ghost"><ImageIcon className="size-4" /></الزر>
            </a>
          )}
          <قائمة_اختيار
            className="h-8 w-28"
            الخيارات={خيارات_من(تسمية_حالة_الشيك)}
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

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <الزر onClick={() => تعيين_نموذج({})}>
          <Plus className="size-4" /> إضافة شيك
        </الزر>
      </div>

      <التبويبات defaultValue="الكل">
        <قائمة_التبويبات>
          <زر_تبويب value="الكل">الكل ({البيانات.length})</زر_تبويب>
          {الأشهر.map(([ك, ح]) => (
            <زر_تبويب key={ك} value={ك}>
              {اسم_شهر(ك + "-01")} ({ح.عدد}) —{" "}
              {ح.إجمالي.toLocaleString("en-US")} ج.م
            </زر_تبويب>
          ))}
        </قائمة_التبويبات>
        <محتوى_تبويب value="الكل">{جدول(البيانات)}</محتوى_تبويب>
        {الأشهر.map(([ك]) => (
          <محتوى_تبويب key={ك} value={ك}>
            {جدول(البيانات.filter((ش) => مفتاح_شهر(ش.تاريخ_الاستحقاق) === ك))}
          </محتوى_تبويب>
        ))}
      </التبويبات>

      {نموذج && <حوار_شيك شيك={نموذج.شيك} عند_الإغلاق={() => تعيين_نموذج(null)} />}
      {حذف && (
        <حوار_تأكيد
          مفتوح
          عند_التغيير={(o) => !o && تعيين_حذف(null)}
          العنوان={`حذف شيك ${حذف.اسم_المدين}`}
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
          <عنوان_الحوار>{شيك ? "تعديل شيك" : "إضافة شيك"}</عنوان_الحوار>
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
          <Field label="اسم المدين" مطلوب value={ق.اسم_المدين} onChange={(v) => حدّث("اسم_المدين", v)} autoFocus />
          <Field label="المبلغ" مطلوب value={ق.المبلغ} onChange={(v) => حدّث("المبلغ", v)} رقمي />
          <Field label="المستفيد" value={ق.المستفيد} onChange={(v) => حدّث("المستفيد", v)} />
          <Field label="محوّل من" value={ق.محول_من} onChange={(v) => حدّث("محول_من", v)} />
          <Field label="اسم البنك" value={ق.اسم_البنك} onChange={(v) => حدّث("اسم_البنك", v)} />
          <div className="space-y-1.5">
            <العنوان مطلوب>تاريخ الاستحقاق</العنوان>
            <الحقل type="date" value={ق.تاريخ_الاستحقاق} onChange={(e) => حدّث("تاريخ_الاستحقاق", e.target.value)} />
          </div>
          <Field label="رقم الشيك" value={ق.رقم_الشيك} onChange={(v) => حدّث("رقم_الشيك", v)} />
          <div className="space-y-1.5">
            <العنوان>الحالة</العنوان>
            <قائمة_اختيار
              الخيارات={خيارات_من(تسمية_حالة_الشيك)}
              القيمة={ق.الحالة}
              عند_التغيير={(v) => حدّث("الحالة", v)}
              قابل_للبحث={false}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <العنوان>ملاحظات</العنوان>
            <منطقة_نص value={ق.ملاحظات} onChange={(e) => حدّث("ملاحظات", e.target.value)} />
          </div>
        </div>

        <تذييل_الحوار>
          <الزر variant="success" onClick={احفظ} disabled={جارٍ}>
            {جارٍ ? "جارٍ الحفظ…" : "حفظ"}
          </الزر>
          <الزر variant="outline" onClick={عند_الإغلاق}>إلغاء</الزر>
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
