"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Image as ImageIcon, ChevronDown, Wallet, Layers, ListChecks, AlertTriangle, ArrowRight, CalendarClock } from "lucide-react";
import { ChequeStatus, ChequeDirection, TreasuryAccountType } from "@prisma/client";
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
import { منتقي_تاريخ } from "@/components/date-picker";
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
import { إنشاء_شيك, تعديل_شيك, تغيير_حالة_شيك, حذف_شيك, أضف_دفعة_تسوية, احذف_دفعة_تسوية, اجلب_دفعات_التسوية, سداد_مركب_لمورد, اجلب_فواتير_الطرف_للتوزيع, حدّد_توزيع_شيك, اجلب_شيكات_متاحة_للتسوية, سدّد_تسوية_بشيكات, احذف_دفعة_شيك, حوّل_شيك_لعادي } from "./actions";
import { تسمية_حالة_الشيك } from "@/lib/enums";
import { استخدم_تراجع_الحذف } from "@/hooks/use-undo-delete";
import { أنشئ_حساب_فرعي, type خريطة_حسابات_فرعية } from "@/app/(app)/treasury/sub-account-actions";

// SETTLED تُضبط تلقائياً عبر دفعات التسوية — تُستثنى من قائمة تغيير الحالة اليدوية
const حالات_الشيك = [
  "REGISTERED", "PENDING", "DEPOSITED", "ENDORSED", "COLLECTED", "BOUNCED", "CANCELLED",
] as const;
const لون_الحالة: Record<ChequeStatus, "warning" | "success" | "danger" | "navy" | "default"> = {
  REGISTERED: "default",
  PENDING: "warning",
  DEPOSITED: "navy",
  ENDORSED: "navy",
  COLLECTED: "success",
  SETTLED: "success",
  BOUNCED: "danger",
  CANCELLED: "default",
};

const أسماء_الشهور = [
  "يناير","فبراير","مارس","أبريل","مايو","يونيو",
  "يوليو","أغسطس","سبتمبر","أكتوبر","نوفمبر","ديسمبر",
];

// إظهار/إخفاء قسم استخراج الصورة (OCR) في نموذج الشيك — مؤقتاً مُخفى، اقلبه true للإرجاع.
const إظهار_OCR = false;

/** تطبيع نص عربي للبحث: توحيد الألف/الهمزة/التاء المربوطة + إزالة التشكيل. */
function طبّع_بحث(s: unknown): string {
  return (s ?? "").toString().toLowerCase()
    .replace(/[أإآٱ]/g, "ا")
    .replace(/ى/g, "ي")
    .replace(/ؤ/g, "و")
    .replace(/ئ/g, "ي")
    .replace(/ة/g, "ه")
    .replace(/[ً-ْـ]/g, "") // تشكيل + تطويل
    .replace(/\s+/g, " ")
    .trim();
}

/** انتقالات النموذج الجديد v2 للشيكات الواردة (نسخة العميل — تُطابق الخادم). */
const انتقالات_v2_وارد_ui: Record<string, ChequeStatus[]> = {
  REGISTERED: ["DEPOSITED", "ENDORSED", "COLLECTED", "CANCELLED"],
  DEPOSITED: ["BOUNCED", "CANCELLED"],
  ENDORSED: ["BOUNCED", "CANCELLED"],
  COLLECTED: ["BOUNCED", "CANCELLED"],
  BOUNCED: ["REGISTERED", "CANCELLED"],
  CANCELLED: [],
};

type مجموعة_شهر = { رقم: number; اسم: string; بنود: شيك[] };
type مجموعة_سنة = { سنة: number; شهور: مجموعة_شهر[] };

function جمّع_حسب_التاريخ(صفوف: شيك[]): مجموعة_سنة[] {
  const map: Record<number, Record<number, شيك[]>> = {};
  for (const ش of صفوف) {
    const d = new Date(ش.تاريخ_الاستحقاق);
    const y = d.getFullYear();
    const m = d.getMonth();
    (map[y] ??= {})[m] ??= [];
    map[y][m].push(ش);
  }
  return Object.keys(map)
    .map(Number)
    .sort((a, b) => b - a)
    .map((y) => ({
      سنة: y,
      شهور: Object.keys(map[y])
        .map(Number)
        .sort((a, b) => a - b)
        .map((m) => ({ رقم: m, اسم: أسماء_الشهور[m], بنود: map[y][m] })),
    }));
}

export type شيك = {
  id: number;
  اسم_المدين: string;
  المبلغ: number;
  المستفيد: string | null;
  محول_من: string | null;
  اسم_البنك: string | null;
  تاريخ_الاستحقاق: string;
  رقم_الشيك: string | null;
  الاتجاه: ChequeDirection;
  الحالة: ChequeStatus;
  معرف_الطرف: number | null;
  اسم_الطرف?: string | null;       // اسم العميل/المورد المربوط
  معرف_المظهر_له?: number | null;  // المورد المُظهَّر له (وارد)
  اسم_المظهر_له?: string | null;
  معرف_الدفتر?: number | null;
  رقم_الورقة?: number | null;
  نسخة?: number | null; // accountingVersion: 2 = نموذج خزنة الشيكات
  افتتاحي?: boolean | null; // شيك افتتاحي (ضمن الرصيد الافتتاحي، بلا حركة عند الإدخال)
  ملاحظات: string | null;
  لها_صورة: boolean;
  متأخر: boolean;
};

/** هل الشيك يتبع النموذج الجديد v2 (وارد + نسخة ≥ 2)؟ */
function نموذج_جديد_ش(ص: شيك): boolean {
  return (ص.نسخة ?? 1) >= 2 && ص.الاتجاه === "INCOMING";
}

export type طرف_شيك = { id: number; الاسم: string; النوع: "CUSTOMER" | "SUPPLIER" };
export type خيار_دفتر = { id: number; الاسم: string; الاتجاه: "INCOMING" | "OUTGOING"; اسم_البنك: string | null };

export function شاشة_الشيكات({
  البيانات,
  بنوك,
  الأطراف,
  دفاتر = [],
  حساب_نقدي,
  حساب_بنك,
  حسابات_الخزنة,
  حسابات_فرعية,
}: {
  البيانات: شيك[];
  بنوك: { id: number; الاسم: string }[];
  الأطراف: طرف_شيك[];
  دفاتر?: خيار_دفتر[];
  حساب_نقدي: number | null;
  حساب_بنك: number | null;
  حسابات_الخزنة: { id: number; النوع: TreasuryAccountType; التسمية: string }[];
  حسابات_فرعية: خريطة_حسابات_فرعية;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t, لغة } = استخدام_اللغة();
  const خيارات_الحالة = حالات_الشيك.map((s) => ({ القيمة: s, التسمية: تسمية_حالة_الشيك[s] }));
  const موردون = الأطراف.filter((p) => p.النوع === "SUPPLIER");
  const [نموذج, تعيين_نموذج] = React.useState<{ شيك?: شيك; اتجاه_افتراضي?: ChequeDirection } | null>(null);
  const [حذف, تعيين_حذف] = React.useState<شيك | null>(null);
  const { احذف: احذف_مع_تراجع, معلقة } = استخدم_تراجع_الحذف();
  const [تبويب, تعيين_تبويب] = React.useState<ChequeDirection>("INCOMING");
  const [تحصيل_شيك, تعيين_تحصيل_شيك] = React.useState<شيك | null>(null);
  const [تظهير_شيك, تعيين_تظهير_شيك] = React.useState<شيك | null>(null);
  const [تسوية_شيك, تعيين_تسوية_شيك] = React.useState<شيك | null>(null);
  const [سداد_مركب, تعيين_سداد_مركب] = React.useState(false);
  const [توزيع_شيك, تعيين_توزيع_شيك] = React.useState<شيك | null>(null);
  const [إيداع_شيك, تعيين_إيداع_شيك] = React.useState<شيك | null>(null);
  const [إلغاء_شيك, تعيين_إلغاء_شيك] = React.useState<شيك | null>(null);
  const [تفاصيل_شيك, تعيين_تفاصيل_شيك] = React.useState<شيك | null>(null);
  const [خيارات_بنوك_محلية, تعيين_خيارات_بنوك_محلية] = React.useState(بنوك);
  const [حالة_فلتر, تعيين_حالة_فلتر] = React.useState<string>("");
  const [من, تعيين_من] = React.useState("");
  const [إلى, تعيين_إلى] = React.useState("");

  const سنة_الآن = new Date().getFullYear();
  const شهر_الآن = new Date().getMonth();
  const [سنوات_مفتوحة, تعيين_سنوات_مفتوحة] = React.useState<Set<number>>(
    () => new Set([سنة_الآن])
  );
  const [شهور_مفتوحة, تعيين_شهور_مفتوحة] = React.useState<Set<string>>(
    () => new Set([`${سنة_الآن}-${شهر_الآن}`])
  );

  function تبديل_سنة(s: number) {
    تعيين_سنوات_مفتوحة((prev) => {
      const n = new Set(prev);
      n.has(s) ? n.delete(s) : n.add(s);
      return n;
    });
  }
  function تبديل_شهر(key: string) {
    تعيين_شهور_مفتوحة((prev) => {
      const n = new Set(prev);
      n.has(key) ? n.delete(key) : n.add(key);
      return n;
    });
  }

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
    {
      المفتاح: "الطرف",
      العنوان: تبويب === "INCOMING" ? "العميل (محوّل من)" : "المورد / الطرف",
      قابل_للفرز: true,
      قيمة: (ص) => ص.اسم_الطرف || ص.محول_من || "",
      خلية: (ص) => <span className="font-medium">{ص.اسم_الطرف || ص.محول_من || "—"}</span>,
    },
    { المفتاح: "اسم_المدين", العنوان: t("cheque.col.drawer"), قابل_للفرز: true, مخفي_موبايل: true },
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
        <span className="inline-flex flex-wrap items-center gap-1.5">
          {ص.متأخر ? (
            <الشارة variant="danger">{t("cheque.status.overdue")}</الشارة>
          ) : (
            <>
              <شارة_حالة الحالة={تسمية_حالة_الشيك[ص.الحالة]} متغيّر={لون_الحالة[ص.الحالة]} />
              {ص.الحالة === "ENDORSED" && ص.اسم_المظهر_له && (
                <span className="text-[11px] text-muted-foreground">{ص.اسم_المظهر_له}</span>
              )}
            </>
          )}
          {ص.افتتاحي && (
            <span className="rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-medium text-amber-800 border border-amber-300">افتتاحي</span>
          )}
        </span>,
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
            الخيارات={
              نموذج_جديد_ش(ص)
                ? [{ القيمة: ص.الحالة, التسمية: تسمية_حالة_الشيك[ص.الحالة] }, ...(انتقالات_v2_وارد_ui[ص.الحالة] ?? []).map((s) => ({ القيمة: s, التسمية: تسمية_حالة_الشيك[s] }))]
                : ص.الحالة === "SETTLED"
                ? [{ القيمة: "SETTLED", التسمية: تسمية_حالة_الشيك.SETTLED }, { القيمة: "CANCELLED", التسمية: تسمية_حالة_الشيك.CANCELLED }]
                : خيارات_الحالة
            }
            القيمة={ص.الحالة}
            قابل_للبحث={false}
            عند_التغيير={async (v) => {
              const حالة_جديدة = v as ChequeStatus;
              if (حالة_جديدة === ص.الحالة) return;
              // النموذج الجديد v2: مسارات مخصّصة
              if (نموذج_جديد_ش(ص)) {
                if (حالة_جديدة === "DEPOSITED") { تعيين_إيداع_شيك(ص); return; }      // إيداع بنك
                if (حالة_جديدة === "ENDORSED") { تعيين_تظهير_شيك(ص); return; }        // تظهير لمورد
                if (حالة_جديدة === "CANCELLED") { تعيين_إلغاء_شيك(ص); return; }        // إلغاء بسبب
                // محصّل (نقدي) / مرتد / إعادة تسجيل → مباشرة
                const r = await تغيير_حالة_شيك(ص.id, حالة_جديدة);
                r.نجاح ? إشعار.نجاح(r.رسالة!) : إشعار.خطأ(r.رسالة);
                if (r.نجاح) router.refresh();
                return;
              }
              // النموذج القديم v1
              if (حالة_جديدة === "COLLECTED" && ص.الحالة !== "COLLECTED") { تعيين_تحصيل_شيك(ص); return; }
              if (حالة_جديدة === "ENDORSED" && ص.الحالة !== "ENDORSED") { تعيين_تظهير_شيك(ص); return; }
              const r = await تغيير_حالة_شيك(ص.id, حالة_جديدة);
              r.نجاح ? إشعار.نجاح(r.رسالة!) : إشعار.خطأ(r.رسالة);
              if (r.نجاح) router.refresh();
            }}
          />
          {/* تسوية على دفعات — للشيكات الصادرة غير المصروفة من البنك */}
          {ص.الاتجاه === "OUTGOING" && (ص.الحالة === "PENDING" || ص.الحالة === "SETTLED") && (
            <الزر size="sm" variant="ghost" title="تسوية على دفعات" onClick={() => تعيين_تسوية_شيك(ص)}>
              <Wallet className="size-4 text-primary" />
            </الزر>
          )}
          {/* توزيع على فواتير العميل — للشيكات الواردة المربوطة بعميل */}
          {ص.الاتجاه === "INCOMING" && ص.معرف_الطرف && (
            <الزر size="sm" variant="ghost" title="توزيع على فواتير العميل" onClick={() => تعيين_توزيع_شيك(ص)}>
              <ListChecks className="size-4 text-primary-blue" />
            </الزر>
          )}
          <سجل_التغييرات النوع="الشيك" المعرف={ص.id} تسمية="" />
          <الزر size="sm" variant="ghost" onClick={() => تعيين_نموذج({ شيك: ص })}>
            <Pencil className="size-4" />
          </الزر>
          <الزر
            size="sm"
            variant="ghost"
            onClick={() => احذف_مع_تراجع(ص.id, () => حذف_شيك(ص.id))}
          >
            <Trash2 className="size-4 text-danger" />
          </الزر>
        </div>
      )}
    />
  );

  function عرض_مجمعة(بيانات: شيك[]) {
    const مجمعة = جمّع_حسب_التاريخ(بيانات);
    if (مجمعة.length === 0) {
      return (
        <p className="py-12 text-center text-sm text-muted-foreground">{t("cheque.empty")}</p>
      );
    }
    return (
      <div className="space-y-2">
        {مجمعة.map(({ سنة, شهور }) => {
          const عدد_الكل = شهور.reduce((s, m) => s + m.بنود.length, 0);
          const مجموع_الكل = شهور.reduce((s, m) => s + m.بنود.reduce((a, ش) => a + ش.المبلغ, 0), 0);
          const مفتوح_سنة = سنوات_مفتوحة.has(سنة);
          return (
            <div key={سنة} className="overflow-hidden rounded-xl border border-border">
              {/* رأس السنة */}
              <button
                type="button"
                onClick={() => تبديل_سنة(سنة)}
                className="flex w-full items-center justify-between bg-appgray px-5 py-3 text-right transition-colors hover:bg-gray-100"
              >
                <div className="flex items-center gap-3">
                  <ChevronDown
                    className={`size-4 text-muted-foreground transition-transform duration-200 ${مفتوح_سنة ? "" : "-rotate-90"}`}
                  />
                  <span className="text-lg font-bold ltr-nums">{سنة}</span>
                  <span className="rounded-full bg-border px-2 py-0.5 text-xs text-muted-foreground">
                    {عدد_الكل} شيك
                  </span>
                </div>
                <نص_مبلغ القيمة={مجموع_الكل} className="font-semibold" />
              </button>

              {مفتوح_سنة && (
                <div className="divide-y divide-border border-t border-border">
                  {شهور.map(({ رقم, اسم, بنود }) => {
                    const key = `${سنة}-${رقم}`;
                    const مفتوح_شهر = شهور_مفتوحة.has(key);
                    const إجمالي_شهر = بنود.reduce((s, ش) => s + ش.المبلغ, 0);
                    return (
                      <div key={key}>
                        {/* رأس الشهر */}
                        <button
                          type="button"
                          onClick={() => تبديل_شهر(key)}
                          className="flex w-full items-center justify-between bg-white px-7 py-2.5 text-right transition-colors hover:bg-appgray/60"
                        >
                          <div className="flex items-center gap-3">
                            <ChevronDown
                              className={`size-3.5 text-muted-foreground transition-transform duration-200 ${مفتوح_شهر ? "" : "-rotate-90"}`}
                            />
                            <span className="font-medium">{اسم}</span>
                            <span className="rounded-full bg-muted px-2 py-0.5 text-xs text-muted-foreground">
                              {بنود.length} شيك
                            </span>
                          </div>
                          <نص_مبلغ القيمة={إجمالي_شهر} className="text-sm text-muted-foreground" />
                        </button>

                        {مفتوح_شهر && (
                          <div className="bg-white px-4 pb-3 pt-1">
                            {جدول(بنود)}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          );
        })}
      </div>
    );
  }

  const حالات_الفلتر = [
    { ق: "", ت: t("common.all") },
    ...حالات_الشيك.map((s) => ({ ق: s, ت: تسمية_حالة_الشيك[s] })),
    { ق: "متأخر", ت: t("cheque.status.overdue") },
  ];

  const الواردة = البيانات.filter((ش) => ش.الاتجاه === "INCOMING");
  const الصادرة = البيانات.filter((ش) => ش.الاتجاه === "OUTGOING");
  const مرتدة = البيانات.filter((ش) => ش.الحالة === "BOUNCED");
  const إجمالي_المرتدة = مرتدة.reduce((س, ش) => س + ش.المبلغ, 0);

  return (
    <div className="space-y-4">
      {مرتدة.length > 0 && (
        <div className="rounded-xl border border-danger/30 bg-danger-soft/40 p-4">
          <div className="mb-2.5 flex items-center gap-2">
            <AlertTriangle className="size-5 shrink-0 text-danger" />
            <span className="text-sm font-semibold text-danger">
              تنبيه: {مرتدة.length} شيك مرتد بإجمالي <نص_مبلغ القيمة={إجمالي_المرتدة} /> يحتاج تسوية
            </span>
          </div>
          <div className="space-y-1.5">
            {مرتدة.map((ش) => (
              <button
                key={ش.id}
                type="button"
                onClick={() => تعيين_تفاصيل_شيك(ش)}
                className="flex w-full flex-wrap items-center justify-between gap-x-4 gap-y-1 rounded-lg border border-danger/20 bg-card/70 px-3 py-2 text-right transition hover:border-danger/40 hover:bg-card"
                title="فتح تفاصيل الشيك"
              >
                <span className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-sm">
                  <span className="font-medium">{ش.اسم_الطرف || ش.محول_من || ش.اسم_المدين || "طرف غير محدّد"}</span>
                  {ش.اسم_المظهر_له && (
                    <span className="rounded-md bg-warning-soft/60 px-2 py-0.5 text-[11px] text-warning">
                      رجع من المورد: {ش.اسم_المظهر_له}
                    </span>
                  )}
                  {ش.رقم_الشيك && <span className="ltr-nums text-[11px] text-muted-foreground">#{ش.رقم_الشيك}</span>}
                  <نص_تاريخ القيمة={ش.تاريخ_الاستحقاق} className="text-[11px] text-muted-foreground" />
                </span>
                <span className="flex items-center gap-3">
                  <نص_مبلغ القيمة={ش.المبلغ} className="font-semibold text-danger" />
                  <span className="inline-flex items-center gap-1 text-[12px] font-medium text-primary-blue">فتح <ArrowRight className="size-3.5 rotate-180" /></span>
                </span>
              </button>
            ))}
          </div>
          <div className="mt-2.5 text-[12px] text-muted-foreground">
            رجعت قيمة كل شيك مرتد إلى مديونية الطرف (العميل — والمورد لو كان مُظهَّراً له). تابع تحصيلها.
          </div>
        </div>
      )}
      <div className="flex justify-end gap-2">
        <الزر variant="outline" onClick={() => تعيين_سداد_مركب(true)}>
          <Layers className="size-4" /> سداد مركب لمورد
        </الزر>
        <الزر onClick={() => تعيين_نموذج({ اتجاه_افتراضي: تبويب })}>
          <Plus className="size-4" /> {t("cheque.add")}
        </الزر>
      </div>

      {/* تبويبات الاتجاه */}
      <div className="flex border-b border-border">
        {(["INCOMING", "OUTGOING"] as ChequeDirection[]).map((dir) => (
          <button
            key={dir}
            type="button"
            onClick={() => تعيين_تبويب(dir)}
            className={`px-5 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px ${
              تبويب === dir
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {dir === "INCOMING" ? t("cheque.tab.incoming") : t("cheque.tab.outgoing")}
            <span className={`mr-2 rounded-full px-1.5 py-0.5 text-xs ${تبويب === dir ? "bg-primary/10 text-primary" : "bg-muted text-muted-foreground"}`}>
              {(dir === "INCOMING" ? الواردة : الصادرة).length}
            </span>
          </button>
        ))}
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
          <div className="w-36 space-y-1">
            <العنوان>{t("rep.from")}</العنوان>
            <منتقي_تاريخ القيمة={من} عند_التغيير={تعيين_من} className="h-9" />
          </div>
          <div className="w-36 space-y-1">
            <العنوان>{t("rep.to")}</العنوان>
            <منتقي_تاريخ القيمة={إلى} عند_التغيير={تعيين_إلى} className="h-9" />
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

      {عرض_مجمعة(طبّق_الفلاتر(تبويب === "INCOMING" ? الواردة : الصادرة))}

      {نموذج && (
        <حوار_شيك
          شيك={نموذج.شيك}
          اتجاه_افتراضي={نموذج.اتجاه_افتراضي ?? "INCOMING"}
          الأطراف={الأطراف}
          دفاتر={دفاتر}
          حسابات_الخزنة={حسابات_الخزنة}
          حسابات_فرعية={حسابات_فرعية}
          عند_الإغلاق={() => تعيين_نموذج(null)}
        />
      )}
      {تسوية_شيك && (
        <حوار_تسوية
          الشيك={تسوية_شيك}
          حسابات_الخزنة={حسابات_الخزنة}
          حسابات_فرعية={حسابات_فرعية}
          عند_الإغلاق={() => { تعيين_تسوية_شيك(null); router.refresh(); }}
        />
      )}
      {سداد_مركب && (
        <حوار_سداد_مركب
          موردون={موردون}
          حسابات_الخزنة={حسابات_الخزنة}
          حسابات_فرعية={حسابات_فرعية}
          شيكات_متاحة={البيانات.filter((c) => c.الاتجاه === "INCOMING" && ["REGISTERED", "PENDING", "BOUNCED"].includes(c.الحالة))}
          عند_الإغلاق={() => { تعيين_سداد_مركب(false); router.refresh(); }}
        />
      )}
      {توزيع_شيك && (
        <حوار_توزيع
          الشيك={توزيع_شيك}
          عند_الإغلاق={() => { تعيين_توزيع_شيك(null); router.refresh(); }}
        />
      )}
      {تفاصيل_شيك && (
        <حوار_تفاصيل
          الشيك={تفاصيل_شيك}
          عند_الإغلاق={() => تعيين_تفاصيل_شيك(null)}
          عند_التعديل={() => { const ش = تفاصيل_شيك; تعيين_تفاصيل_شيك(null); تعيين_نموذج({ شيك: ش }); }}
          عند_إعادة_التسجيل={async () => {
            const r = await تغيير_حالة_شيك(تفاصيل_شيك.id, نموذج_جديد_ش(تفاصيل_شيك) ? "REGISTERED" : "PENDING");
            r.نجاح ? إشعار.نجاح(r.رسالة!) : إشعار.خطأ(r.رسالة);
            تعيين_تفاصيل_شيك(null);
            if (r.نجاح) router.refresh();
          }}
          عند_التحويل_لعادي={async () => {
            const r = await حوّل_شيك_لعادي(تفاصيل_شيك.id);
            r.نجاح ? إشعار.نجاح(r.رسالة!) : إشعار.خطأ(r.رسالة);
            تعيين_تفاصيل_شيك(null);
            if (r.نجاح) router.refresh();
          }}
        />
      )}
      {إيداع_شيك && (
        <حوار_إيداع
          الشيك={إيداع_شيك}
          حساب_بنك={حساب_بنك}
          حسابات_الخزنة={حسابات_الخزنة}
          حسابات_فرعية={حسابات_فرعية}
          عند_الإلغاء={() => تعيين_إيداع_شيك(null)}
          عند_التأكيد={async (خيارات) => {
            const r = await تغيير_حالة_شيك(إيداع_شيك.id, "DEPOSITED", خيارات);
            r.نجاح ? إشعار.نجاح(r.رسالة!) : إشعار.خطأ(r.رسالة);
            تعيين_إيداع_شيك(null);
            if (r.نجاح) router.refresh();
          }}
        />
      )}
      {إلغاء_شيك && (
        <حوار_إلغاء
          الشيك={إلغاء_شيك}
          عند_الإلغاء={() => تعيين_إلغاء_شيك(null)}
          عند_التأكيد={async (سبب) => {
            const r = await تغيير_حالة_شيك(إلغاء_شيك.id, "CANCELLED", { سبب_الإلغاء: سبب });
            r.نجاح ? إشعار.نجاح(r.رسالة!) : إشعار.خطأ(r.رسالة);
            تعيين_إلغاء_شيك(null);
            if (r.نجاح) router.refresh();
          }}
        />
      )}
      {تظهير_شيك && (
        <حوار_تظهير
          الشيك={تظهير_شيك}
          موردون={موردون}
          عند_الإلغاء={() => تعيين_تظهير_شيك(null)}
          عند_التأكيد={async (معرف_المورد) => {
            const r = await تغيير_حالة_شيك(تظهير_شيك.id, "ENDORSED", { معرف_المورد_للتظهير: معرف_المورد });
            r.نجاح ? إشعار.نجاح(r.رسالة!) : إشعار.خطأ(r.رسالة);
            تعيين_تظهير_شيك(null);
            if (r.نجاح) router.refresh();
          }}
        />
      )}
      {تحصيل_شيك && (
        <حوار_تحصيل_بنك
          الشيك={تحصيل_شيك}
          بنوك={خيارات_بنوك_محلية}
          حساب_نقدي={حساب_نقدي}
          حساب_بنك={حساب_بنك}
          عند_الإلغاء={() => تعيين_تحصيل_شيك(null)}
          عند_إضافة_بنك={(بنك_جديد) =>
            تعيين_خيارات_بنوك_محلية((س) => [...س, بنك_جديد])
          }
          عند_التأكيد={async (خيارات) => {
            const r = await تغيير_حالة_شيك(تحصيل_شيك.id, "COLLECTED", خيارات);
            r.نجاح ? إشعار.نجاح(r.رسالة!) : إشعار.خطأ(r.رسالة);
            تعيين_تحصيل_شيك(null);
            if (r.نجاح) router.refresh();
          }}
        />
      )}
    </div>
  );
}

export function حوار_شيك({
  شيك,
  اتجاه_افتراضي = "INCOMING",
  الأطراف = [],
  دفاتر = [],
  حسابات_الخزنة = [],
  حسابات_فرعية = {} as خريطة_حسابات_فرعية,
  عند_الإغلاق,
}: {
  شيك?: شيك;
  اتجاه_افتراضي?: ChequeDirection;
  الأطراف?: طرف_شيك[];
  دفاتر?: خيار_دفتر[];
  حسابات_الخزنة?: { id: number; النوع: TreasuryAccountType; التسمية: string }[];
  حسابات_فرعية?: خريطة_حسابات_فرعية;
  عند_الإغلاق: () => void;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t } = استخدام_اللغة();
  const خيارات_الحالة = حالات_الشيك.map((s) => ({ القيمة: s, التسمية: تسمية_حالة_الشيك[s] }));
  const [ق, تعيين] = React.useState({
    اسم_المدين: شيك?.اسم_المدين ?? "",
    المبلغ: شيك ? String(شيك.المبلغ) : "",
    المستفيد: شيك?.المستفيد ?? "",
    محول_من: شيك?.محول_من ?? "",
    اسم_البنك: شيك?.اسم_البنك ?? "",
    تاريخ_الاستحقاق: شيك?.تاريخ_الاستحقاق?.slice(0, 10) ?? new Date().toISOString().slice(0, 10),
    رقم_الشيك: شيك?.رقم_الشيك ?? "",
    الاتجاه: (شيك?.الاتجاه ?? اتجاه_افتراضي) as ChequeDirection,
    الحالة: (شيك?.الحالة ?? ((شيك?.الاتجاه ?? اتجاه_افتراضي) === "INCOMING" ? "REGISTERED" : "PENDING")) as ChequeStatus,
    ملاحظات: شيك?.ملاحظات ?? "",
  });
  const [معرف_الطرف, تعيين_معرف_الطرف] = React.useState<string>(
    شيك?.معرف_الطرف ? String(شيك.معرف_الطرف) : ""
  );
  const [معرف_الدفتر, تعيين_معرف_الدفتر] = React.useState<string>(
    شيك?.معرف_الدفتر ? String(شيك.معرف_الدفتر) : ""
  );
  const [رقم_الورقة, تعيين_رقم_الورقة] = React.useState<string>(
    شيك?.رقم_الورقة != null ? String(شيك.رقم_الورقة) : ""
  );
  const [صورة, تعيين_صورة] = React.useState<{ base64: string; mime: string; نص?: string } | null>(null);
  const [جارٍ, تعيين_جارٍ] = React.useState(false);
  // ── شيك افتتاحي (محسوب ضمن الرصيد الافتتاحي): بلا حركة عند الإدخال ──
  const [افتتاحي, تعيين_افتتاحي] = React.useState<boolean>(!!شيك?.افتتاحي);
  const [معرف_مورد_افتتاحي, تعيين_معرف_مورد_افتتاحي] = React.useState<string>("");
  const [معرف_حساب_افتتاحي, تعيين_معرف_حساب_افتتاحي] = React.useState<string>("");
  const [معرف_حساب_فرعي_افتتاحي, تعيين_معرف_حساب_فرعي_افتتاحي] = React.useState<string>("");
  const حدّث = (ك: string, v: string) => تعيين((س) => ({ ...س, [ك]: v }));

  // الأطراف حسب الاتجاه: وارد → عملاء، صادر → موردون
  const أطراف_مناسبة = الأطراف.filter((p) =>
    ق.الاتجاه === "INCOMING" ? p.النوع === "CUSTOMER" : p.النوع === "SUPPLIER"
  );
  // الدفاتر/الحافظات حسب الاتجاه
  const دفاتر_مناسبة = دفاتر.filter((d) => d.الاتجاه === ق.الاتجاه);
  // شيك وارد بالنموذج الجديد v2 (جديد أو نسخة ≥ 2): الحالة تبدأ «مسجّل» وتُدار بالانتقالات لا بالنموذج
  const شيك_v2_وارد = ق.الاتجاه === "INCOMING" && (!شيك || (شيك.نسخة ?? 2) >= 2);
  const وارد = ق.الاتجاه === "INCOMING";

  // للوارد: «محوّل من» = اختيار العميل (يربط الشيك + يملأ اسم المحوّل منه)
  function اختر_عميل(id: string) {
    تعيين_معرف_الطرف(id);
    const p = أطراف_مناسبة.find((x) => String(x.id) === id);
    if (p) حدّث("محول_من", p.الاسم);
  }

  async function احفظ() {
    if (وارد && !معرف_الطرف) { إشعار.خطأ("اختر العميل (محوّل من)"); return; }
    if (!وارد && !ق.اسم_المدين.trim()) { إشعار.خطأ("اسم المدين مطلوب"); return; }
    if (!ق.المبلغ || Number(String(ق.المبلغ).replace(/,/g, "")) <= 0) { إشعار.خطأ("أدخل مبلغاً صحيحاً"); return; }
    // تحقق بيانات الشيك الافتتاحي حسب حالة الدخول
    if (افتتاحي && ق.الحالة === "ENDORSED" && !معرف_مورد_افتتاحي) { إشعار.خطأ("اختر المورد المُظهَّر له الشيك"); return; }
    if (افتتاحي && (ق.الحالة === "DEPOSITED" || ق.الحالة === "COLLECTED") && !معرف_حساب_افتتاحي) { إشعار.خطأ("اختر حساب الخزنة الذي يقيم فيه الشيك"); return; }
    تعيين_جارٍ(true);
    const payload = {
      ...ق,
      معرف_الطرف: معرف_الطرف ? Number(معرف_الطرف) : null,
      معرف_الدفتر: معرف_الدفتر ? Number(معرف_الدفتر) : null,
      رقم_الورقة: رقم_الورقة ? Number(رقم_الورقة) : null,
      صورة_base64: صورة?.base64 ?? null,
      صورة_mime: صورة?.mime ?? null,
      نص_OCR: صورة?.نص ?? null,
      افتتاحي: افتتاحي && وارد,
      معرف_مورد_افتتاحي: افتتاحي && ق.الحالة === "ENDORSED" && معرف_مورد_افتتاحي ? Number(معرف_مورد_افتتاحي) : null,
      معرف_حساب_افتتاحي: افتتاحي && (ق.الحالة === "DEPOSITED" || ق.الحالة === "COLLECTED") && معرف_حساب_افتتاحي ? Number(معرف_حساب_افتتاحي) : null,
      معرف_حساب_فرعي_افتتاحي: افتتاحي && (ق.الحالة === "DEPOSITED" || ق.الحالة === "COLLECTED") && معرف_حساب_فرعي_افتتاحي ? Number(معرف_حساب_فرعي_افتتاحي) : null,
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

        {/* اختيار الاتجاه */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-appgray p-3">
          <span className="text-sm text-muted-foreground">{t("cheque.col.direction")}</span>
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            {(["INCOMING", "OUTGOING"] as ChequeDirection[]).map((dir) => (
              <button
                key={dir}
                type="button"
                className={`px-4 py-1.5 transition-colors ${ق.الاتجاه === dir ? "bg-primary text-white" : "bg-white hover:bg-muted"}`}
                onClick={() => { حدّث("الاتجاه", dir); if (!شيك) حدّث("الحالة", dir === "INCOMING" ? "REGISTERED" : "PENDING"); }}
              >
                {dir === "INCOMING" ? t("cheque.tab.incoming") : t("cheque.tab.outgoing")}
              </button>
            ))}
          </div>
        </div>

        {/* شيك افتتاحي — للوارد الجديد فقط: يُسجَّل في الشيكات بلا حركة (القيمة ضمن الرصيد الافتتاحي) */}
        {وارد && !شيك && (
          <div className="rounded-lg border border-amber-300 bg-amber-50 p-3 space-y-2">
            <label className="flex items-center gap-2 cursor-pointer select-none">
              <input
                type="checkbox"
                className="size-4 accent-amber-600"
                checked={افتتاحي}
                onChange={(e) => {
                  const قيمة = e.target.checked;
                  تعيين_افتتاحي(قيمة);
                  // افتراضياً: الافتتاحي «معي» (REGISTERED)؛ العادي يبدأ «مسجّل» أيضاً
                  if (قيمة) حدّث("الحالة", "REGISTERED");
                }}
              />
              <span className="text-sm font-medium text-amber-900">شيك افتتاحي (قديم / ضمن الرصيد الافتتاحي)</span>
            </label>
            {افتتاحي && (
              <p className="text-[12px] leading-5 text-amber-800">
                هذا الشيك موجود من قبل بدء النظام وقيمته محتسَبة سلفاً في الرصيد الافتتاحي، فلن تُسجَّل أي حركة على
                حساب العميل أو الخزنة عند الإضافة. اختر حالته الحالية وبياناتها؛ أي انتقال لاحق (تحصيل/ارتداد/إلخ)
                يُنشئ حركة حقيقية.
              </p>
            )}
          </div>
        )}

        {!شيك && إظهار_OCR && (
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
            عند_المسح={() => تعيين_صورة(null)}
          />
        )}

        <div className="grid gap-3 sm:grid-cols-2">
          {وارد ? (
            <div className="space-y-1.5">
              <العنوان مطلوب>محوّل من (العميل)</العنوان>
              <قائمة_اختيار
                autoFocus
                الخيارات={أطراف_مناسبة.map((p) => ({ القيمة: String(p.id), التسمية: p.الاسم }))}
                القيمة={معرف_الطرف}
                عند_التغيير={اختر_عميل}
                نص_بديل="اختر العميل…"
              />
            </div>
          ) : (
            <Field label={t("cheque.col.drawer")} مطلوب value={ق.اسم_المدين} onChange={(v) => حدّث("اسم_المدين", v)} autoFocus />
          )}
          <Field label={t("pay.amount")} مطلوب value={ق.المبلغ} onChange={(v) => حدّث("المبلغ", v)} رقمي />
          <Field label={t("cheque.col.beneficiary")} value={ق.المستفيد} onChange={(v) => حدّث("المستفيد", v)} />
          {وارد ? (
            <Field label={`${t("cheque.col.drawer")} (اختياري)`} value={ق.اسم_المدين} onChange={(v) => حدّث("اسم_المدين", v)} />
          ) : (
            <Field label={t("cheque.f.transferred_from")} value={ق.محول_من} onChange={(v) => حدّث("محول_من", v)} />
          )}
          <Field label={t("cheque.col.bank")} value={ق.اسم_البنك} onChange={(v) => حدّث("اسم_البنك", v)} />
          <div className="space-y-1.5">
            <العنوان مطلوب>{t("cheque.col.due")}</العنوان>
            <منتقي_تاريخ القيمة={ق.تاريخ_الاستحقاق} عند_التغيير={(v) => حدّث("تاريخ_الاستحقاق", v)} />
          </div>
          <Field label={t("cheque.col.number")} value={ق.رقم_الشيك} onChange={(v) => حدّث("رقم_الشيك", v)} />
          <div className="space-y-1.5">
            <العنوان>{t("cheque.col.status")}</العنوان>
            {افتتاحي ? (
              // شيك افتتاحي: اختر الحالة الحالية للشيك (نقطة البداية، بلا حركة)
              <قائمة_اختيار
                الخيارات={([
                  ["REGISTERED", "معي (تحت اليد)"],
                  ["DEPOSITED", "مودع بالبنك"],
                  ["ENDORSED", "مظهّر لمورد"],
                  ["COLLECTED", "محصّل"],
                  ["BOUNCED", "مرتد"],
                  ["CANCELLED", "ملغي"],
                ] as [ChequeStatus, string][]).map(([v, l]) => ({ القيمة: v, التسمية: l }))}
                القيمة={ق.الحالة}
                عند_التغيير={(v) => حدّث("الحالة", v)}
                قابل_للبحث={false}
              />
            ) : شيك_v2_وارد ? (
              <div className="flex h-10 items-center rounded-lg border border-border bg-appgray px-3 text-sm text-muted-foreground">
                {تسمية_حالة_الشيك[ق.الحالة] || تسمية_حالة_الشيك.REGISTERED}
                <span className="mr-2 text-[11px]">— تتغيّر بالإيداع/التظهير/التحصيل</span>
              </div>
            ) : (
              <قائمة_اختيار
                الخيارات={خيارات_الحالة}
                القيمة={ق.الحالة}
                عند_التغيير={(v) => حدّث("الحالة", v)}
                قابل_للبحث={false}
              />
            )}
          </div>
          {/* بيانات الشيك الافتتاحي حسب حالة الدخول */}
          {افتتاحي && ق.الحالة === "ENDORSED" && (
            <div className="space-y-1.5">
              <العنوان مطلوب>المورد المُظهَّر له</العنوان>
              <قائمة_اختيار
                الخيارات={الأطراف.filter((p) => p.النوع === "SUPPLIER").map((p) => ({ القيمة: String(p.id), التسمية: p.الاسم }))}
                القيمة={معرف_مورد_افتتاحي}
                عند_التغيير={تعيين_معرف_مورد_افتتاحي}
                نص_بديل="اختر المورد…"
              />
            </div>
          )}
          {افتتاحي && (ق.الحالة === "DEPOSITED" || ق.الحالة === "COLLECTED") && (
            <div className="space-y-1.5">
              <العنوان مطلوب>{ق.الحالة === "DEPOSITED" ? "البنك المُودَع فيه" : "جهة التحصيل"}</العنوان>
              <قائمة_اختيار
                الخيارات={حسابات_الخزنة.map((a) => ({ القيمة: String(a.id), التسمية: a.التسمية }))}
                القيمة={معرف_حساب_افتتاحي}
                عند_التغيير={(v) => { تعيين_معرف_حساب_افتتاحي(v); تعيين_معرف_حساب_فرعي_افتتاحي(""); }}
                نص_بديل="اختر الحساب…"
              />
              {(() => {
                const حساب = حسابات_الخزنة.find((a) => String(a.id) === معرف_حساب_افتتاحي);
                const فرعية = حساب ? (حسابات_فرعية[حساب.النوع] ?? []) : [];
                return فرعية.length > 0 ? (
                  <قائمة_اختيار
                    الخيارات={[{ القيمة: "", التسمية: "— بدون حساب فرعي —" }, ...فرعية.map((s) => ({ القيمة: String(s.id), التسمية: s.الاسم }))]}
                    القيمة={معرف_حساب_فرعي_افتتاحي}
                    عند_التغيير={تعيين_معرف_حساب_فرعي_افتتاحي}
                    نص_بديل="حساب فرعي (اختياري)…"
                  />
                ) : null;
              })()}
            </div>
          )}
          {!وارد && (
            <div className="space-y-1.5">
              <العنوان>المورد (اختياري)</العنوان>
              <قائمة_اختيار
                الخيارات={[
                  { القيمة: "", التسمية: "— بدون —" },
                  ...أطراف_مناسبة.map((p) => ({ القيمة: String(p.id), التسمية: p.الاسم })),
                ]}
                القيمة={معرف_الطرف}
                عند_التغيير={تعيين_معرف_الطرف}
                نص_بديل="اربط بمورد…"
              />
            </div>
          )}
          {دفاتر_مناسبة.length > 0 && (
            <>
              <div className="space-y-1.5">
                <العنوان>{ق.الاتجاه === "OUTGOING" ? "الدفتر (اختياري)" : "الحافظة (اختياري)"}</العنوان>
                <قائمة_اختيار
                  الخيارات={[
                    { القيمة: "", التسمية: "— بدون —" },
                    ...دفاتر_مناسبة.map((d) => ({ القيمة: String(d.id), التسمية: d.اسم_البنك ? `${d.الاسم} — ${d.اسم_البنك}` : d.الاسم })),
                  ]}
                  القيمة={معرف_الدفتر}
                  عند_التغيير={(v) => { تعيين_معرف_الدفتر(v); if (!v) تعيين_رقم_الورقة(""); }}
                  نص_بديل="اختر الدفتر/الحافظة…"
                />
              </div>
              {معرف_الدفتر && (
                <Field label="رقم الورقة" value={رقم_الورقة} onChange={(v) => تعيين_رقم_الورقة(v.replace(/[^\d]/g, ""))} رقمي />
              )}
            </>
          )}
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

function حوار_تحصيل_بنك({
  الشيك,
  بنوك,
  حساب_نقدي,
  حساب_بنك,
  عند_الإلغاء,
  عند_إضافة_بنك,
  عند_التأكيد,
}: {
  الشيك: شيك;
  بنوك: { id: number; الاسم: string }[];
  حساب_نقدي: number | null;
  حساب_بنك: number | null;
  عند_الإلغاء: () => void;
  عند_إضافة_بنك: (بنك: { id: number; الاسم: string }) => void;
  عند_التأكيد: (خيارات: { معرف_حساب_التحصيل: number | null; معرف_حساب_فرعي: number | null }) => Promise<void>;
}) {
  const إشعار = useإشعار();
  const { t } = استخدام_اللغة();
  const [وجهة, تعيين_وجهة] = React.useState<"CASH" | "BANK">("BANK");
  const [بنك_محدد, تعيين_بنك_محدد] = React.useState("");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  const خيارات = بنوك.map((b) => ({ القيمة: String(b.id), التسمية: b.الاسم }));

  async function أضف_بنك_جديد(الاسم: string) {
    const r = await أنشئ_حساب_فرعي("BANK", الاسم);
    if (!r.نجاح || !r.بيانات) { إشعار.خطأ(r.رسالة ?? "خطأ"); return; }
    const بنك_جديد = { id: r.بيانات.id, الاسم };
    عند_إضافة_بنك(بنك_جديد);
    تعيين_بنك_محدد(String(r.بيانات.id));
  }

  async function أكّد() {
    if (وجهة === "BANK" && !بنك_محدد) return إشعار.خطأ("اختر البنك");
    تعيين_جارٍ(true);
    await عند_التأكيد(
      وجهة === "CASH"
        ? { معرف_حساب_التحصيل: حساب_نقدي, معرف_حساب_فرعي: null }
        : { معرف_حساب_التحصيل: حساب_بنك, معرف_حساب_فرعي: بنك_محدد ? Number(بنك_محدد) : null }
    );
    تعيين_جارٍ(false);
  }

  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإلغاء()}>
      <محتوى_الحوار className="max-w-sm">
        <رأس_الحوار>
          <عنوان_الحوار>تحصيل الشيك</عنوان_الحوار>
        </رأس_الحوار>
        <div className="space-y-4 py-2">
          <p className="text-sm text-muted-foreground">
            تحصيل شيك{الشيك.رقم_الشيك ? ` رقم ${الشيك.رقم_الشيك}` : ""} —{" "}
            <span className="font-medium text-foreground">{الشيك.اسم_المدين}</span>
            {" "}بمبلغ{" "}
            <span className="ltr-nums font-semibold">{الشيك.المبلغ.toLocaleString("ar-EG")}</span>
          </p>
          <div className="space-y-1.5">
            <العنوان>وجهة التحصيل</العنوان>
            <div className="flex rounded-lg border border-border overflow-hidden text-sm w-fit">
              <button type="button" className={`px-4 py-1 ${وجهة === "CASH" ? "bg-primary text-white" : "hover:bg-muted"}`} onClick={() => تعيين_وجهة("CASH")}>نقدي (الخزنة)</button>
              <button type="button" className={`px-4 py-1 ${وجهة === "BANK" ? "bg-primary text-white" : "hover:bg-muted"}`} onClick={() => تعيين_وجهة("BANK")}>إيداع بنكي</button>
            </div>
          </div>
          {وجهة === "BANK" && (
            <div className="space-y-1.5">
              <العنوان مطلوب>البنك</العنوان>
              <قائمة_اختيار
                الخيارات={خيارات}
                القيمة={بنك_محدد}
                عند_التغيير={تعيين_بنك_محدد}
                نص_بديل="اختر بنك"
                عند_الإضافة={أضف_بنك_جديد}
                تسمية_الإضافة="إضافة بنك جديد"
              />
            </div>
          )}
        </div>
        <تذييل_الحوار>
          <الزر variant="success" onClick={أكّد} disabled={جارٍ}>
            {جارٍ ? t("common.saving") : "تأكيد التحصيل"}
          </الزر>
          <الزر variant="outline" onClick={عند_الإلغاء}>{t("common.cancel")}</الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}

function حوار_تظهير({
  الشيك,
  موردون,
  عند_الإلغاء,
  عند_التأكيد,
}: {
  الشيك: شيك;
  موردون: طرف_شيك[];
  عند_الإلغاء: () => void;
  عند_التأكيد: (معرف_المورد: number) => Promise<void>;
}) {
  const إشعار = useإشعار();
  const { t } = استخدام_اللغة();
  const [مورد, تعيين_مورد] = React.useState("");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  async function أكّد() {
    if (!مورد) return إشعار.خطأ("اختر المورد المُظهَّر له الشيك");
    تعيين_جارٍ(true);
    await عند_التأكيد(Number(مورد));
    تعيين_جارٍ(false);
  }

  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإلغاء()}>
      <محتوى_الحوار className="max-w-sm">
        <رأس_الحوار>
          <عنوان_الحوار>تظهير الشيك لمورد</عنوان_الحوار>
        </رأس_الحوار>
        <div className="space-y-4 py-2">
          <p className="rounded-lg bg-appgray px-3 py-2 text-[12px] text-muted-foreground">
            تظهير الشيك يقلّل المستحق للمورد بقيمته بدون حركة خزنة. لو ارتد الشيك يرجع المستحق للمورد ودين العميل تلقائياً.
          </p>
          <p className="text-sm text-muted-foreground">
            شيك{الشيك.رقم_الشيك ? ` رقم ${الشيك.رقم_الشيك}` : ""} بمبلغ{" "}
            <span className="ltr-nums font-semibold">{الشيك.المبلغ.toLocaleString("ar-EG")}</span>
          </p>
          <div className="space-y-1.5">
            <العنوان مطلوب>المورد</العنوان>
            <قائمة_اختيار
              الخيارات={موردون.map((s) => ({ القيمة: String(s.id), التسمية: s.الاسم }))}
              القيمة={مورد}
              عند_التغيير={تعيين_مورد}
              نص_بديل="اختر المورد…"
            />
          </div>
        </div>
        <تذييل_الحوار>
          <الزر variant="success" onClick={أكّد} disabled={جارٍ}>
            {جارٍ ? t("common.saving") : "تأكيد التظهير"}
          </الزر>
          <الزر variant="outline" onClick={عند_الإلغاء}>{t("common.cancel")}</الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}

function حوار_تسوية({
  الشيك,
  حسابات_الخزنة,
  حسابات_فرعية,
  عند_الإغلاق,
}: {
  الشيك: شيك;
  حسابات_الخزنة: { id: number; النوع: TreasuryAccountType; التسمية: string }[];
  حسابات_فرعية: خريطة_حسابات_فرعية;
  عند_الإغلاق: () => void;
}) {
  const إشعار = useإشعار();
  const [بيانات, تعيين_بيانات] = React.useState<{ الإجمالي: number; المُسدَّد: number; الدفعات: { نوع: "خزنة" | "شيك"; id: number; المبلغ: number; الطريقة: string | null; التاريخ: string; البيان: string }[] } | null>(null);
  const [مبلغ, تعيين_مبلغ] = React.useState("");
  const [حساب, تعيين_حساب] = React.useState(String(حسابات_الخزنة[0]?.id ?? ""));
  const [حساب_فرعي, تعيين_حساب_فرعي] = React.useState("");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);
  const [وسيلة, تعيين_وسيلة] = React.useState<"خزنة" | "شيك">("خزنة");
  const [شيكات_متاحة, تعيين_شيكات_متاحة] = React.useState<{ id: number; المبلغ: number; الاسم: string; رقم_الشيك: string | null; اسم_البنك: string | null; تاريخ_الاستحقاق: string }[]>([]);
  const [مختارة, تعيين_مختارة] = React.useState<Set<number>>(new Set());
  const [محمّل, تعيين_محمّل] = React.useState(false);
  const [بحث_تسوية, تعيين_بحث_تسوية] = React.useState("");

  const شيكات_معروضة = React.useMemo(() => {
    const ك = طبّع_بحث(بحث_تسوية);
    if (!ك) return شيكات_متاحة;
    return شيكات_متاحة.filter((ش) => {
      const يوم = ش.تاريخ_الاستحقاق.slice(0, 10);
      return [ش.الاسم, ش.رقم_الشيك, ش.اسم_البنك, String(ش.المبلغ), يوم, يوم.split("-").reverse().join("/")]
        .some((v) => طبّع_بحث(v).includes(ك));
    });
  }, [شيكات_متاحة, بحث_تسوية]);

  const نوع_الحساب = حسابات_الخزنة.find((a) => a.id === Number(حساب))?.النوع ?? null;
  const له_فرعية = نوع_الحساب !== null && نوع_الحساب !== "CASH";
  const خيارات_فرعية = له_فرعية && نوع_الحساب ? (حسابات_فرعية[نوع_الحساب] ?? []) : [];

  async function حمّل() {
    تعيين_محمّل(true);
    const [r, ش] = await Promise.all([اجلب_دفعات_التسوية(الشيك.id), اجلب_شيكات_متاحة_للتسوية(الشيك.id)]);
    if (r.نجاح && r.بيانات) تعيين_بيانات(r.بيانات);
    if (ش.نجاح && ش.بيانات) تعيين_شيكات_متاحة(ش.بيانات.الشيكات);
    تعيين_مختارة(new Set());
    تعيين_محمّل(false);
  }
  React.useEffect(() => { حمّل(); /* eslint-disable-next-line */ }, []);

  const مجموع_المختار = شيكات_متاحة.filter((ش) => مختارة.has(ش.id)).reduce((س, ش) => س + ش.المبلغ, 0);

  function بدّل_شيك(id: number, مبلغ: number) {
    تعيين_مختارة((س) => {
      const n = new Set(س);
      if (n.has(id)) { n.delete(id); return n; }
      // منع تجاوز المتبقّي
      if (مجموع_المختار + مبلغ > متبقٍ + 0.005) { إشعار.خطأ("إجمالي المحدد يتجاوز المتبقّي"); return n; }
      n.add(id); return n;
    });
  }

  async function أضف_بشيكات() {
    if (مختارة.size === 0) return إشعار.خطأ("اختر شيكاً واحداً على الأقل");
    تعيين_جارٍ(true);
    const r = await سدّد_تسوية_بشيكات(الشيك.id, [...مختارة]);
    تعيين_جارٍ(false);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    إشعار.نجاح(r.رسالة!);
    await حمّل();
  }
  async function احذف_شيك_دفعة(معرف: number) {
    const r = await احذف_دفعة_شيك(معرف);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    إشعار.نجاح(r.رسالة!);
    await حمّل();
  }

  const متبقٍ = بيانات ? +(بيانات.الإجمالي - بيانات.المُسدَّد).toFixed(2) : الشيك.المبلغ;

  async function أضف() {
    const م = Number(مبلغ.replace(/,/g, "")) || 0;
    if (م <= 0) return إشعار.خطأ("أدخل مبلغاً");
    if (م > متبقٍ + 0.005) return إشعار.خطأ(`المبلغ أكبر من المتبقي (${متبقٍ.toLocaleString("en-US", { minimumFractionDigits: 2 })})`);
    if (له_فرعية && خيارات_فرعية.length > 0 && !حساب_فرعي) return إشعار.خطأ("اختر الحساب الفرعي");
    تعيين_جارٍ(true);
    const r = await أضف_دفعة_تسوية(الشيك.id, {
      المبلغ: مبلغ.replace(/,/g, ""),
      معرف_الحساب: Number(حساب),
      معرف_حساب_فرعي: حساب_فرعي ? Number(حساب_فرعي) : null,
    });
    تعيين_جارٍ(false);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    إشعار.نجاح(r.رسالة!);
    تعيين_مبلغ("");
    await حمّل();
  }

  async function احذف(txnId: number) {
    const r = await احذف_دفعة_تسوية(txnId);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    إشعار.نجاح(r.رسالة!);
    await حمّل();
  }

  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإغلاق()}>
      <محتوى_الحوار className="max-w-lg">
        <رأس_الحوار>
          <عنوان_الحوار className="flex items-center gap-2"><Wallet className="size-5 text-primary" /> تسوية شيك صادر على دفعات</عنوان_الحوار>
        </رأس_الحوار>
        <p className="rounded-lg bg-appgray px-3 py-2 text-[12px] text-muted-foreground">
          الدفعات تخرج من الخزنة (كاش/تحويل) بدون صرف الشيك من البنك. لما تكتمل القيمة يُقفل الشيك «تمت التسوية».
        </p>

        {/* ملخص التقدّم */}
        <div className="grid grid-cols-3 gap-2 text-center text-sm my-1">
          <div className="rounded-lg bg-appgray p-2"><div className="text-[11px] text-muted-foreground">قيمة الشيك</div><div className="font-semibold"><نص_مبلغ القيمة={بيانات?.الإجمالي ?? الشيك.المبلغ} /></div></div>
          <div className="rounded-lg bg-success-soft/40 p-2"><div className="text-[11px] text-muted-foreground">المُسدَّد</div><div className="font-semibold text-success"><نص_مبلغ القيمة={بيانات?.المُسدَّد ?? 0} /></div></div>
          <div className="rounded-lg bg-warning-soft/40 p-2"><div className="text-[11px] text-muted-foreground">المتبقي</div><div className="font-semibold text-warning"><نص_مبلغ القيمة={متبقٍ} /></div></div>
        </div>

        {/* الدفعات المسجّلة */}
        {بيانات && بيانات.الدفعات.length > 0 && (
          <div className="space-y-1 max-h-40 overflow-y-auto">
            {بيانات.الدفعات.map((د) => (
              <div key={`${د.نوع}-${د.id}`} className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-sm">
                <span className="flex items-center gap-2 min-w-0">
                  <نص_مبلغ القيمة={د.المبلغ} />
                  {د.نوع === "شيك"
                    ? <span className="rounded bg-primary/10 px-1.5 py-0.5 text-[10px] text-primary shrink-0">شيك وارد</span>
                    : <span className="text-[11px] text-muted-foreground">{د.الطريقة ?? ""}</span>}
                  {د.نوع === "شيك" && <span className="truncate text-[11px] text-muted-foreground">{د.البيان}</span>}
                </span>
                <span className="flex items-center gap-2 shrink-0">
                  <نص_تاريخ القيمة={د.التاريخ} className="text-[11px] text-muted-foreground" />
                  <الزر size="sm" variant="ghost" onClick={() => (د.نوع === "شيك" ? احذف_شيك_دفعة(د.id) : احذف(د.id))} title={د.نوع === "شيك" ? "إرجاع الشيك" : "حذف الدفعة"}><Trash2 className="size-4 text-danger" /></الزر>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* إضافة دفعة */}
        {متبقٍ > 0.005 && (
          <div className="mt-2 rounded-lg border border-border p-3 space-y-2">
            <div className="flex items-center justify-between">
              <العنوان className="mb-0">إضافة دفعة</العنوان>
              <div className="flex rounded-lg border border-border overflow-hidden text-[12px]">
                <button type="button" className={`px-3 py-1 transition ${وسيلة === "خزنة" ? "bg-primary text-white" : "bg-card hover:bg-appgray"}`} onClick={() => تعيين_وسيلة("خزنة")}>من الخزنة</button>
                <button type="button" className={`px-3 py-1 transition ${وسيلة === "شيك" ? "bg-primary text-white" : "bg-card hover:bg-appgray"}`} onClick={() => تعيين_وسيلة("شيك")}>بشيك وارد</button>
              </div>
            </div>

            {وسيلة === "خزنة" ? (
              <div className="flex flex-wrap items-end gap-2">
                <div className="w-28 space-y-1"><span className="text-[11px] text-muted-foreground">المبلغ</span><الحقل selectOnFocus className="ltr-nums" value={مبلغ} onChange={(e) => تعيين_مبلغ(e.target.value)} placeholder="0.00" /></div>
                <div className="flex-1 min-w-[120px] space-y-1"><span className="text-[11px] text-muted-foreground">الوسيلة</span>
                  <قائمة_اختيار قابل_للبحث={false} الخيارات={حسابات_الخزنة.map((a) => ({ القيمة: String(a.id), التسمية: a.التسمية }))} القيمة={حساب} عند_التغيير={(v) => { تعيين_حساب(v); تعيين_حساب_فرعي(""); }} />
                </div>
                {خيارات_فرعية.length > 0 && (
                  <div className="flex-1 min-w-[120px] space-y-1"><span className="text-[11px] text-muted-foreground">الحساب الفرعي</span>
                    <قائمة_اختيار الخيارات={خيارات_فرعية.map((s) => ({ القيمة: String(s.id), التسمية: s.الاسم }))} القيمة={حساب_فرعي} عند_التغيير={تعيين_حساب_فرعي} نص_بديل="اختر…" />
                  </div>
                )}
                <الزر variant="success" onClick={أضف} disabled={جارٍ}><Plus className="size-4" /> دفعة</الزر>
              </div>
            ) : (
              <div className="space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="text-[11px] text-muted-foreground">شيكات واردة متاحة (اختر أكتر من واحد) — قيمة كل شيك ≤ المتبقّي</span>
                  {مختارة.size > 0 && <span className="text-[11px] font-medium text-primary">{مختارة.size} محدد · <نص_مبلغ القيمة={مجموع_المختار} /></span>}
                </div>
                {محمّل ? (
                  <p className="py-3 text-center text-[12px] text-muted-foreground">…جارٍ تحميل الشيكات</p>
                ) : شيكات_متاحة.length === 0 ? (
                  <p className="rounded-lg border border-dashed border-border py-3 text-center text-[12px] text-muted-foreground">لا توجد شيكات واردة متاحة بقيمة ≤ المتبقّي.</p>
                ) : (
                  <>
                    <الحقل value={بحث_تسوية} onChange={(e) => تعيين_بحث_تسوية(e.target.value)} placeholder="ابحث بالاسم / رقم الشيك / البنك / المبلغ / التاريخ…" className="h-9" />
                    <div className="max-h-40 space-y-1 overflow-y-auto rounded-lg border border-border p-2">
                      {شيكات_معروضة.length === 0 ? (
                        <p className="py-3 text-center text-[12px] text-muted-foreground">لا توجد شيكات مطابقة للبحث.</p>
                      ) : شيكات_معروضة.map((ش) => {
                        const محدد = مختارة.has(ش.id);
                        const يتجاوز = !محدد && مجموع_المختار + ش.المبلغ > متبقٍ + 0.005;
                        return (
                          <label key={ش.id} className={`flex items-center justify-between gap-2 rounded px-2 py-1.5 text-sm ${يتجاوز ? "opacity-40 cursor-not-allowed" : "cursor-pointer hover:bg-appgray"}`}>
                            <span className="flex items-center gap-2 min-w-0">
                              <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={محدد} disabled={يتجاوز} onChange={() => بدّل_شيك(ش.id, ش.المبلغ)} />
                              <span className="min-w-0">
                                <span className="font-medium">{ش.الاسم}</span>
                                {ش.رقم_الشيك && <span className="mr-1.5 text-[11px] text-muted-foreground ltr-nums">#{ش.رقم_الشيك}</span>}
                                {ش.اسم_البنك && <span className="mr-1.5 text-[11px] text-muted-foreground">· {ش.اسم_البنك}</span>}
                              </span>
                            </span>
                            <span className="flex items-center gap-2 shrink-0">
                              <نص_تاريخ القيمة={ش.تاريخ_الاستحقاق} className="text-[11px] text-muted-foreground" />
                              <نص_مبلغ القيمة={ش.المبلغ} />
                            </span>
                          </label>
                        );
                      })}
                    </div>
                    <الزر variant="success" className="w-full" onClick={أضف_بشيكات} disabled={جارٍ || مختارة.size === 0}>
                      <Plus className="size-4" /> استخدم {مختارة.size > 0 ? `${مختارة.size} شيك` : "الشيكات المحددة"}
                    </الزر>
                  </>
                )}
                <p className="text-[11px] text-muted-foreground">كل شيك يموّل التسوية بقيمته كاملة. لا يؤثّر على رصيد المورد.</p>
              </div>
            )}
          </div>
        )}

        <تذييل_الحوار>
          <الزر variant="outline" onClick={عند_الإغلاق}>إغلاق</الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}

function حوار_توزيع({ الشيك, عند_الإغلاق }: { الشيك: شيك; عند_الإغلاق: () => void }) {
  const إشعار = useإشعار();
  const [قيمة_الشيك, تعيين_قيمة_الشيك] = React.useState(الشيك.المبلغ);
  const [اسم_الطرف, تعيين_اسم_الطرف] = React.useState<string | null>(null);
  const [فواتير, تعيين_فواتير] = React.useState<
    { id: number; رقم: number | null; التاريخ: string; الإجمالي: number; مغطّى_بشيكات_أخرى: number; المخصَّص_لهذا_الشيك: number }[]
  >([]);
  const [مبالغ, تعيين_مبالغ] = React.useState<Record<number, string>>({});
  const [جارٍ, تعيين_جارٍ] = React.useState(false);
  const [محمّل, تعيين_محمّل] = React.useState(false);

  React.useEffect(() => {
    (async () => {
      const r = await اجلب_فواتير_الطرف_للتوزيع(الشيك.id);
      if (!r.نجاح || !r.بيانات) { إشعار.خطأ(r.رسالة ?? "تعذّر تحميل الفواتير"); عند_الإغلاق(); return; }
      تعيين_قيمة_الشيك(r.بيانات.قيمة_الشيك);
      تعيين_اسم_الطرف(r.بيانات.اسم_الطرف);
      تعيين_فواتير(r.بيانات.الفواتير);
      const م: Record<number, string> = {};
      for (const f of r.بيانات.الفواتير) if (f.المخصَّص_لهذا_الشيك > 0) م[f.id] = String(f.المخصَّص_لهذا_الشيك);
      تعيين_مبالغ(م);
      تعيين_محمّل(true);
    })();
    /* eslint-disable-next-line */
  }, []);

  const رقم = (v: string | undefined) => Number((v ?? "").replace(/,/g, "")) || 0;
  const موزَّع = Object.values(مبالغ).reduce((س, v) => س + رقم(v), 0);
  const متبقٍ = +(قيمة_الشيك - موزَّع).toFixed(2);

  function تعبئة_تلقائية() {
    let باقٍ = قيمة_الشيك;
    const م: Record<number, string> = {};
    for (const f of فواتير) {
      if (باقٍ <= 0.005) break;
      const مطلوب = +(f.الإجمالي - f.مغطّى_بشيكات_أخرى).toFixed(2); // المتبقّي غير المغطّى بشيكات أخرى
      if (مطلوب <= 0) continue;
      const خصّص = Math.min(مطلوب, باقٍ);
      م[f.id] = String(+خصّص.toFixed(2));
      باقٍ = +(باقٍ - خصّص).toFixed(2);
    }
    تعيين_مبالغ(م);
  }

  async function احفظ() {
    if (متبقٍ < -0.005) return إشعار.خطأ("إجمالي التوزيع أكبر من قيمة الشيك");
    تعيين_جارٍ(true);
    const بنود = فواتير
      .filter((f) => رقم(مبالغ[f.id]) > 0)
      .map((f) => ({ معرف_الفاتورة: f.id, المبلغ: رقم(مبالغ[f.id]) }));
    const r = await حدّد_توزيع_شيك(الشيك.id, بنود);
    تعيين_جارٍ(false);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    إشعار.نجاح(r.رسالة!);
    عند_الإغلاق();
  }

  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإغلاق()}>
      <محتوى_الحوار className="max-w-2xl">
        <رأس_الحوار>
          <عنوان_الحوار className="flex items-center gap-2">
            <ListChecks className="size-5 text-primary-blue" /> توزيع الشيك على فواتير{اسم_الطرف ? ` — ${اسم_الطرف}` : ""}
          </عنوان_الحوار>
        </رأس_الحوار>
        <p className="rounded-lg bg-appgray px-3 py-2 text-[12px] text-muted-foreground">
          تتبّع فقط: تحدّد أي فواتير يغطّيها هذا الشيك. لا يُنشئ قيوداً محاسبية — أثر العميل تمّ وقت استلام الشيك.
        </p>

        <div className="grid grid-cols-3 gap-2 text-center text-sm my-1">
          <div className="rounded-lg bg-appgray p-2"><div className="text-[11px] text-muted-foreground">قيمة الشيك</div><div className="font-semibold"><نص_مبلغ القيمة={قيمة_الشيك} /></div></div>
          <div className="rounded-lg bg-success-soft/40 p-2"><div className="text-[11px] text-muted-foreground">الموزَّع</div><div className="font-semibold text-success"><نص_مبلغ القيمة={موزَّع} /></div></div>
          <div className={`rounded-lg p-2 ${متبقٍ < -0.005 ? "bg-danger-soft/50" : "bg-warning-soft/40"}`}><div className="text-[11px] text-muted-foreground">غير موزَّع</div><div className={`font-semibold ${متبقٍ < -0.005 ? "text-danger" : "text-warning"}`}><نص_مبلغ القيمة={متبقٍ} /></div></div>
        </div>

        {محمّل && فواتير.length === 0 && (
          <p className="py-8 text-center text-sm text-muted-foreground">لا توجد فواتير بيع لهذا العميل.</p>
        )}

        {فواتير.length > 0 && (
          <>
            <div className="flex justify-end">
              <الزر size="sm" variant="outline" onClick={تعبئة_تلقائية}>تعبئة تلقائية</الزر>
            </div>
            <div className="space-y-1 max-h-72 overflow-y-auto">
              {فواتير.map((f) => (
                <div key={f.id} className="flex items-center gap-3 rounded-lg border border-border px-3 py-1.5 text-sm">
                  <div className="flex-1">
                    <span className="font-medium ltr-nums">#{f.رقم ?? f.id}</span>
                    <نص_تاريخ القيمة={f.التاريخ} className="mr-2 text-[11px] text-muted-foreground" />
                    <div className="text-[11px] text-muted-foreground">
                      الإجمالي: <نص_مبلغ القيمة={f.الإجمالي} />
                      {f.مغطّى_بشيكات_أخرى > 0 && <> · مغطّى بشيكات أخرى: <نص_مبلغ القيمة={f.مغطّى_بشيكات_أخرى} /></>}
                    </div>
                  </div>
                  <الحقل
                    selectOnFocus
                    className="ltr-nums w-28"
                    value={مبالغ[f.id] ?? ""}
                    onChange={(e) => تعيين_مبالغ((س) => ({ ...س, [f.id]: e.target.value }))}
                    placeholder="0.00"
                  />
                </div>
              ))}
            </div>
          </>
        )}

        <تذييل_الحوار>
          <الزر variant="outline" onClick={عند_الإغلاق}>إلغاء</الزر>
          <الزر onClick={احفظ} disabled={جارٍ || !محمّل}>حفظ التوزيع</الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}

/** حوار إيداع شيك وارد (v2) في بنك — يخصم من خزنة الشيكات ويضيف للبنك المختار. */
function حوار_إيداع({
  الشيك, حساب_بنك, حسابات_الخزنة, حسابات_فرعية, عند_الإلغاء, عند_التأكيد,
}: {
  الشيك: شيك;
  حساب_بنك: number | null;
  حسابات_الخزنة: { id: number; النوع: TreasuryAccountType; التسمية: string }[];
  حسابات_فرعية: خريطة_حسابات_فرعية;
  عند_الإلغاء: () => void;
  عند_التأكيد: (خيارات: { معرف_حساب_التحصيل: number; معرف_حساب_فرعي: number | null }) => void | Promise<void>;
}) {
  const إشعار = useإشعار();
  const [حساب, تعيين_حساب] = React.useState(String(حساب_بنك ?? حسابات_الخزنة.find((a) => a.النوع === "BANK")?.id ?? حسابات_الخزنة[0]?.id ?? ""));
  const [حساب_فرعي, تعيين_حساب_فرعي] = React.useState("");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);
  const نوع_الحساب = حسابات_الخزنة.find((a) => a.id === Number(حساب))?.النوع ?? null;
  const له_فرعية = نوع_الحساب !== null && نوع_الحساب !== "CASH";
  const خيارات_فرعية = له_فرعية && نوع_الحساب ? (حسابات_فرعية[نوع_الحساب] ?? []) : [];

  async function أكّد() {
    if (!حساب) return إشعار.خطأ("اختر حساب الإيداع");
    if (خيارات_فرعية.length > 0 && !حساب_فرعي) return إشعار.خطأ("اختر البنك/الحساب الفرعي");
    تعيين_جارٍ(true);
    await عند_التأكيد({ معرف_حساب_التحصيل: Number(حساب), معرف_حساب_فرعي: حساب_فرعي ? Number(حساب_فرعي) : null });
    تعيين_جارٍ(false);
  }

  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإلغاء()}>
      <محتوى_الحوار className="max-w-md">
        <رأس_الحوار>
          <عنوان_الحوار>إيداع الشيك في بنك</عنوان_الحوار>
        </رأس_الحوار>
        <p className="rounded-lg bg-appgray px-3 py-2 text-[12px] text-muted-foreground">
          قيمة الشيك <b><نص_مبلغ القيمة={الشيك.المبلغ} /></b> تُخصم من خزنة الشيكات وتُضاف إلى الحساب البنكي المختار.
        </p>
        <div className="space-y-3">
          <div className="space-y-1">
            <العنوان>حساب الإيداع</العنوان>
            <قائمة_اختيار
              قابل_للبحث={false}
              الخيارات={حسابات_الخزنة.map((a) => ({ القيمة: String(a.id), التسمية: a.التسمية }))}
              القيمة={حساب}
              عند_التغيير={(v) => { تعيين_حساب(v); تعيين_حساب_فرعي(""); }}
            />
          </div>
          {خيارات_فرعية.length > 0 && (
            <div className="space-y-1">
              <العنوان>البنك / الحساب الفرعي</العنوان>
              <قائمة_اختيار
                الخيارات={خيارات_فرعية.map((s) => ({ القيمة: String(s.id), التسمية: s.الاسم }))}
                القيمة={حساب_فرعي}
                عند_التغيير={تعيين_حساب_فرعي}
                نص_بديل="اختر…"
              />
            </div>
          )}
        </div>
        <تذييل_الحوار>
          <الزر variant="outline" onClick={عند_الإلغاء}>إلغاء</الزر>
          <الزر onClick={أكّد} disabled={جارٍ}>تأكيد الإيداع</الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}

/** حوار إلغاء شيك (v2) — يسجّل سبب الإلغاء ويعكس كل الأثر بدون حذف السجل. */
function حوار_إلغاء({
  الشيك, عند_الإلغاء, عند_التأكيد,
}: {
  الشيك: شيك;
  عند_الإلغاء: () => void;
  عند_التأكيد: (سبب: string) => void | Promise<void>;
}) {
  const إشعار = useإشعار();
  const [سبب, تعيين_سبب] = React.useState("");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);
  async function أكّد() {
    if (!سبب.trim()) return إشعار.خطأ("اكتب سبب الإلغاء");
    تعيين_جارٍ(true);
    await عند_التأكيد(سبب.trim());
    تعيين_جارٍ(false);
  }
  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإلغاء()}>
      <محتوى_الحوار className="max-w-md">
        <رأس_الحوار>
          <عنوان_الحوار>إلغاء الشيك</عنوان_الحوار>
        </رأس_الحوار>
        <p className="rounded-lg bg-danger-soft/40 px-3 py-2 text-[12px] text-danger">
          سيُعكَس أي أثر محاسبي للشيك (خزنة الشيكات/البنك/النقدي/مديونية الأطراف) ويُحفظ السجل مع سبب الإلغاء.
        </p>
        <div className="space-y-1">
          <العنوان مطلوب>سبب الإلغاء</العنوان>
          <منطقة_نص autoFocus value={سبب} onChange={(e) => تعيين_سبب(e.target.value)} rows={3} placeholder="مثال: خطأ في الإدخال / اتفاق مع العميل…" />
        </div>
        <تذييل_الحوار>
          <الزر variant="outline" onClick={عند_الإلغاء}>تراجع</الزر>
          <الزر variant="danger" onClick={أكّد} disabled={جارٍ}>تأكيد الإلغاء</الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}

/** حوار تفاصيل الشيك — عرض سريع (يُفتح من تنبيه المرتد أو أي مكان). */
function حوار_تفاصيل({
  الشيك, عند_الإغلاق, عند_التعديل, عند_إعادة_التسجيل, عند_التحويل_لعادي,
}: {
  الشيك: شيك;
  عند_الإغلاق: () => void;
  عند_التعديل: () => void;
  عند_إعادة_التسجيل: () => void | Promise<void>;
  عند_التحويل_لعادي: () => void | Promise<void>;
}) {
  const صف = (ع: string, ق: React.ReactNode) => (
    <div className="flex items-center justify-between gap-3 border-b border-border/60 py-2 text-sm last:border-0">
      <span className="text-muted-foreground">{ع}</span>
      <span className="text-left font-medium">{ق}</span>
    </div>
  );
  const وارد = الشيك.الاتجاه === "INCOMING";
  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإغلاق()}>
      <محتوى_الحوار className="max-w-lg">
        <رأس_الحوار>
          <عنوان_الحوار className="flex items-center gap-2">
            تفاصيل الشيك
            {الشيك.الحالة === "BOUNCED" && <الشارة variant="danger">مرتد</الشارة>}
            {الشيك.افتتاحي && <الشارة variant="warning">افتتاحي</الشارة>}
          </عنوان_الحوار>
        </رأس_الحوار>
        <div className="rounded-xl border border-border bg-appgray/40 px-4">
          {صف(وارد ? "العميل (محوّل من)" : "المستفيد", الشيك.اسم_الطرف || الشيك.محول_من || الشيك.المستفيد || الشيك.اسم_المدين || "—")}
          {صف("المبلغ", <نص_مبلغ القيمة={الشيك.المبلغ} className="text-danger" />)}
          {صف("الاتجاه", وارد ? "وارد (لك)" : "صادر (عليك)")}
          {صف("الحالة", <شارة_حالة الحالة={تسمية_حالة_الشيك[الشيك.الحالة]} متغيّر={لون_الحالة[الشيك.الحالة]} />)}
          {الشيك.اسم_المظهر_له && صف("رجع من المورد (كان مُظهَّراً له)", <span className="text-warning">{الشيك.اسم_المظهر_له}</span>)}
          {الشيك.اسم_البنك && صف("البنك", الشيك.اسم_البنك)}
          {الشيك.رقم_الشيك && صف("رقم الشيك", <span className="ltr-nums">{الشيك.رقم_الشيك}</span>)}
          {صف("تاريخ الاستحقاق", <نص_تاريخ القيمة={الشيك.تاريخ_الاستحقاق} />)}
          {الشيك.اسم_المدين && الشيك.اسم_المدين !== (الشيك.اسم_الطرف || الشيك.محول_من) && صف("اسم المدين", الشيك.اسم_المدين)}
          {الشيك.ملاحظات && صف("ملاحظات", الشيك.ملاحظات)}
        </div>

        <تذييل_الحوار className="flex-wrap">
          {الشيك.لها_صورة && (
            <a href={`/api/cheques/${الشيك.id}/image`} target="_blank" rel="noreferrer">
              <الزر variant="outline"><ImageIcon className="size-4" /> عرض الصورة</الزر>
            </a>
          )}
          {الشيك.الحالة === "BOUNCED" && (
            <الزر variant="success" onClick={عند_إعادة_التسجيل}>إعادة تسجيل الشيك</الزر>
          )}
          {الشيك.افتتاحي && الشيك.الاتجاه === "INCOMING" && (
            <الزر variant="blue" onClick={عند_التحويل_لعادي}>تحويل لشيك عادي (تسجيله بالحساب)</الزر>
          )}
          <الزر variant="outline" onClick={عند_التعديل}><Pencil className="size-4" /> تعديل</الزر>
          <الزر onClick={عند_الإغلاق}>إغلاق</الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}

type بند_خزنة = { key: number; حساب: string; حساب_فرعي: string; مبلغ: string };

function حوار_سداد_مركب({
  موردون,
  حسابات_الخزنة,
  حسابات_فرعية,
  شيكات_متاحة,
  عند_الإغلاق,
}: {
  موردون: طرف_شيك[];
  حسابات_الخزنة: { id: number; النوع: TreasuryAccountType; التسمية: string }[];
  حسابات_فرعية: خريطة_حسابات_فرعية;
  شيكات_متاحة: شيك[];
  عند_الإغلاق: () => void;
}) {
  const إشعار = useإشعار();
  const عداد = React.useRef(0);
  const بند_جديد = (): بند_خزنة => ({ key: ++عداد.current, حساب: String(حسابات_الخزنة[0]?.id ?? ""), حساب_فرعي: "", مبلغ: "" });
  const [مورد, تعيين_مورد] = React.useState("");
  const [بنود, تعيين_بنود] = React.useState<بند_خزنة[]>([]);
  const [شيكات_مختارة, تعيين_شيكات_مختارة] = React.useState<Set<number>>(new Set());
  const [بحث_شيكات, تعيين_بحث_شيكات] = React.useState("");
  const [بيان, تعيين_بيان] = React.useState("");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  const شيكات_معروضة = React.useMemo(() => {
    const ك = طبّع_بحث(بحث_شيكات);
    if (!ك) return شيكات_متاحة;
    return شيكات_متاحة.filter((c) => {
      const يوم = c.تاريخ_الاستحقاق?.slice(0, 10) ?? "";
      const يوم_معكوس = يوم ? يوم.split("-").reverse().join("/") : ""; // dd/mm/yyyy للبحث
      return [c.اسم_الطرف, c.محول_من, c.اسم_المدين, c.المستفيد, c.رقم_الشيك, c.اسم_البنك, String(c.المبلغ), يوم, يوم_معكوس]
        .some((v) => طبّع_بحث(v).includes(ك));
    });
  }, [شيكات_متاحة, بحث_شيكات]);

  const مجموع_خزنة = بنود.reduce((س, ب) => س + (Number(ب.مبلغ.replace(/,/g, "")) || 0), 0);
  const مجموع_شيكات = شيكات_متاحة.filter((c) => شيكات_مختارة.has(c.id)).reduce((س, c) => س + c.المبلغ, 0);
  const الإجمالي = مجموع_خزنة + مجموع_شيكات;

  function حدّث_بند(key: number, ت: Partial<بند_خزنة>) {
    تعيين_بنود((س) => س.map((ب) => (ب.key === key ? { ...ب, ...ت } : ب)));
  }
  function نوع_حساب(id: string) { return حسابات_الخزنة.find((a) => a.id === Number(id))?.النوع ?? null; }

  async function حفظ() {
    if (!مورد) return إشعار.خطأ("اختر المورد");
    if (الإجمالي <= 0) return إشعار.خطأ("أضف وسيلة دفع واحدة على الأقل");
    for (const ب of بنود) {
      const ن = نوع_حساب(ب.حساب);
      if (ن && ن !== "CASH" && (حسابات_فرعية[ن]?.length ?? 0) > 0 && !ب.حساب_فرعي) return إشعار.خطأ("اختر الحساب الفرعي لكل بند");
    }
    تعيين_جارٍ(true);
    const r = await سداد_مركب_لمورد({
      معرف_المورد: Number(مورد),
      البيان: بيان || null,
      بنود_خزنة: بنود.filter((ب) => Number(ب.مبلغ.replace(/,/g, "")) > 0).map((ب) => ({
        معرف_الحساب: Number(ب.حساب),
        معرف_حساب_فرعي: ب.حساب_فرعي ? Number(ب.حساب_فرعي) : null,
        المبلغ: ب.مبلغ.replace(/,/g, ""),
      })),
      شيكات: [...شيكات_مختارة],
    });
    تعيين_جارٍ(false);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    إشعار.نجاح(r.رسالة!);
    عند_الإغلاق();
  }

  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإغلاق()}>
      <محتوى_الحوار className="max-w-xl">
        <رأس_الحوار>
          <عنوان_الحوار className="flex items-center gap-2"><Layers className="size-5 text-primary" /> سداد مركب لمورد</عنوان_الحوار>
        </رأس_الحوار>
        <p className="rounded-lg bg-appgray px-3 py-2 text-[12px] text-muted-foreground">
          ادفع للمورد بوسائل متعددة في عملية واحدة: نقدي/تحويل من الخزنة + شيكات واردة تُظهَّر له. الإجمالي يُخصم من مديونية المورد مرة واحدة.
        </p>
        <div className="space-y-1.5">
          <العنوان مطلوب>المورد</العنوان>
          <قائمة_اختيار الخيارات={موردون.map((s) => ({ القيمة: String(s.id), التسمية: s.الاسم }))} القيمة={مورد} عند_التغيير={تعيين_مورد} نص_بديل="اختر المورد…" />
        </div>

        {/* بنود الخزنة */}
        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <العنوان className="mb-0">نقدي / تحويل من الخزنة</العنوان>
            <الزر size="sm" variant="outline" onClick={() => تعيين_بنود((س) => [...س, بند_جديد()])}><Plus className="size-4" /> بند</الزر>
          </div>
          {بنود.map((ب) => {
            const ن = نوع_حساب(ب.حساب);
            const فرعية = ن && ن !== "CASH" ? (حسابات_فرعية[ن] ?? []) : [];
            return (
              <div key={ب.key} className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-2">
                <div className="flex-1 min-w-[110px] space-y-1"><span className="text-[11px] text-muted-foreground">الوسيلة</span>
                  <قائمة_اختيار قابل_للبحث={false} الخيارات={حسابات_الخزنة.map((a) => ({ القيمة: String(a.id), التسمية: a.التسمية }))} القيمة={ب.حساب} عند_التغيير={(v) => حدّث_بند(ب.key, { حساب: v, حساب_فرعي: "" })} />
                </div>
                {فرعية.length > 0 && (
                  <div className="flex-1 min-w-[110px] space-y-1"><span className="text-[11px] text-muted-foreground">الحساب الفرعي</span>
                    <قائمة_اختيار الخيارات={فرعية.map((s) => ({ القيمة: String(s.id), التسمية: s.الاسم }))} القيمة={ب.حساب_فرعي} عند_التغيير={(v) => حدّث_بند(ب.key, { حساب_فرعي: v })} نص_بديل="اختر…" />
                  </div>
                )}
                <div className="w-24 space-y-1"><span className="text-[11px] text-muted-foreground">المبلغ</span>
                  <الحقل selectOnFocus className="ltr-nums" value={ب.مبلغ} onChange={(e) => حدّث_بند(ب.key, { مبلغ: e.target.value })} placeholder="0.00" />
                </div>
                <الزر size="sm" variant="ghost" onClick={() => تعيين_بنود((س) => س.filter((x) => x.key !== ب.key))}><Trash2 className="size-4 text-danger" /></الزر>
              </div>
            );
          })}
        </div>

        {/* اختيار الشيكات الواردة */}
        {شيكات_متاحة.length > 0 && (
          <div className="mt-3 space-y-1.5">
            <div className="flex items-center justify-between">
              <العنوان className="mb-0">شيكات واردة للتظهير</العنوان>
              <span className="text-[11px] text-muted-foreground">{شيكات_مختارة.size ? `${شيكات_مختارة.size} مختار` : `${شيكات_متاحة.length} متاح`}</span>
            </div>
            <الحقل
              value={بحث_شيكات}
              onChange={(e) => تعيين_بحث_شيكات(e.target.value)}
              placeholder="ابحث بالاسم / رقم الشيك / البنك / المبلغ…"
              className="h-9"
            />
            <div className="max-h-44 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
              {شيكات_معروضة.length === 0 ? (
                <p className="py-3 text-center text-[12px] text-muted-foreground">لا توجد شيكات مطابقة للبحث.</p>
              ) : شيكات_معروضة.map((c) => (
                <label key={c.id} className="flex items-center justify-between gap-2 rounded px-2 py-1.5 hover:bg-appgray cursor-pointer text-sm">
                  <span className="flex items-center gap-2 min-w-0">
                    <input type="checkbox" className="size-4 shrink-0 accent-primary" checked={شيكات_مختارة.has(c.id)} onChange={(e) => تعيين_شيكات_مختارة((س) => { const n = new Set(س); e.target.checked ? n.add(c.id) : n.delete(c.id); return n; })} />
                    <span className="min-w-0">
                      <span className="font-medium">{c.اسم_الطرف || c.محول_من || c.اسم_المدين || "—"}</span>
                      {c.اسم_المدين && c.اسم_المدين !== (c.اسم_الطرف || c.محول_من) && <span className="mr-1.5 text-[11px] text-muted-foreground">· مدين: {c.اسم_المدين}</span>}
                      {c.رقم_الشيك && <span className="mr-1.5 text-[11px] text-muted-foreground ltr-nums">#{c.رقم_الشيك}</span>}
                      {c.اسم_البنك && <span className="mr-1.5 text-[11px] text-muted-foreground">· {c.اسم_البنك}</span>}
                    </span>
                  </span>
                  <span className="flex shrink-0 items-center gap-2.5">
                    <span className={`inline-flex items-center gap-1 text-[11px] ${c.متأخر ? "font-medium text-danger" : "text-muted-foreground"}`}>
                      <CalendarClock className="size-3" />
                      <نص_تاريخ القيمة={c.تاريخ_الاستحقاق} />
                    </span>
                    <نص_مبلغ القيمة={c.المبلغ} />
                  </span>
                </label>
              ))}
            </div>
          </div>
        )}

        <div className="mt-3 rounded-lg bg-appgray p-3 flex items-center justify-between">
          <span className="text-sm">خزنة: <span className="font-medium"><نص_مبلغ القيمة={مجموع_خزنة} /></span> + شيكات: <span className="font-medium"><نص_مبلغ القيمة={مجموع_شيكات} /></span></span>
          <span className="text-sm font-bold text-primary">الإجمالي: <نص_مبلغ القيمة={الإجمالي} /></span>
        </div>

        <div className="space-y-1.5 mt-3">
          <العنوان>بيان (اختياري)</العنوان>
          <الحقل value={بيان} onChange={(e) => تعيين_بيان(e.target.value)} placeholder="يُملأ تلقائياً" />
        </div>

        <تذييل_الحوار>
          <الزر variant="success" onClick={حفظ} disabled={جارٍ || الإجمالي <= 0 || !مورد}>{جارٍ ? "جارٍ الحفظ…" : "تأكيد السداد"}</الزر>
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
