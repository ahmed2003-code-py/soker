"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Wallet, Plus, Pencil, Trash2, AlertTriangle, ArrowUp, ArrowDown, ChevronDown, Check, X } from "lucide-react";
import { TreasuryAccountType, TxnKind } from "@prisma/client";
import { الزر } from "@/components/ui/button";
import { الحقل } from "@/components/ui/input";
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
import { useإشعار } from "@/components/ui/toast";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";
import { فلتر_فترة } from "@/components/date-filter";
import { منتقي_تاريخ } from "@/components/date-picker";
import { أيقونة_الحساب } from "@/components/account-icon";
import { لقطة_الأرصدة } from "./balance-snapshot";
import { تسجيل_حركة, تعديل_حركة_خزنة, حذف_حركة_خزنة, حذف_حركات_خزنة_متعددة } from "./actions";
import { أنشئ_حساب_فرعي, عدّل_حساب_فرعي, احذف_حساب_فرعي, type خريطة_حسابات_فرعية, type حساب_فرعي } from "./sub-account-actions";

type حساب = {
  id: number;
  النوع: TreasuryAccountType;
  التسمية: string;
  الرصيد: number;
  الحد_الأدنى: number | null;
};
type حركة = {
  id: number;
  التاريخ: string;
  النوع: TxnKind;
  المبلغ: number;
  معرف_الحساب: number;
  الحساب: string;
  البيان: string;
  الطرف: string | null;
  الرصيد_بعد_الحركة: number;
  معرف_حساب_فرعي: number | null;
  اسم_حساب_فرعي: string | null;
  معرف_الطرف: number | null;
  مرتبط: boolean;
  أنشأ_بواسطة: string;
};

const اليوم = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });

/** تسمية الحساب الفرعي حسب نوع الحساب */
function تسمية_فرعي(النوع: TreasuryAccountType): string {
  if (النوع === "VODAFONE") return "المحفظة";
  if (النوع === "INSTAPAY") return "حساب إنستا";
  if (النوع === "BANK") return "البنك";
  return "الحساب الفرعي";
}

export function شاشة_الخزنة({
  الحسابات,
  الحركات,
  الأطراف,
  حسابات_فرعية,
}: {
  الحسابات: حساب[];
  الحركات: حركة[];
  الأطراف: { id: number; name: string }[];
  حسابات_فرعية: خريطة_حسابات_فرعية;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t, لغة } = استخدام_اللغة();
  const [نموذج, تعيين_نموذج] = React.useState<{ حركة?: حركة } | null>(null);
  const [حذف, تعيين_حذف] = React.useState<حركة | null>(null);
  const [فلتر_حساب, تعيين_فلتر_حساب] = React.useState("");
  const [فلتر_نوع, تعيين_فلتر_نوع] = React.useState("");
  const [من, تعيين_من] = React.useState("");
  const [إلى, تعيين_إلى] = React.useState("");
  const [تفاصيل_حساب, تعيين_تفاصيل_حساب] = React.useState<حساب | null>(null);

  // حسابات فرعية محلية — تتزامن مع الخادم بعد كل router.refresh()
  const [حسابات_فرعية_محلية, تعيين_حسابات_فرعية_محلية] = React.useState<خريطة_حسابات_فرعية>(حسابات_فرعية);
  React.useEffect(() => {
    تعيين_حسابات_فرعية_محلية(حسابات_فرعية);
  }, [حسابات_فرعية]);

  // Multi-select
  const [محددة, تعيين_محددة] = React.useState<Set<number>>(new Set());
  const [حذف_جماعي, تعيين_حذف_جماعي] = React.useState(false);

  const الإجمالي = الحسابات.reduce((س, ح) => س + ح.الرصيد, 0);

  const مفلتر_فترة = !!(من || إلى);
  const بالفترة = الحركات.filter((ح) => {
    const d = ح.التاريخ.slice(0, 10);
    if (من && d < من) return false;
    if (إلى && d > إلى) return false;
    return true;
  });
  function ملخص_حساب(معرف: number) {
    let إيراد = 0, مصروف = 0;
    for (const ح of بالفترة)
      if (ح.معرف_الحساب === معرف) {
        if (ح.النوع === "INCOME") إيراد += ح.المبلغ; else مصروف += ح.المبلغ;
      }
    return { إيراد, مصروف, صافي: إيراد - مصروف };
  }
  const صافي_الفترة_الكلي = بالفترة.reduce((س, ح) => س + (ح.النوع === "INCOME" ? ح.المبلغ : -ح.المبلغ), 0);

  const حركات_مصفّاة = الحركات.filter((ح) => {
    if (فلتر_حساب && ح.معرف_الحساب !== Number(فلتر_حساب)) return false;
    if (فلتر_نوع && ح.النوع !== فلتر_نوع) return false;
    const d = ح.التاريخ.slice(0, 10);
    if (من && d < من) return false;
    if (إلى && d > إلى) return false;
    return true;
  });

  const حساب_بالمعرف = React.useMemo(() => {
    const m = new Map<number, حساب>();
    for (const ح of الحسابات) m.set(ح.id, ح);
    return m;
  }, [الحسابات]);

  /**
   * Balance snapshots: computed by starting from the CURRENT actual balances
   * and working BACKWARDS through transactions (newest → oldest).
   * This avoids the bug where starting from 0 gives wrong values if accounts
   * were seeded with initial balances outside the transaction history.
   */
  const لقطات = React.useMemo(() => {
    const جارٍ: Record<number, number> = {};
    for (const ح of الحسابات) جارٍ[ح.id] = ح.الرصيد;

    // Sort newest first
    const ترتيب = [...الحركات].sort((a, b) =>
      a.التاريخ === b.التاريخ ? b.id - a.id : a.التاريخ > b.التاريخ ? -1 : 1
    );

    const map = new Map<number, { أرصدة: { النوع: TreasuryAccountType; التسمية: string; رصيد: number }[]; إجمالي: number }>();
    for (const t of ترتيب) {
      // Capture snapshot BEFORE reversing — this is "balances after this transaction"
      const أرصدة = الحسابات.map((ح) => ({ النوع: ح.النوع, التسمية: ح.التسمية, رصيد: جارٍ[ح.id] ?? 0 }));
      map.set(t.id, { أرصدة, إجمالي: أرصدة.reduce((س, a) => س + a.رصيد, 0) });
      // Reverse this transaction to recover the state before it happened
      جارٍ[t.معرف_الحساب] = (جارٍ[t.معرف_الحساب] ?? 0) - (t.النوع === "INCOME" ? t.المبلغ : -t.المبلغ);
    }
    return map;
  }, [الحركات, الحسابات]);

  // Multi-select helpers
  const كل_محدد = حركات_مصفّاة.length > 0 && محددة.size === حركات_مصفّاة.length;
  function تبديل_تحديد(id: number) {
    تعيين_محددة((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }
  function تحديد_الكل() {
    if (كل_محدد) تعيين_محددة(new Set());
    else تعيين_محددة(new Set(حركات_مصفّاة.map((ح) => ح.id)));
  }

  const أعمدة: عمود<حركة>[] = [
    {
      المفتاح: "_select",
      العنوان: (
        <input
          type="checkbox"
          checked={كل_محدد}
          onChange={تحديد_الكل}
          className="size-4 cursor-pointer"
          title="تحديد الكل"
        />
      ) as unknown as string,
      خلية: (ص) => (
        <input
          type="checkbox"
          checked={محددة.has(ص.id)}
          onChange={() => تبديل_تحديد(ص.id)}
          className="size-4 cursor-pointer"
        />
      ),
    },
    {
      المفتاح: "التاريخ",
      العنوان: t("common.date"),
      خلية: (ص) => <نص_تاريخ القيمة={ص.التاريخ} />,
      قيمة: (ص) => ص.التاريخ,
      قابل_للفرز: true,
    },
    {
      المفتاح: "النوع",
      العنوان: t("treasury.col.type"),
      خلية: (ص) => (
        <شارة_حالة
          الحالة={ص.النوع === "INCOME" ? t("treasury.income") : t("treasury.expense")}
          متغيّر={ص.النوع === "INCOME" ? "success" : "danger"}
        />
      ),
    },
    {
      المفتاح: "الحساب",
      العنوان: t("treasury.col.account"),
      خلية: (ص) => {
        const ح = حساب_بالمعرف.get(ص.معرف_الحساب);
        return (
          <span className="flex items-center gap-2">
            {ح && <أيقونة_الحساب النوع={ح.النوع} حجم="sm" />}
            <span className="flex flex-col leading-tight">
              <span>{ص.الحساب}</span>
              {ص.اسم_حساب_فرعي && (
                <span className="text-[11px] text-muted-foreground">{ص.اسم_حساب_فرعي}</span>
              )}
            </span>
          </span>
        );
      },
    },
    {
      المفتاح: "البيان",
      العنوان: t("ledger.col.statement"),
      خلية: (ص) => (
        <div>
          <div>{ص.البيان}</div>
          <div className="text-[10px] text-muted-foreground">{ص.أنشأ_بواسطة}</div>
        </div>
      ),
    },
    {
      المفتاح: "الطرف",
      العنوان: t("treasury.col.party"),
      خلية: (ص) => ص.الطرف || "—",
      مخفي_موبايل: true,
    },
    {
      المفتاح: "المبلغ",
      العنوان: t("pay.amount"),
      محاذاة: "end",
      قيمة: (ص) => ص.المبلغ,
      قابل_للفرز: true,
      خلية: (ص) => (
        <نص_مبلغ القيمة={ص.المبلغ} النوع={ص.النوع === "INCOME" ? "إيراد" : "مصروف"} مع_العملة={false} />
      ),
    },
    {
      المفتاح: "الرصيد_بعد_الحركة",
      العنوان: t("ledger.col.balance_after"),
      محاذاة: "end",
      خلية: (ص) => {
        const ح = حساب_بالمعرف.get(ص.معرف_الحساب);
        const لقطة = لقطات.get(ص.id);
        const صعود = ص.النوع === "INCOME";
        const قبل = ص.الرصيد_بعد_الحركة + (صعود ? -ص.المبلغ : ص.المبلغ);
        const محتوى = (
          <span className="inline-flex items-center justify-end gap-1.5">
            {ح && <أيقونة_الحساب النوع={ح.النوع} حجم="sm" />}
            <span className="text-end">
              <span className={`flex items-center justify-end gap-0.5 font-semibold ${صعود ? "text-success" : "text-danger"}`}>
                {صعود ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />}
                <نص_مبلغ القيمة={ص.الرصيد_بعد_الحركة} مع_العملة={false} className={صعود ? "text-success" : "text-danger"} />
              </span>
              <span className="block text-[10px] text-muted-foreground ltr-nums">
                {قبل.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
              </span>
            </span>
          </span>
        );
        return لقطة ? (
          <لقطة_الأرصدة أرصدة={لقطة.أرصدة} إجمالي={لقطة.إجمالي}>{محتوى}</لقطة_الأرصدة>
        ) : (
          محتوى
        );
      },
      مخفي_موبايل: true,
    },
  ];

  async function إضافة_حساب_فرعي_جديد(النوع: TreasuryAccountType, الاسم: string): Promise<number | null> {
    const r = await أنشئ_حساب_فرعي(النوع, الاسم);
    if (!r.نجاح || !r.بيانات) return null;
    تعيين_حسابات_فرعية_محلية((prev) => ({
      ...prev,
      [النوع]: [...(prev[النوع] ?? []), { id: r.بيانات!.id, الاسم, الرصيد: 0 }],
    }));
    return r.بيانات.id;
  }

  function تحديث_اسم_فرعي(النوع: TreasuryAccountType, id: number, الاسم_الجديد: string) {
    تعيين_حسابات_فرعية_محلية((prev) => ({
      ...prev,
      [النوع]: (prev[النوع] ?? []).map((h) => h.id === id ? { ...h, الاسم: الاسم_الجديد } : h),
    }));
  }

  function حذف_فرعي_محلي(النوع: TreasuryAccountType, id: number) {
    تعيين_حسابات_فرعية_محلية((prev) => ({
      ...prev,
      [النوع]: (prev[النوع] ?? []).filter((h) => h.id !== id),
    }));
  }

  return (
    <div className="space-y-6">
      {/* البطاقات */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {الحسابات.map((ح) => {
          const تحت_الحد = !مفلتر_فترة && ح.الحد_الأدنى != null && ح.الرصيد < ح.الحد_الأدنى;
          const ملخص = مفلتر_فترة ? ملخص_حساب(ح.id) : null;
          const قيمة = ملخص ? ملخص.صافي : ح.الرصيد;
          const له_فرعية = ح.النوع !== "CASH" && (حسابات_فرعية_محلية[ح.النوع]?.length ?? 0) > 0;
          return (
            <div
              key={ح.id}
              className={`card-soft p-5 ${له_فرعية ? "card-hover cursor-pointer" : ""}`}
              onClick={له_فرعية ? () => تعيين_تفاصيل_حساب(ح) : undefined}
            >
              <div className="flex items-start justify-between">
                <p className="text-sm text-muted-foreground">{ح.التسمية}</p>
                <div className="flex items-center gap-1">
                  {له_فرعية && <ChevronDown className="size-3.5 text-muted-foreground" />}
                  <أيقونة_الحساب النوع={ح.النوع} />
                </div>
              </div>
              <div className={`mt-2 text-xl font-bold ${قيمة < 0 ? "text-danger" : "text-foreground"}`}>
                <نص_مبلغ القيمة={قيمة} />
              </div>
              {ملخص ? (
                <p className="mt-1 flex flex-wrap gap-x-2 text-[11px] text-muted-foreground">
                  <span className="text-success">▲ {ملخص.إيراد.toLocaleString("en-US")}</span>
                  <span className="text-danger">▼ {ملخص.مصروف.toLocaleString("en-US")}</span>
                </p>
              ) : تحت_الحد ? (
                <p className="mt-1 flex items-center gap-1 text-xs text-warning">
                  <AlertTriangle className="size-3.5" /> {t("dash.under_threshold")}
                </p>
              ) : له_فرعية ? (
                <p className="mt-1 text-[11px] text-muted-foreground">
                  {حسابات_فرعية_محلية[ح.النوع]?.length} {ح.النوع === "BANK" ? "بنك" : "حساب"}
                </p>
              ) : null}
            </div>
          );
        })}
        <div className="card-soft card-hover border-primary/30 bg-primary/5 p-5">
          <div className="flex items-start justify-between">
            <p className="text-sm text-muted-foreground">
              {مفلتر_فترة ? (لغة === "ar" ? "صافي الفترة" : "Period net") : t("treasury.total")}
            </p>
            <span className="rounded-xl bg-primary/10 p-2 text-primary">
              <Wallet className="size-5" />
            </span>
          </div>
          <div className={`mt-2 text-xl font-bold ${مفلتر_فترة && صافي_الفترة_الكلي < 0 ? "text-danger" : "text-primary"}`}>
            <نص_مبلغ القيمة={مفلتر_فترة ? صافي_الفترة_الكلي : الإجمالي} />
          </div>
        </div>
      </div>

      {/* أدوات */}
      <div className="flex flex-wrap items-end gap-3">
        <الزر onClick={() => تعيين_نموذج({})}>
          <Plus className="size-4" /> {t("treasury.record")}
        </الزر>
        {محددة.size > 0 && (
          <الزر variant="danger" size="sm" onClick={() => تعيين_حذف_جماعي(true)}>
            <Trash2 className="size-4" /> حذف المحدد ({محددة.size})
          </الزر>
        )}
        <div className="min-w-40 space-y-1.5">
          <العنوان>{t("treasury.filter_account")}</العنوان>
          <قائمة_اختيار
            الخيارات={[
              { القيمة: "", التسمية: t("treasury.all_accounts") },
              ...الحسابات.map((h) => ({ القيمة: String(h.id), التسمية: h.التسمية })),
            ]}
            القيمة={فلتر_حساب}
            عند_التغيير={تعيين_فلتر_حساب}
            قابل_للبحث={false}
          />
        </div>
        <div className="min-w-40 space-y-1.5">
          <العنوان>{t("treasury.filter_type")}</العنوان>
          <قائمة_اختيار
            الخيارات={[
              { القيمة: "", التسمية: t("common.all") },
              { القيمة: "INCOME", التسمية: t("treasury.income") },
              { القيمة: "EXPENSE", التسمية: t("treasury.expense") },
            ]}
            القيمة={فلتر_نوع}
            عند_التغيير={تعيين_فلتر_نوع}
            قابل_للبحث={false}
          />
        </div>
        <فلتر_فترة
          من={من}
          إلى={إلى}
          عند_التغيير={(م, ن) => { تعيين_من(م); تعيين_إلى(ن); }}
          className="w-full border-t border-border pt-3 lg:w-auto lg:border-0 lg:pt-0"
        />
      </div>

      <جدول_بيانات
        الأعمدة={أعمدة}
        البيانات={حركات_مصفّاة}
        مفتاح_الصف={(ص) => ص.id}
        رسالة_فراغ={t("treasury.empty")}
        إجراءات_الصف={(ص) => (
          <div className="flex items-center justify-end gap-1">
            {ص.مرتبط && <الشارة variant="navy">{t("ledger.linked")}</الشارة>}
            {محددة.size <= 1 && (
              <الزر size="sm" variant="ghost" onClick={() => تعيين_نموذج({ حركة: ص })}>
                <Pencil className="size-4" />
              </الزر>
            )}
            <الزر size="sm" variant="ghost" onClick={() => تعيين_حذف(ص)}>
              <Trash2 className="size-4 text-danger" />
            </الزر>
          </div>
        )}
      />

      {نموذج && (
        <حوار_حركة
          الحركة={نموذج.حركة}
          الحسابات={الحسابات}
          الأطراف={الأطراف}
          حسابات_فرعية={حسابات_فرعية_محلية}
          عند_إضافة_فرعي={إضافة_حساب_فرعي_جديد}
          عند_الإغلاق={() => تعيين_نموذج(null)}
        />
      )}
      {حذف && (
        <حوار_تأكيد
          مفتوح
          عند_التغيير={(o) => !o && تعيين_حذف(null)}
          العنوان={t("ledger.delete_title")}
          الوصف={t("treasury.delete_desc")}
          عند_التأكيد={async () => {
            const r = await حذف_حركة_خزنة(حذف.id);
            r.نجاح ? إشعار.نجاح(r.رسالة!) : إشعار.خطأ(r.رسالة);
            if (r.نجاح) {
              تعيين_محددة((prev) => { const next = new Set(prev); next.delete(حذف.id); return next; });
              router.refresh();
            }
          }}
        />
      )}
      {حذف_جماعي && (
        <حوار_تأكيد
          مفتوح
          عند_التغيير={(o) => !o && تعيين_حذف_جماعي(false)}
          العنوان={`حذف ${محددة.size} حركة`}
          الوصف="سيُعاد حساب أرصدة الخزنة وأي أطراف مرتبطة. لا يمكن التراجع."
          عند_التأكيد={async () => {
            const r = await حذف_حركات_خزنة_متعددة([...محددة]);
            r.نجاح ? إشعار.نجاح(r.رسالة!) : إشعار.خطأ(r.رسالة);
            if (r.نجاح) {
              تعيين_محددة(new Set());
              router.refresh();
            }
          }}
        />
      )}

      {/* بوب أب تفاصيل الحسابات الفرعية */}
      {تفاصيل_حساب && (
        <حوار_تفاصيل_حساب
          الحساب={تفاصيل_حساب}
          الحسابات_الفرعية={حسابات_فرعية_محلية[تفاصيل_حساب.النوع] ?? []}
          عند_إضافة_فرعي={async (الاسم) => { await إضافة_حساب_فرعي_جديد(تفاصيل_حساب.النوع, الاسم); }}
          عند_تعديل_فرعي={(id, الاسم) => تحديث_اسم_فرعي(تفاصيل_حساب.النوع, id, الاسم)}
          عند_حذف_فرعي={(id) => حذف_فرعي_محلي(تفاصيل_حساب.النوع, id)}
          عند_الإغلاق={() => تعيين_تفاصيل_حساب(null)}
        />
      )}
    </div>
  );
}

// ─── حوار تفاصيل + إدارة الحسابات الفرعية ──────────────────────────────────

function حوار_تفاصيل_حساب({
  الحساب,
  الحسابات_الفرعية,
  عند_إضافة_فرعي,
  عند_تعديل_فرعي,
  عند_حذف_فرعي,
  عند_الإغلاق,
}: {
  الحساب: حساب;
  الحسابات_الفرعية: حساب_فرعي[];
  عند_إضافة_فرعي: (الاسم: string) => Promise<void>;
  عند_تعديل_فرعي: (id: number, الاسم: string) => void;
  عند_حذف_فرعي: (id: number) => void;
  عند_الإغلاق: () => void;
}) {
  const إشعار = useإشعار();
  const [تعديل_معرف, تعيين_تعديل_معرف] = React.useState<number | null>(null);
  const [اسم_جديد, تعيين_اسم_جديد] = React.useState("");
  const [حذف_معرف, تعيين_حذف_معرف] = React.useState<number | null>(null);
  const [إضافة_جارية, تعيين_إضافة_جارية] = React.useState(false);
  const [اسم_إضافة, تعيين_اسم_إضافة] = React.useState("");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  const إجمالي = الحسابات_الفرعية.reduce((س, ح) => س + ح.الرصيد, 0);

  async function احفظ_التعديل(id: number) {
    if (!اسم_جديد.trim()) return;
    تعيين_جارٍ(true);
    const r = await عدّل_حساب_فرعي(id, اسم_جديد);
    تعيين_جارٍ(false);
    if (!r.نجاح) { إشعار.خطأ(r.رسالة); return; }
    إشعار.نجاح(r.رسالة!);
    عند_تعديل_فرعي(id, اسم_جديد.trim());
    تعيين_تعديل_معرف(null);
  }

  async function نفّذ_الحذف(id: number) {
    تعيين_جارٍ(true);
    const r = await احذف_حساب_فرعي(id);
    تعيين_جارٍ(false);
    if (!r.نجاح) { إشعار.خطأ(r.رسالة); return; }
    إشعار.نجاح(r.رسالة!);
    عند_حذف_فرعي(id);
    تعيين_حذف_معرف(null);
  }

  async function أضف_جديد() {
    if (!اسم_إضافة.trim()) return;
    تعيين_جارٍ(true);
    await عند_إضافة_فرعي(اسم_إضافة.trim());
    تعيين_جارٍ(false);
    تعيين_اسم_إضافة("");
    تعيين_إضافة_جارية(false);
  }

  return (
    <>
      <الحوار open onOpenChange={(o) => !o && عند_الإغلاق()}>
        <محتوى_الحوار className="max-w-sm">
          <رأس_الحوار>
            <عنوان_الحوار>تفاصيل {الحساب.التسمية}</عنوان_الحوار>
          </رأس_الحوار>
          <div className="divide-y divide-border rounded-xl border border-border overflow-hidden">
            {الحسابات_الفرعية.length === 0 && !إضافة_جارية ? (
              <p className="px-4 py-6 text-center text-sm text-muted-foreground">لا توجد حسابات فرعية</p>
            ) : (
              الحسابات_الفرعية.map((ح) => (
                <div key={ح.id} className="flex items-center gap-2 px-4 py-3">
                  {تعديل_معرف === ح.id ? (
                    <>
                      <input
                        autoFocus
                        className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
                        value={اسم_جديد}
                        onChange={(e) => تعيين_اسم_جديد(e.target.value)}
                        onKeyDown={(e) => { if (e.key === "Enter") احفظ_التعديل(ح.id); if (e.key === "Escape") تعيين_تعديل_معرف(null); }}
                      />
                      <button type="button" disabled={جارٍ} onClick={() => احفظ_التعديل(ح.id)} className="text-success hover:opacity-75">
                        <Check className="size-4" />
                      </button>
                      <button type="button" onClick={() => تعيين_تعديل_معرف(null)} className="text-muted-foreground hover:opacity-75">
                        <X className="size-4" />
                      </button>
                    </>
                  ) : (
                    <>
                      <span className="flex-1 text-sm font-medium">{ح.الاسم}</span>
                      <نص_مبلغ القيمة={ح.الرصيد} className={`text-sm ${ح.الرصيد < 0 ? "text-danger font-semibold" : "font-semibold"}`} />
                      <button type="button" onClick={() => { تعيين_تعديل_معرف(ح.id); تعيين_اسم_جديد(ح.الاسم); }} className="text-muted-foreground hover:text-foreground">
                        <Pencil className="size-3.5" />
                      </button>
                      <button type="button" onClick={() => تعيين_حذف_معرف(ح.id)} className="text-muted-foreground hover:text-danger">
                        <Trash2 className="size-3.5" />
                      </button>
                    </>
                  )}
                </div>
              ))
            )}
            {إضافة_جارية && (
              <div className="flex items-center gap-2 px-4 py-3">
                <input
                  autoFocus
                  placeholder="اسم الحساب الجديد…"
                  className="flex-1 rounded-md border border-border bg-background px-2 py-1 text-sm outline-none focus:ring-1 focus:ring-primary"
                  value={اسم_إضافة}
                  onChange={(e) => تعيين_اسم_إضافة(e.target.value)}
                  onKeyDown={(e) => { if (e.key === "Enter") أضف_جديد(); if (e.key === "Escape") { تعيين_إضافة_جارية(false); تعيين_اسم_إضافة(""); } }}
                />
                <button type="button" disabled={جارٍ} onClick={أضف_جديد} className="text-success hover:opacity-75">
                  <Check className="size-4" />
                </button>
                <button type="button" onClick={() => { تعيين_إضافة_جارية(false); تعيين_اسم_إضافة(""); }} className="text-muted-foreground hover:opacity-75">
                  <X className="size-4" />
                </button>
              </div>
            )}
            <div className="flex items-center justify-between bg-appgray px-4 py-3">
              <span className="text-sm font-semibold text-muted-foreground">الإجمالي</span>
              <نص_مبلغ القيمة={إجمالي} className="font-bold text-primary" />
            </div>
          </div>
          <تذييل_الحوار>
            {!إضافة_جارية && (
              <الزر variant="outline" size="sm" onClick={() => تعيين_إضافة_جارية(true)}>
                <Plus className="size-3.5 ml-1" /> إضافة
              </الزر>
            )}
            <الزر variant="outline" onClick={عند_الإغلاق}>إغلاق</الزر>
          </تذييل_الحوار>
        </محتوى_الحوار>
      </الحوار>

      {حذف_معرف !== null && (
        <حوار_تأكيد
          مفتوح
          عند_التغيير={(o) => !o && تعيين_حذف_معرف(null)}
          العنوان="حذف الحساب الفرعي"
          الوصف="سيتم حذف الحساب نهائياً. الحركات المرتبطة به ستفقد ربطها."
          عند_التأكيد={() => نفّذ_الحذف(حذف_معرف)}
        />
      )}
    </>
  );
}

// ─── حوار إضافة/تعديل حركة ───────────────────────────────────────────────────

function حوار_حركة({
  الحركة,
  الحسابات,
  الأطراف,
  حسابات_فرعية,
  عند_إضافة_فرعي,
  عند_الإغلاق,
}: {
  الحركة?: حركة;
  الحسابات: حساب[];
  الأطراف: { id: number; name: string }[];
  حسابات_فرعية: خريطة_حسابات_فرعية;
  عند_إضافة_فرعي: (النوع: TreasuryAccountType, الاسم: string) => Promise<number | null>;
  عند_الإغلاق: () => void;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t } = استخدام_اللغة();

  // الحساب الأول هو النقدي (بعد الترتيب)
  const الأول = الحسابات[0];
  const [تاريخ, تعيين_تاريخ] = React.useState(الحركة ? الحركة.التاريخ.slice(0, 10) : اليوم());
  const [نوع, تعيين_نوع] = React.useState<TxnKind>(الحركة?.النوع ?? "INCOME");
  const [مبلغ, تعيين_مبلغ] = React.useState(الحركة ? String(الحركة.المبلغ) : "");
  const [حساب, تعيين_حساب] = React.useState<string>(
    String(الحركة?.معرف_الحساب ?? الأول?.id ?? "")
  );
  const [حساب_فرعي, تعيين_حساب_فرعي] = React.useState<string>(
    الحركة?.معرف_حساب_فرعي ? String(الحركة.معرف_حساب_فرعي) : ""
  );
  const [بيان, تعيين_بيان] = React.useState(الحركة?.البيان ?? "");
  const [نوع_الطرف, تعيين_نوع_الطرف] = React.useState<"customer" | "external">(
    الحركة?.مرتبط ? "customer" : (الحركة?.الطرف && !الحركة.مرتبط ? "external" : "customer")
  );
  const [طرف_عميل, تعيين_طرف_عميل] = React.useState<string>(
    الحركة?.معرف_الطرف ? String(الحركة.معرف_الطرف) : ""
  );
  const [طرف_خارجي, تعيين_طرف_خارجي] = React.useState(
    !الحركة?.مرتبط && الحركة?.الطرف ? الحركة.الطرف : ""
  );
  const [جارٍ, تعيين_جارٍ] = React.useState(false);
  const [خيارات_فرعية_محلية, تعيين_خيارات_فرعية_محلية] = React.useState<خريطة_حسابات_فرعية>(حسابات_فرعية);

  const نوع_الحساب_المختار = React.useMemo(
    () => الحسابات.find((h) => h.id === Number(حساب))?.النوع ?? null,
    [حساب, الحسابات]
  );
  const له_فرعية = نوع_الحساب_المختار !== null && نوع_الحساب_المختار !== "CASH";
  const خيارات_فرعية = له_فرعية && نوع_الحساب_المختار ? (خيارات_فرعية_محلية[نوع_الحساب_المختار] ?? []) : [];

  // تحديد تلقائي لو فيه خيار واحد بس
  React.useEffect(() => {
    if (له_فرعية && خيارات_فرعية.length === 1 && !حساب_فرعي) {
      تعيين_حساب_فرعي(String(خيارات_فرعية[0].id));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [له_فرعية, خيارات_فرعية.length]);

  function تغيير_الحساب(معرف: string) {
    const نوع_الجديد = الحسابات.find((h) => h.id === Number(معرف))?.النوع;
    const نوع_القديم = الحسابات.find((h) => h.id === Number(حساب))?.النوع;
    if (نوع_الجديد !== نوع_القديم) تعيين_حساب_فرعي("");
    تعيين_حساب(معرف);
  }

  async function إضافة_فرعي(الاسم: string) {
    if (!نوع_الحساب_المختار || نوع_الحساب_المختار === "CASH") return;
    const معرف = await عند_إضافة_فرعي(نوع_الحساب_المختار, الاسم);
    if (!معرف) return;
    تعيين_خيارات_فرعية_محلية((prev) => ({
      ...prev,
      [نوع_الحساب_المختار]: [
        ...(prev[نوع_الحساب_المختار] ?? []),
        { id: معرف, الاسم, الرصيد: 0 },
      ],
    }));
    تعيين_حساب_فرعي(String(معرف));
  }

  async function حفظ() {
    if (له_فرعية && !حساب_فرعي) {
      return إشعار.خطأ(`يرجى اختيار ${تسمية_فرعي(نوع_الحساب_المختار!)}`);
    }
    تعيين_جارٍ(true);
    const payload = {
      التاريخ: تاريخ,
      النوع: نوع,
      المبلغ: مبلغ,
      معرف_الحساب: Number(حساب),
      معرف_حساب_فرعي: حساب_فرعي ? Number(حساب_فرعي) : null,
      البيان: بيان,
      معرف_الطرف: نوع_الطرف === "customer" && طرف_عميل ? Number(طرف_عميل) : null,
      اسم_الطرف_الخارجي: نوع_الطرف === "external" && طرف_خارجي.trim() ? طرف_خارجي.trim() : null,
    };
    const r = الحركة
      ? await تعديل_حركة_خزنة(الحركة.id, payload)
      : await تسجيل_حركة(payload);
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
          <عنوان_الحوار>{الحركة ? t("treasury.dlg.edit") : t("treasury.dlg.add")}</عنوان_الحوار>
        </رأس_الحوار>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <العنوان مطلوب>{t("common.date")}</العنوان>
            <منتقي_تاريخ القيمة={تاريخ} عند_التغيير={تعيين_تاريخ} />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>{t("treasury.col.type")}</العنوان>
            <قائمة_اختيار
              الخيارات={[
                { القيمة: "INCOME", التسمية: t("treasury.income") },
                { القيمة: "EXPENSE", التسمية: t("treasury.expense") },
              ]}
              القيمة={نوع}
              عند_التغيير={(v) => تعيين_نوع(v as TxnKind)}
              قابل_للبحث={false}
            />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>{t("pay.amount")}</العنوان>
            <الحقل autoFocus selectOnFocus value={مبلغ} onChange={(e) => تعيين_مبلغ(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>{t("treasury.col.account")}</العنوان>
            <قائمة_اختيار
              الخيارات={الحسابات.map((h) => ({ القيمة: String(h.id), التسمية: h.التسمية }))}
              القيمة={حساب}
              عند_التغيير={تغيير_الحساب}
              قابل_للبحث={false}
            />
          </div>

          {/* الحساب الفرعي — إجباري لغير النقدي */}
          {له_فرعية && نوع_الحساب_المختار && (
            <div className="space-y-1.5 sm:col-span-2">
              <العنوان مطلوب>{تسمية_فرعي(نوع_الحساب_المختار)}</العنوان>
              <قائمة_اختيار
                الخيارات={خيارات_فرعية.map((s) => ({ القيمة: String(s.id), التسمية: s.الاسم }))}
                القيمة={حساب_فرعي}
                عند_التغيير={تعيين_حساب_فرعي}
                عند_الإضافة={إضافة_فرعي}
                تسمية_الإضافة={`إضافة ${تسمية_فرعي(نوع_الحساب_المختار)}`}
                نص_بديل={`اختر ${تسمية_فرعي(نوع_الحساب_المختار)}…`}
              />
            </div>
          )}

          <div className="space-y-1.5 sm:col-span-2">
            <العنوان مطلوب>{t("ledger.col.statement")}</العنوان>
            <الحقل value={بيان} onChange={(e) => تعيين_بيان(e.target.value)} />
          </div>

          {/* الطرف: عميل مسجّل أو اسم خارجي */}
          <div className="sm:col-span-2 space-y-2">
            <div className="flex items-center gap-2">
              <العنوان className="mb-0">{t("treasury.f.party_opt")}</العنوان>
              <div className="flex rounded-lg border border-border overflow-hidden text-sm">
                <button
                  type="button"
                  className={`px-3 py-1 transition-colors ${نوع_الطرف === "customer" ? "bg-primary text-white" : "hover:bg-muted"}`}
                  onClick={() => { تعيين_نوع_الطرف("customer"); تعيين_طرف_خارجي(""); }}
                >
                  {t("treasury.f.party_customer")}
                </button>
                <button
                  type="button"
                  className={`px-3 py-1 transition-colors ${نوع_الطرف === "external" ? "bg-primary text-white" : "hover:bg-muted"}`}
                  onClick={() => { تعيين_نوع_الطرف("external"); تعيين_طرف_عميل(""); }}
                >
                  {t("treasury.f.party_external")}
                </button>
              </div>
            </div>
            {نوع_الطرف === "customer" ? (
              <قائمة_اختيار
                الخيارات={[
                  { القيمة: "", التسمية: t("common.none") },
                  ...الأطراف.map((p) => ({ القيمة: String(p.id), التسمية: p.name })),
                ]}
                القيمة={طرف_عميل}
                عند_التغيير={تعيين_طرف_عميل}
              />
            ) : (
              <الحقل
                placeholder={t("treasury.f.party_name")}
                value={طرف_خارجي}
                onChange={(e) => تعيين_طرف_خارجي(e.target.value)}
              />
            )}
          </div>
        </div>

        {/* معلومات المسؤول (عرض فقط في وضع التعديل) */}
        {الحركة && (
          <p className="mt-3 rounded-lg bg-appgray px-3 py-2 text-[11px] text-muted-foreground">
            أُضيف بواسطة: <span className="font-medium text-foreground">{الحركة.أنشأ_بواسطة}</span>
          </p>
        )}

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
