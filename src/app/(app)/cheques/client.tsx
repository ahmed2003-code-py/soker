"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Image as ImageIcon, ChevronDown, Wallet, Layers } from "lucide-react";
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
import { إنشاء_شيك, تعديل_شيك, تغيير_حالة_شيك, حذف_شيك, أضف_دفعة_تسوية, احذف_دفعة_تسوية, اجلب_دفعات_التسوية, سداد_مركب_لمورد } from "./actions";
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
  ملاحظات: string | null;
  لها_صورة: boolean;
  متأخر: boolean;
};

export type طرف_شيك = { id: number; الاسم: string; النوع: "CUSTOMER" | "SUPPLIER" };

export function شاشة_الشيكات({
  البيانات,
  بنوك,
  الأطراف,
  حساب_نقدي,
  حساب_بنك,
  حسابات_الخزنة,
  حسابات_فرعية,
}: {
  البيانات: شيك[];
  بنوك: { id: number; الاسم: string }[];
  الأطراف: طرف_شيك[];
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
          <شارة_حالة الحالة={تسمية_حالة_الشيك[ص.الحالة]} متغيّر={لون_الحالة[ص.الحالة]} />
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
            الخيارات={
              ص.الحالة === "SETTLED"
                ? [{ القيمة: "SETTLED", التسمية: تسمية_حالة_الشيك.SETTLED }, { القيمة: "CANCELLED", التسمية: تسمية_حالة_الشيك.CANCELLED }]
                : خيارات_الحالة
            }
            القيمة={ص.الحالة}
            قابل_للبحث={false}
            عند_التغيير={async (v) => {
              const حالة_جديدة = v as ChequeStatus;
              // التحصيل الفعلي → حوار اختيار حساب التحصيل (نقدي/بنك)
              if (حالة_جديدة === "COLLECTED" && ص.الحالة !== "COLLECTED") {
                تعيين_تحصيل_شيك(ص);
                return;
              }
              // التظهير لمورد → حوار اختيار المورد
              if (حالة_جديدة === "ENDORSED" && ص.الحالة !== "ENDORSED") {
                تعيين_تظهير_شيك(ص);
                return;
              }
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

  return (
    <div className="space-y-4">
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
  عند_الإغلاق,
}: {
  شيك?: شيك;
  اتجاه_افتراضي?: ChequeDirection;
  الأطراف?: طرف_شيك[];
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
    الحالة: (شيك?.الحالة ?? "PENDING") as ChequeStatus,
    ملاحظات: شيك?.ملاحظات ?? "",
  });
  const [معرف_الطرف, تعيين_معرف_الطرف] = React.useState<string>(
    شيك?.معرف_الطرف ? String(شيك.معرف_الطرف) : ""
  );
  const [صورة, تعيين_صورة] = React.useState<{ base64: string; mime: string; نص?: string } | null>(null);
  const [جارٍ, تعيين_جارٍ] = React.useState(false);
  const حدّث = (ك: string, v: string) => تعيين((س) => ({ ...س, [ك]: v }));

  // الأطراف حسب الاتجاه: وارد → عملاء، صادر → موردون
  const أطراف_مناسبة = الأطراف.filter((p) =>
    ق.الاتجاه === "INCOMING" ? p.النوع === "CUSTOMER" : p.النوع === "SUPPLIER"
  );

  async function احفظ() {
    تعيين_جارٍ(true);
    const payload = {
      ...ق,
      معرف_الطرف: معرف_الطرف ? Number(معرف_الطرف) : null,
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

        {/* اختيار الاتجاه */}
        <div className="flex items-center gap-2 rounded-lg border border-border bg-appgray p-3">
          <span className="text-sm text-muted-foreground">{t("cheque.col.direction")}</span>
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            {(["INCOMING", "OUTGOING"] as ChequeDirection[]).map((dir) => (
              <button
                key={dir}
                type="button"
                className={`px-4 py-1.5 transition-colors ${ق.الاتجاه === dir ? "bg-primary text-white" : "bg-white hover:bg-muted"}`}
                onClick={() => حدّث("الاتجاه", dir)}
              >
                {dir === "INCOMING" ? t("cheque.tab.incoming") : t("cheque.tab.outgoing")}
              </button>
            ))}
          </div>
        </div>

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
            عند_المسح={() => تعيين_صورة(null)}
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
            <منتقي_تاريخ القيمة={ق.تاريخ_الاستحقاق} عند_التغيير={(v) => حدّث("تاريخ_الاستحقاق", v)} />
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
          <div className="space-y-1.5">
            <العنوان>{ق.الاتجاه === "INCOMING" ? "العميل (اختياري)" : "المورد (اختياري)"}</العنوان>
            <قائمة_اختيار
              الخيارات={[
                { القيمة: "", التسمية: "— بدون —" },
                ...أطراف_مناسبة.map((p) => ({ القيمة: String(p.id), التسمية: p.الاسم })),
              ]}
              القيمة={معرف_الطرف}
              عند_التغيير={تعيين_معرف_الطرف}
              نص_بديل={ق.الاتجاه === "INCOMING" ? "اربط بعميل…" : "اربط بمورد…"}
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
  const [بيانات, تعيين_بيانات] = React.useState<{ الإجمالي: number; المُسدَّد: number; الدفعات: { id: number; المبلغ: number; الطريقة: string | null; التاريخ: string; البيان: string }[] } | null>(null);
  const [مبلغ, تعيين_مبلغ] = React.useState("");
  const [حساب, تعيين_حساب] = React.useState(String(حسابات_الخزنة[0]?.id ?? ""));
  const [حساب_فرعي, تعيين_حساب_فرعي] = React.useState("");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  const نوع_الحساب = حسابات_الخزنة.find((a) => a.id === Number(حساب))?.النوع ?? null;
  const له_فرعية = نوع_الحساب !== null && نوع_الحساب !== "CASH";
  const خيارات_فرعية = له_فرعية && نوع_الحساب ? (حسابات_فرعية[نوع_الحساب] ?? []) : [];

  async function حمّل() {
    const r = await اجلب_دفعات_التسوية(الشيك.id);
    if (r.نجاح && r.بيانات) تعيين_بيانات(r.بيانات);
  }
  React.useEffect(() => { حمّل(); /* eslint-disable-next-line */ }, []);

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
              <div key={د.id} className="flex items-center justify-between rounded-lg border border-border px-3 py-1.5 text-sm">
                <span className="flex items-center gap-2"><نص_مبلغ القيمة={د.المبلغ} /> <span className="text-[11px] text-muted-foreground">{د.الطريقة ?? ""}</span></span>
                <span className="flex items-center gap-2"><نص_تاريخ القيمة={د.التاريخ} className="text-[11px] text-muted-foreground" />
                  <الزر size="sm" variant="ghost" onClick={() => احذف(د.id)} title="حذف الدفعة"><Trash2 className="size-4 text-danger" /></الزر>
                </span>
              </div>
            ))}
          </div>
        )}

        {/* إضافة دفعة */}
        {متبقٍ > 0.005 && (
          <div className="mt-2 rounded-lg border border-border p-3 space-y-2">
            <العنوان>إضافة دفعة</العنوان>
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
          </div>
        )}

        <تذييل_الحوار>
          <الزر variant="outline" onClick={عند_الإغلاق}>إغلاق</الزر>
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
  const [بيان, تعيين_بيان] = React.useState("");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

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
            <العنوان className="mb-0">شيكات واردة للتظهير</العنوان>
            <div className="max-h-40 overflow-y-auto space-y-1 rounded-lg border border-border p-2">
              {شيكات_متاحة.map((c) => (
                <label key={c.id} className="flex items-center justify-between gap-2 rounded px-2 py-1 hover:bg-appgray cursor-pointer text-sm">
                  <span className="flex items-center gap-2">
                    <input type="checkbox" className="size-4 accent-primary" checked={شيكات_مختارة.has(c.id)} onChange={(e) => تعيين_شيكات_مختارة((س) => { const n = new Set(س); e.target.checked ? n.add(c.id) : n.delete(c.id); return n; })} />
                    <span>{c.اسم_المدين}{c.رقم_الشيك ? ` — ${c.رقم_الشيك}` : ""}</span>
                  </span>
                  <نص_مبلغ القيمة={c.المبلغ} />
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
