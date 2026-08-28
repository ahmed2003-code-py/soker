"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Wallet, Plus, Pencil, Trash2, AlertTriangle, ArrowUp, ArrowDown, ChevronDown, Check, X, ArrowLeftRight, Send, Layers } from "lucide-react";
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
import { اجلب_بنود_شهر_للاختيار, افحص_تجاوز_المصروف, عدّل_مبلغ_الشهر } from "@/app/(app)/monthly-expenses/actions";
import { تسجيل_حركة, تعديل_حركة_خزنة, حذف_حركة_خزنة, حذف_حركات_خزنة_متعددة, تحويل_بين_الخزائن, دفع_مباشر_من_عميل_لمورد, تعديل_دفع_مباشر_من_خزنة } from "./actions";
import { سجل_دفعة_موزعة } from "@/app/(app)/_parties/actions";
import { أنشئ_حساب_فرعي, عدّل_حساب_فرعي, احذف_حساب_فرعي, type خريطة_حسابات_فرعية, type حساب_فرعي } from "./sub-account-actions";
import { استخدم_تراجع_الحذف } from "@/hooks/use-undo-delete";

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
  معرف_دفع_مباشر: number | null;
  معرف_بند_مصروف_شهري?: number | null;
  بند_مصروف_شهري?: string | null; // اسم البند (للعرض في الجدول)
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
  الأطراف: { id: number; name: string; type: "CUSTOMER" | "SUPPLIER" }[];
  حسابات_فرعية: خريطة_حسابات_فرعية;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t, لغة } = استخدام_اللغة();
  const [نموذج, تعيين_نموذج] = React.useState<{ حركة?: حركة } | null>(null);
  const [نموذج_تحويل, تعيين_نموذج_تحويل] = React.useState(false);
  const [نموذج_دفع_مباشر, تعيين_نموذج_دفع_مباشر] = React.useState(false);
  const [نموذج_دفعة_موزعة, تعيين_نموذج_دفعة_موزعة] = React.useState(false);
  const { احذف: احذف_مع_تراجع, معلقة } = استخدم_تراجع_الحذف();
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
  const [تعديل_دفع, تعيين_تعديل_دفع] = React.useState<حركة | null>(null);

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
    if (معلقة.has(ح.id)) return false;
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
          <div className="flex flex-wrap items-center gap-1.5">
            <span>{ص.البيان}</span>
            {ص.بند_مصروف_شهري && (
              <span
                title="مخصوم من ميزانية بند مصروف شهري"
                className="rounded border border-primary-blue/40 bg-primary-blue/10 px-1.5 py-0.5 text-[10px] font-medium text-primary-blue"
              >
                {ص.بند_مصروف_شهري}
              </span>
            )}
          </div>
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
        <الزر variant="outline" onClick={() => تعيين_نموذج_تحويل(true)}>
          <ArrowLeftRight className="size-4" /> تحويل بين الخزائن
        </الزر>
        <الزر variant="outline" onClick={() => تعيين_نموذج_دفع_مباشر(true)}>
          <Send className="size-4" /> دفع مباشر
        </الزر>
        <الزر variant="outline" onClick={() => تعيين_نموذج_دفعة_موزعة(true)}>
          <Layers className="size-4" /> معاملة مركبة
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
            {ص.معرف_دفع_مباشر != null ? (
              <>
                <span className="text-[10px] text-muted-foreground bg-appgray rounded px-1">دفع مباشر</span>
                {محددة.size <= 1 && (
                  <الزر size="sm" variant="ghost" onClick={() => تعيين_تعديل_دفع(ص)} title="تعديل الدفع المباشر">
                    <Pencil className="size-4 text-primary" />
                  </الزر>
                )}
                <الزر
                  size="sm"
                  variant="ghost"
                  onClick={() => احذف_مع_تراجع(ص.id, () => حذف_حركة_خزنة(ص.id))}
                  title="حذف وعكس من الكل"
                >
                  <Trash2 className="size-4 text-danger" />
                </الزر>
              </>
            ) : (
              <>
                {ص.مرتبط && <الشارة variant="navy">{t("ledger.linked")}</الشارة>}
                {محددة.size <= 1 && (
                  <الزر size="sm" variant="ghost" onClick={() => تعيين_نموذج({ حركة: ص })}>
                    <Pencil className="size-4" />
                  </الزر>
                )}
                <الزر
                  size="sm"
                  variant="ghost"
                  onClick={() => احذف_مع_تراجع(ص.id, () => حذف_حركة_خزنة(ص.id))}
                >
                  <Trash2 className="size-4 text-danger" />
                </الزر>
              </>
            )}
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
      {نموذج_تحويل && (
        <حوار_تحويل_خزنة
          الحسابات={الحسابات}
          حسابات_فرعية={حسابات_فرعية_محلية}
          عند_الإغلاق={() => تعيين_نموذج_تحويل(false)}
        />
      )}
      {نموذج_دفع_مباشر && (
        <حوار_دفع_مباشر
          الأطراف={الأطراف}
          الحسابات={الحسابات}
          عند_الإغلاق={() => تعيين_نموذج_دفع_مباشر(false)}
        />
      )}
      {نموذج_دفعة_موزعة && (
        <حوار_دفعة_موزعة_خزنة
          الأطراف={الأطراف}
          الحسابات={الحسابات}
          حسابات_فرعية={حسابات_فرعية_محلية}
          عند_الإغلاق={() => تعيين_نموذج_دفعة_موزعة(false)}
        />
      )}
      {تعديل_دفع && (
        <حوار_تعديل_دفع_مباشر_خزنة
          الحركة={تعديل_دفع}
          الحسابات={الحسابات}
          عند_الإغلاق={() => تعيين_تعديل_دفع(null)}
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

// ─── حوار تحويل بين الخزائن ─────────────────────────────────────────────────

function حوار_تحويل_خزنة({
  الحسابات,
  حسابات_فرعية,
  عند_الإغلاق,
}: {
  الحسابات: حساب[];
  حسابات_فرعية: خريطة_حسابات_فرعية;
  عند_الإغلاق: () => void;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const [تاريخ, تعيين_تاريخ] = React.useState(اليوم());
  const [مبلغ, تعيين_مبلغ] = React.useState("");
  const [من, تعيين_من] = React.useState(String(الحسابات[0]?.id ?? ""));
  const [إلى, تعيين_إلى] = React.useState(String(الحسابات[1]?.id ?? ""));
  const [فرعي_من, تعيين_فرعي_من] = React.useState("");
  const [فرعي_إلى, تعيين_فرعي_إلى] = React.useState("");
  const [بيان, تعيين_بيان] = React.useState("");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  const خيارات = الحسابات.map((h) => ({ القيمة: String(h.id), التسمية: h.التسمية }));

  const نوع_من = الحسابات.find((h) => String(h.id) === من)?.النوع;
  const نوع_إلى = الحسابات.find((h) => String(h.id) === إلى)?.النوع;
  const فروع_من = نوع_من ? (حسابات_فرعية[نوع_من] ?? []) : [];
  const فروع_إلى = نوع_إلى ? (حسابات_فرعية[نوع_إلى] ?? []) : [];

  function غيّر_من(v: string) {
    تعيين_من(v);
    تعيين_فرعي_من("");
  }
  function غيّر_إلى(v: string) {
    تعيين_إلى(v);
    تعيين_فرعي_إلى("");
  }

  async function حفظ() {
    تعيين_جارٍ(true);
    const r = await تحويل_بين_الخزائن({
      التاريخ: تاريخ,
      المبلغ: مبلغ,
      من_الحساب: Number(من),
      إلى_الحساب: Number(إلى),
      معرف_حساب_فرعي_من: فرعي_من ? Number(فرعي_من) : null,
      معرف_حساب_فرعي_إلى: فرعي_إلى ? Number(فرعي_إلى) : null,
      البيان: بيان || undefined,
    });
    تعيين_جارٍ(false);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    إشعار.نجاح(r.رسالة!);
    عند_الإغلاق();
    router.refresh();
  }

  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإغلاق()}>
      <محتوى_الحوار className="max-w-md">
        <رأس_الحوار>
          <عنوان_الحوار className="flex items-center gap-2">
            <ArrowLeftRight className="size-5 text-primary" /> تحويل بين الخزائن
          </عنوان_الحوار>
        </رأس_الحوار>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <العنوان مطلوب>التاريخ</العنوان>
            <منتقي_تاريخ القيمة={تاريخ} عند_التغيير={تعيين_تاريخ} />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>المبلغ</العنوان>
            <الحقل autoFocus selectOnFocus value={مبلغ} onChange={(e) => تعيين_مبلغ(e.target.value)} placeholder="0.00" />
          </div>

          {/* ── من ── */}
          <div className="space-y-1.5">
            <العنوان مطلوب>من حساب</العنوان>
            <قائمة_اختيار الخيارات={خيارات} القيمة={من} عند_التغيير={غيّر_من} قابل_للبحث={false} />
          </div>
          <div className="space-y-1.5">
            {فروع_من.length > 0 ? (
              <>
                <العنوان مطلوب>من محفظة / حساب</العنوان>
                <قائمة_اختيار
                  الخيارات={فروع_من.map((s) => ({ القيمة: String(s.id), التسمية: s.الاسم }))}
                  القيمة={فرعي_من}
                  عند_التغيير={تعيين_فرعي_من}
                  نص_بديل="اختر…"
                />
              </>
            ) : (
              <div />
            )}
          </div>

          {/* ── إلى ── */}
          <div className="space-y-1.5">
            <العنوان مطلوب>إلى حساب</العنوان>
            <قائمة_اختيار الخيارات={خيارات} القيمة={إلى} عند_التغيير={غيّر_إلى} قابل_للبحث={false} />
          </div>
          <div className="space-y-1.5">
            {فروع_إلى.length > 0 ? (
              <>
                <العنوان مطلوب>إلى محفظة / حساب</العنوان>
                <قائمة_اختيار
                  الخيارات={فروع_إلى.map((s) => ({ القيمة: String(s.id), التسمية: s.الاسم }))}
                  القيمة={فرعي_إلى}
                  عند_التغيير={تعيين_فرعي_إلى}
                  نص_بديل="اختر…"
                />
              </>
            ) : (
              <div />
            )}
          </div>

          <div className="space-y-1.5 sm:col-span-2">
            <العنوان>بيان (اختياري)</العنوان>
            <الحقل value={بيان} onChange={(e) => تعيين_بيان(e.target.value)} placeholder="يُملأ تلقائيًا إذا تُرك فارغًا" />
          </div>
        </div>
        <تذييل_الحوار>
          <الزر variant="success" onClick={حفظ} disabled={جارٍ}>
            {جارٍ ? "جارٍ التحويل…" : "تأكيد التحويل"}
          </الزر>
          <الزر variant="outline" onClick={عند_الإغلاق}>إلغاء</الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}

// ─── حوار دفع مباشر من عميل إلى مورد ────────────────────────────────────────

function حوار_دفع_مباشر({
  الأطراف,
  الحسابات,
  عند_الإغلاق,
}: {
  الأطراف: { id: number; name: string; type: "CUSTOMER" | "SUPPLIER" }[];
  الحسابات: حساب[];
  عند_الإغلاق: () => void;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const العملاء = الأطراف.filter((p) => p.type === "CUSTOMER");
  const الموردون = الأطراف.filter((p) => p.type === "SUPPLIER");
  const [تاريخ, تعيين_تاريخ] = React.useState(اليوم());
  const [مبلغ, تعيين_مبلغ] = React.useState("");
  const [نوع_العميل, تعيين_نوع_العميل] = React.useState<"registered" | "external">("registered");
  const [عميل, تعيين_عميل] = React.useState("");
  const [عميل_خارجي, تعيين_عميل_خارجي] = React.useState("");
  const [مورد, تعيين_مورد] = React.useState("");
  const [حساب, تعيين_حساب] = React.useState(String(الحسابات[0]?.id ?? ""));
  const [بيان, تعيين_بيان] = React.useState("");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  async function حفظ() {
    if (!حساب) return إشعار.خطأ("اختر حساب الخزنة");
    if (نوع_العميل === "registered" && !عميل) return إشعار.خطأ("اختر العميل");
    if (نوع_العميل === "external" && !عميل_خارجي.trim()) return إشعار.خطأ("اكتب اسم العميل");
    if (!مورد) return إشعار.خطأ("اختر المورد");
    تعيين_جارٍ(true);
    const r = await دفع_مباشر_من_عميل_لمورد({
      التاريخ: تاريخ,
      المبلغ: مبلغ,
      معرف_العميل: نوع_العميل === "registered" && عميل ? Number(عميل) : null,
      اسم_العميل_الخارجي: نوع_العميل === "external" && عميل_خارجي.trim() ? عميل_خارجي.trim() : null,
      معرف_المورد: Number(مورد),
      معرف_الحساب: Number(حساب),
      البيان: بيان || undefined,
    });
    تعيين_جارٍ(false);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    إشعار.نجاح(r.رسالة!);
    عند_الإغلاق();
    router.refresh();
  }

  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإغلاق()}>
      <محتوى_الحوار className="max-w-md">
        <رأس_الحوار>
          <عنوان_الحوار className="flex items-center gap-2">
            <Send className="size-5 text-primary" /> دفع مباشر من عميل إلى مورد
          </عنوان_الحوار>
        </رأس_الحوار>
        <p className="rounded-lg bg-appgray px-3 py-2 text-[12px] text-muted-foreground mb-1">
          يقلّل مديونية العميل (لو مسجّل) ويقلّل المستحق للمورد، وتُسجَّل حركة في الخزنة بلا تأثير على رصيدها — كل ذلك في عملية واحدة مرتبطة.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <العنوان مطلوب>التاريخ</العنوان>
            <منتقي_تاريخ القيمة={تاريخ} عند_التغيير={تعيين_تاريخ} />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>المبلغ</العنوان>
            <الحقل autoFocus selectOnFocus value={مبلغ} onChange={(e) => تعيين_مبلغ(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <العنوان مطلوب className="mb-0">العميل (المُدفِع)</العنوان>
              <div className="flex rounded-lg border border-border overflow-hidden text-[11px]">
                <button
                  type="button"
                  className={`px-2 py-0.5 transition-colors ${نوع_العميل === "registered" ? "bg-primary text-white" : "hover:bg-muted"}`}
                  onClick={() => { تعيين_نوع_العميل("registered"); تعيين_عميل_خارجي(""); }}
                >
                  مسجّل
                </button>
                <button
                  type="button"
                  className={`px-2 py-0.5 transition-colors ${نوع_العميل === "external" ? "bg-primary text-white" : "hover:bg-muted"}`}
                  onClick={() => { تعيين_نوع_العميل("external"); تعيين_عميل(""); }}
                >
                  عابر
                </button>
              </div>
            </div>
            {نوع_العميل === "registered" ? (
              <قائمة_اختيار
                الخيارات={العملاء.map((p) => ({ القيمة: String(p.id), التسمية: p.name }))}
                القيمة={عميل}
                عند_التغيير={تعيين_عميل}
                نص_بديل="اختر العميل…"
              />
            ) : (
              <الحقل
                placeholder="اسم العميل العابر…"
                value={عميل_خارجي}
                onChange={(e) => تعيين_عميل_خارجي(e.target.value)}
              />
            )}
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>المورد (المُستلِم)</العنوان>
            <قائمة_اختيار
              الخيارات={الموردون.map((p) => ({ القيمة: String(p.id), التسمية: p.name }))}
              القيمة={مورد}
              عند_التغيير={تعيين_مورد}
              نص_بديل="اختر المورد…"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <العنوان مطلوب>حساب الخزنة</العنوان>
            <قائمة_اختيار
              الخيارات={الحسابات.map((a) => ({ القيمة: String(a.id), التسمية: a.التسمية }))}
              القيمة={حساب}
              عند_التغيير={تعيين_حساب}
              قابل_للبحث={false}
              نص_بديل="اختر الحساب…"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <العنوان>بيان (اختياري)</العنوان>
            <الحقل value={بيان} onChange={(e) => تعيين_بيان(e.target.value)} placeholder="يُملأ تلقائيًا إذا تُرك فارغًا" />
          </div>
        </div>
        <تذييل_الحوار>
          <الزر variant="success" onClick={حفظ} disabled={جارٍ}>
            {جارٍ ? "جارٍ التسجيل…" : "تأكيد الدفع المباشر"}
          </الزر>
          <الزر variant="outline" onClick={عند_الإغلاق}>إلغاء</الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}

// ─── حوار معاملة مركبة (طرف + إجمالي موزّع على عدة حسابات) ───────────────────
type بند_مركّب = { معرف_محلي: number; حساب: string; حساب_فرعي: string; مبلغ: string };

function حوار_دفعة_موزعة_خزنة({
  الأطراف,
  الحسابات,
  حسابات_فرعية,
  عند_الإغلاق,
}: {
  الأطراف: { id: number; name: string; type: "CUSTOMER" | "SUPPLIER" }[];
  الحسابات: حساب[];
  حسابات_فرعية: خريطة_حسابات_فرعية;
  عند_الإغلاق: () => void;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const عداد = React.useRef(0);
  const بند_جديد = React.useCallback((): بند_مركّب => ({
    معرف_محلي: ++عداد.current,
    حساب: الحسابات[0] ? String(الحسابات[0].id) : "",
    حساب_فرعي: "",
    مبلغ: "",
  }), [الحسابات]);

  const [نوع, تعيين_نوع] = React.useState<"INCOME" | "EXPENSE">("INCOME");
  const [نوع_الطرف, تعيين_نوع_الطرف] = React.useState<"registered" | "external" | "none">("registered");
  const [طرف, تعيين_طرف] = React.useState("");
  const [طرف_خارجي, تعيين_طرف_خارجي] = React.useState("");
  const [تاريخ, تعيين_تاريخ] = React.useState(اليوم());
  const [بيان, تعيين_بيان] = React.useState("");
  const [بنود, تعيين_بنود] = React.useState<بند_مركّب[]>(() => [بند_جديد()]);
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  const مجموع = بنود.reduce((س, ب) => س + (Number(ب.مبلغ.replace(/,/g, "")) || 0), 0);
  const صالح = مجموع > 0 && (نوع_الطرف !== "registered" || !!طرف) && (نوع_الطرف !== "external" || !!طرف_خارجي.trim());

  function حدّث_بند(معرف_محلي: number, تعديل: Partial<بند_مركّب>) {
    تعيين_بنود((س) => س.map((ب) => (ب.معرف_محلي === معرف_محلي ? { ...ب, ...تعديل } : ب)));
  }
  function نوع_حساب(معرف: string) {
    return الحسابات.find((h) => h.id === Number(معرف))?.النوع ?? null;
  }

  async function حفظ() {
    if (نوع_الطرف === "registered" && !طرف) return إشعار.خطأ("اختر العميل أو المورد");
    if (نوع_الطرف === "external" && !طرف_خارجي.trim()) return إشعار.خطأ("اكتب اسم الطرف");
    if (مجموع <= 0) return إشعار.خطأ("أدخل مبلغاً في بند واحد على الأقل");
    for (const ب of بنود) {
      const ن = نوع_حساب(ب.حساب);
      if (ن && ن !== "CASH") {
        const خيارات = حسابات_فرعية[ن] ?? [];
        if (خيارات.length > 0 && !ب.حساب_فرعي) {
          return إشعار.خطأ(`اختر ${تسمية_فرعي(ن)} لكل بند من نوعه`);
        }
      }
    }
    تعيين_جارٍ(true);
    const r = await سجل_دفعة_موزعة({
      معرف_الطرف: نوع_الطرف === "registered" && طرف ? Number(طرف) : null,
      اسم_الطرف_الخارجي: نوع_الطرف === "external" && طرف_خارجي.trim() ? طرف_خارجي.trim() : null,
      النوع: نوع,
      التاريخ: تاريخ,
      الإجمالي: String(مجموع),
      البيان: بيان || null,
      بنود: بنود.map((ب) => ({
        معرف_الحساب: Number(ب.حساب),
        معرف_حساب_فرعي: ب.حساب_فرعي ? Number(ب.حساب_فرعي) : null,
        المبلغ: ب.مبلغ.replace(/,/g, ""),
      })),
    });
    تعيين_جارٍ(false);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    إشعار.نجاح(r.رسالة!);
    عند_الإغلاق();
    router.refresh();
  }

  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإغلاق()}>
      <محتوى_الحوار className="max-w-lg">
        <رأس_الحوار>
          <عنوان_الحوار className="flex items-center gap-2">
            <Layers className="size-5 text-primary" /> معاملة مركبة
          </عنوان_الحوار>
        </رأس_الحوار>
        <p className="rounded-lg bg-appgray px-3 py-2 text-[12px] text-muted-foreground mb-1">
          وزّع مبلغاً على أكثر من حساب خزنة في عملية واحدة. لو اخترت طرفاً مسجّلاً يُخصم الإجمالي مرة واحدة من حسابه، وتُسجَّل حركة مستقلة في كل خزنة.
        </p>

        {/* النوع: إيراد (له) / مصروف (عليه) */}
        <div className="flex items-center gap-2 mb-3">
          <العنوان className="mb-0">النوع</العنوان>
          <div className="flex rounded-lg border border-border overflow-hidden text-sm">
            <button
              type="button"
              className={`px-3 py-1 transition-colors ${نوع === "INCOME" ? "bg-success text-white" : "hover:bg-muted"}`}
              onClick={() => تعيين_نوع("INCOME")}
            >
              إيراد (له)
            </button>
            <button
              type="button"
              className={`px-3 py-1 transition-colors ${نوع === "EXPENSE" ? "bg-danger text-white" : "hover:bg-muted"}`}
              onClick={() => تعيين_نوع("EXPENSE")}
            >
              مصروف (عليه)
            </button>
          </div>
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <العنوان className="mb-0">الطرف</العنوان>
              <div className="flex rounded-lg border border-border overflow-hidden text-[11px]">
                <button type="button" className={`px-2 py-0.5 transition-colors ${نوع_الطرف === "registered" ? "bg-primary text-white" : "hover:bg-muted"}`}
                  onClick={() => { تعيين_نوع_الطرف("registered"); تعيين_طرف_خارجي(""); }}>مسجّل</button>
                <button type="button" className={`px-2 py-0.5 transition-colors ${نوع_الطرف === "external" ? "bg-primary text-white" : "hover:bg-muted"}`}
                  onClick={() => { تعيين_نوع_الطرف("external"); تعيين_طرف(""); }}>خارجي</button>
                <button type="button" className={`px-2 py-0.5 transition-colors ${نوع_الطرف === "none" ? "bg-primary text-white" : "hover:bg-muted"}`}
                  onClick={() => { تعيين_نوع_الطرف("none"); تعيين_طرف(""); تعيين_طرف_خارجي(""); }}>بدون</button>
              </div>
            </div>
            {نوع_الطرف === "registered" ? (
              <قائمة_اختيار
                الخيارات={الأطراف.map((p) => ({
                  القيمة: String(p.id),
                  التسمية: `${p.name} (${p.type === "CUSTOMER" ? "عميل" : "مورد"})`,
                }))}
                القيمة={طرف}
                عند_التغيير={تعيين_طرف}
                نص_بديل="اختر العميل أو المورد…"
              />
            ) : نوع_الطرف === "external" ? (
              <الحقل value={طرف_خارجي} onChange={(e) => تعيين_طرف_خارجي(e.target.value)} placeholder="اسم الطرف…" />
            ) : (
              <p className="text-[12px] text-muted-foreground py-2">حركة خزنة فقط — بلا حساب طرف.</p>
            )}
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>التاريخ</العنوان>
            <منتقي_تاريخ القيمة={تاريخ} عند_التغيير={تعيين_تاريخ} />
          </div>
        </div>
        {نوع_الطرف === "registered" && طرف && (
          <p className="mt-1 text-[12px] text-muted-foreground">
            {نوع === "INCOME"
              ? "إيراد — يقلّل مديونية العميل / يزيد الدفعة المقدّمة، ويضيف لكل خزنة."
              : "مصروف — يُخصم من كل خزنة ويُسجَّل مديناً على حساب الطرف."}
          </p>
        )}

        <div className="mt-3 space-y-2">
          <div className="flex items-center justify-between">
            <العنوان className="mb-0">توزيع المبلغ على الحسابات</العنوان>
            <الزر size="sm" variant="outline" onClick={() => تعيين_بنود((س) => [...س, بند_جديد()])}>
              <Plus className="size-4" /> بند
            </الزر>
          </div>
          {بنود.map((ب) => {
            const نوع = نوع_حساب(ب.حساب);
            const خيارات_فرعية = نوع && نوع !== "CASH" ? (حسابات_فرعية[نوع] ?? []) : [];
            return (
              <div key={ب.معرف_محلي} className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-2">
                <div className="flex-1 min-w-[120px] space-y-1">
                  <span className="text-[11px] text-muted-foreground">الحساب</span>
                  <قائمة_اختيار
                    الخيارات={الحسابات.map((a) => ({ القيمة: String(a.id), التسمية: a.التسمية }))}
                    القيمة={ب.حساب}
                    عند_التغيير={(v) => حدّث_بند(ب.معرف_محلي, { حساب: v, حساب_فرعي: "" })}
                    قابل_للبحث={false}
                  />
                </div>
                {خيارات_فرعية.length > 0 && (
                  <div className="flex-1 min-w-[120px] space-y-1">
                    <span className="text-[11px] text-muted-foreground">{تسمية_فرعي(نوع!)}</span>
                    <قائمة_اختيار
                      الخيارات={خيارات_فرعية.map((s) => ({ القيمة: String(s.id), التسمية: s.الاسم }))}
                      القيمة={ب.حساب_فرعي}
                      عند_التغيير={(v) => حدّث_بند(ب.معرف_محلي, { حساب_فرعي: v })}
                      نص_بديل={`اختر ${تسمية_فرعي(نوع!)}…`}
                    />
                  </div>
                )}
                <div className="w-28 space-y-1">
                  <span className="text-[11px] text-muted-foreground">المبلغ</span>
                  <الحقل selectOnFocus className="ltr-nums" value={ب.مبلغ} onChange={(e) => حدّث_بند(ب.معرف_محلي, { مبلغ: e.target.value })} placeholder="0.00" />
                </div>
                {بنود.length > 1 && (
                  <الزر size="sm" variant="ghost" onClick={() => تعيين_بنود((س) => س.filter((x) => x.معرف_محلي !== ب.معرف_محلي))} title="حذف البند">
                    <Trash2 className="size-4 text-danger" />
                  </الزر>
                )}
              </div>
            );
          })}
        </div>

        <div className="mt-3 rounded-lg bg-appgray p-3 flex items-center justify-between">
          <span className="text-sm font-medium">الإجمالي (تلقائي)</span>
          <span className="text-lg font-bold text-primary"><نص_مبلغ القيمة={مجموع} /></span>
        </div>

        <div className="space-y-1.5 mt-3">
          <العنوان>بيان (اختياري)</العنوان>
          <الحقل value={بيان} onChange={(e) => تعيين_بيان(e.target.value)} placeholder="يُملأ تلقائياً إذا تُرك فارغاً" />
        </div>

        <تذييل_الحوار>
          <الزر variant="success" onClick={حفظ} disabled={جارٍ || !صالح}>
            {جارٍ ? "جارٍ الحفظ…" : "تأكيد المعاملة"}
          </الزر>
          <الزر variant="outline" onClick={عند_الإغلاق}>إلغاء</الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
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
  الأطراف: { id: number; name: string; type: "CUSTOMER" | "SUPPLIER" }[];
  حسابات_فرعية: خريطة_حسابات_فرعية;
  عند_إضافة_فرعي: (النوع: TreasuryAccountType, الاسم: string) => Promise<number | null>;
  عند_الإغلاق: () => void;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t } = استخدام_اللغة();

  // للإضافة الجديدة: النوع والحساب فاضيان (يختارهما المستخدم). التعديل يحتفظ بقيمه.
  const [تاريخ, تعيين_تاريخ] = React.useState(الحركة ? الحركة.التاريخ.slice(0, 10) : اليوم());
  // نوع العرض: إيراد / مصروف عادي / مصروف شهري (الأخير = مصروف + بند إجباري)
  const [نوع_العرض, تعيين_نوع_العرض] = React.useState<"INCOME" | "EXPENSE" | "MONTHLY" | "">(
    الحركة
      ? الحركة.معرف_بند_مصروف_شهري
        ? "MONTHLY"
        : الحركة.النوع === "INCOME"
        ? "INCOME"
        : "EXPENSE" // التحويلات ما بتتعدّلش من هنا
      : ""
  );
  const نوع: TxnKind | "" = نوع_العرض === "" ? "" : نوع_العرض === "INCOME" ? "INCOME" : "EXPENSE";
  const مصروف_شهري = نوع_العرض === "MONTHLY";
  const [مبلغ, تعيين_مبلغ] = React.useState(الحركة ? String(الحركة.المبلغ) : "");
  const [حساب, تعيين_حساب] = React.useState<string>(
    String(الحركة?.معرف_الحساب ?? "")
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
  // ── بند المصروف الشهري (للمصروفات فقط) ──
  const [بنود_المصروفات, تعيين_بنود_المصروفات] = React.useState<
    { id: number; الاسم: string; المتاح: number; المدفوع: number; المتبقي: number }[]
  >([]);
  const [بند_مصروف, تعيين_بند_مصروف] = React.useState<string>(
    الحركة?.معرف_بند_مصروف_شهري ? String(الحركة.معرف_بند_مصروف_شهري) : ""
  );
  const [تحذير_تجاوز, تعيين_تحذير_تجاوز] = React.useState<
    { الاسم: string; المقرر: number; المتبقي: number; الزيادة: number } | null
  >(null);

  // تحميل بنود الشهر أول ما المستخدم يختار «مصروف شهري»
  React.useEffect(() => {
    if (!مصروف_شهري || بنود_المصروفات.length) return;
    اجلب_بنود_شهر_للاختيار().then(تعيين_بنود_المصروفات).catch(() => {});
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [مصروف_شهري]);

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
    if (!نوع) return إشعار.خطأ("اختر النوع (إيراد/مصروف)");
    if (!حساب) return إشعار.خطأ("اختر الحساب");
    if (له_فرعية && !حساب_فرعي) {
      return إشعار.خطأ(`يرجى اختيار ${تسمية_فرعي(نوع_الحساب_المختار!)}`);
    }
    if (مصروف_شهري && !بند_مصروف) return إشعار.خطأ("اختر بند المصروف الشهري");
    // بند مصروف شهري: نفحص التجاوز الأول ونسأل المستخدم قبل ما نحفظ
    if (مصروف_شهري && بند_مصروف) {
      const فحص = await افحص_تجاوز_المصروف(Number(بند_مصروف), مبلغ, الحركة?.id ?? null);
      if (فحص?.متجاوز) {
        تعيين_تحذير_تجاوز({ الاسم: فحص.الاسم, المقرر: فحص.المقرر, المتبقي: فحص.المتبقي, الزيادة: فحص.الزيادة });
        return;
      }
    }
    await احفظ_فعلياً(false);
  }

  async function احفظ_فعلياً(أكّد_التجاوز: boolean) {
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
      صريح_الطرف: true,
      معرف_بند_مصروف_شهري: مصروف_شهري && بند_مصروف ? Number(بند_مصروف) : null,
      تأكيد_تجاوز_المصروف: أكّد_التجاوز,
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
                { القيمة: "MONTHLY", التسمية: "مصروف شهري" },
              ]}
              القيمة={نوع_العرض}
              عند_التغيير={(v) => {
                تعيين_نوع_العرض(v as "INCOME" | "EXPENSE" | "MONTHLY");
                if (v !== "MONTHLY") تعيين_بند_مصروف(""); // مصروف عادي: بلا بند
              }}
              قابل_للبحث={false}
              نص_بديل="اختر النوع…"
              autoFocus={!الحركة}
            />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>{t("pay.amount")}</العنوان>
            <الحقل selectOnFocus value={مبلغ} onChange={(e) => تعيين_مبلغ(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>{t("treasury.col.account")}</العنوان>
            <قائمة_اختيار
              الخيارات={الحسابات.map((h) => ({ القيمة: String(h.id), التسمية: h.التسمية }))}
              القيمة={حساب}
              عند_التغيير={تغيير_الحساب}
              قابل_للبحث={false}
              نص_بديل="اختر الحساب…"
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

          {/* بند المصروف الشهري — يظهر مع نوع «مصروف شهري» وإجباري */}
          {مصروف_شهري && (
            <div className="space-y-1.5 sm:col-span-2">
              <العنوان مطلوب>بند المصروف الشهري</العنوان>
              <قائمة_اختيار
                الخيارات={بنود_المصروفات.map((ب) => ({
                  القيمة: String(ب.id),
                  التسمية: `${ب.الاسم} — باقي ${ب.المتبقي.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`,
                }))}
                القيمة={بند_مصروف}
                عند_التغيير={(v) => {
                  تعيين_بند_مصروف(v);
                  // البيان يتملّى باسم البند لو لسه فاضي (توفير كتابة)
                  const ب = بنود_المصروفات.find((x) => String(x.id) === v);
                  if (ب && !بيان.trim()) تعيين_بيان(ب.الاسم);
                }}
                نص_بديل={بنود_المصروفات.length ? "اختر بند المصروف…" : "مفيش بنود مصروفات لهذا الشهر"}
              />
              {بنود_المصروفات.length === 0 && (
                <p className="text-[12px] text-muted-foreground">
                  ضيف بنودك من تاب «المصروفات الشهرية» الأول.
                </p>
              )}
              {بند_مصروف && (() => {
                const ب = بنود_المصروفات.find((x) => String(x.id) === بند_مصروف);
                if (!ب) return null;
                const قيمة = Number(String(مبلغ).replace(/,/g, "")) || 0;
                const بعد = ب.المتبقي - قيمة;
                return (
                  <p className={`text-[12px] ${بعد < 0 ? "text-warning" : "text-muted-foreground"}`}>
                    {بعد < 0
                      ? `تنبيه: المبلغ ده هيتجاوز المتبقي بـ ${Math.abs(بعد).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })} — هيتسألك تأكيد قبل الحفظ.`
                      : `المتبقي بعد الحركة دي: ${بعد.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`}
                  </p>
                );
              })()}
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

        {تحذير_تجاوز && (
          <حوار_تجاوز_المصروف
            تفاصيل={تحذير_تجاوز}
            معرف_البند={Number(بند_مصروف)}
            عند_الإلغاء={() => تعيين_تحذير_تجاوز(null)}
            عند_التأكيد={async () => {
              تعيين_تحذير_تجاوز(null);
              await احفظ_فعلياً(true);
            }}
            عند_تعديل_المبلغ={async (مبلغ_جديد) => {
              const r = await عدّل_مبلغ_الشهر(Number(بند_مصروف), مبلغ_جديد, false);
              if (!r.نجاح) return إشعار.خطأ(r.رسالة);
              إشعار.نجاح(r.رسالة!);
              تعيين_تحذير_تجاوز(null);
              const محدثة = await اجلب_بنود_شهر_للاختيار();
              تعيين_بنود_المصروفات(محدثة);
              await احفظ_فعلياً(false);
            }}
          />
        )}
      </محتوى_الحوار>
    </الحوار>
  );
}

/**
 * تحذير تجاوز ميزانية بند المصروف الشهري — خيارين واضحين للمستخدم:
 *  1) تعديل المبلغ المقرر للشهر (ويكمّل الحفظ)
 *  2) تسجيل التجاوز كما هو ⇒ الزيادة تترحّل تلقائياً للشهر الجاي
 */
function حوار_تجاوز_المصروف({
  تفاصيل,
  عند_الإلغاء,
  عند_التأكيد,
  عند_تعديل_المبلغ,
}: {
  تفاصيل: { الاسم: string; المقرر: number; المتبقي: number; الزيادة: number };
  معرف_البند: number;
  عند_الإلغاء: () => void;
  عند_التأكيد: () => Promise<void>;
  عند_تعديل_المبلغ: (مبلغ: string) => Promise<void>;
}) {
  const [وضع_التعديل, تعيين_وضع_التعديل] = React.useState(false);
  const [مبلغ_جديد, تعيين_مبلغ_جديد] = React.useState(
    String(Math.round((تفاصيل.المقرر + تفاصيل.الزيادة) * 100) / 100)
  );
  const [جارٍ, تعيين_جارٍ] = React.useState(false);
  const رقم = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإلغاء()}>
      <محتوى_الحوار className="max-w-lg">
        <رأس_الحوار>
          <عنوان_الحوار className="flex items-center gap-2">
            <AlertTriangle className="size-5 text-warning" /> المبلغ يتجاوز ميزانية البند
          </عنوان_الحوار>
        </رأس_الحوار>

        <div className="space-y-3 text-sm">
          <div className="rounded-lg border border-warning/40 bg-warning/10 p-3 leading-6 text-warning">
            بند <span className="font-semibold">«{تفاصيل.الاسم}»</span> المتبقي فيه{" "}
            <span className="ltr-nums font-semibold">{رقم(تفاصيل.المتبقي)}</span> بس، والحركة دي هتزوّد{" "}
            <span className="ltr-nums font-semibold">{رقم(تفاصيل.الزيادة)}</span> فوق المقرر.
          </div>

          {وضع_التعديل ? (
            <div className="space-y-1.5">
              <العنوان مطلوب>المبلغ المقرر الجديد للشهر</العنوان>
              <الحقل
                autoFocus
                selectOnFocus
                className="ltr-nums"
                value={مبلغ_جديد}
                onChange={(e) => تعيين_مبلغ_جديد(e.target.value)}
              />
              <p className="text-[12px] text-muted-foreground">
                المقرر الحالي {رقم(تفاصيل.المقرر)} — لو رفعته لـ {رقم(تفاصيل.المقرر + تفاصيل.الزيادة)} تبقى الحركة جوه الميزانية.
              </p>
            </div>
          ) : (
            <ul className="list-disc space-y-1 ps-5 text-muted-foreground">
              <li>
                <span className="font-medium text-foreground">تعديل المبلغ المقرر:</span> ترفع ميزانية البند للشهر ده
                وتكمّل التسجيل عادي.
              </li>
              <li>
                <span className="font-medium text-foreground">تسجيل التجاوز:</span> الحركة تتسجّل زي ما هي، والزيادة
                تظهر بالسالب وتترحّل على ميزانية الشهر الجاي تلقائياً.
              </li>
            </ul>
          )}
        </div>

        <تذييل_الحوار>
          {وضع_التعديل ? (
            <>
              <الزر
                variant="success"
                disabled={جارٍ}
                onClick={async () => { تعيين_جارٍ(true); await عند_تعديل_المبلغ(مبلغ_جديد); تعيين_جارٍ(false); }}
              >
                حفظ المبلغ وتسجيل الحركة
              </الزر>
              <الزر variant="outline" onClick={() => تعيين_وضع_التعديل(false)}>رجوع</الزر>
            </>
          ) : (
            <>
              <الزر variant="outline" onClick={() => تعيين_وضع_التعديل(true)}>
                <Pencil className="size-4" /> تعديل المبلغ المقرر
              </الزر>
              <الزر
                variant="danger"
                disabled={جارٍ}
                onClick={async () => { تعيين_جارٍ(true); await عند_التأكيد(); تعيين_جارٍ(false); }}
              >
                تسجيل التجاوز وترحيله للشهر الجاي
              </الزر>
              <الزر variant="ghost" onClick={عند_الإلغاء}>إلغاء</الزر>
            </>
          )}
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}

// ─── حوار تعديل دفع مباشر (من صفحة الخزنة) ─────────────────────────────────

function حوار_تعديل_دفع_مباشر_خزنة({
  الحركة,
  الحسابات,
  عند_الإغلاق,
}: {
  الحركة: حركة;
  الحسابات: حساب[];
  عند_الإغلاق: () => void;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const [تاريخ, تعيين_تاريخ] = React.useState(الحركة.التاريخ.slice(0, 10));
  const [مبلغ, تعيين_مبلغ] = React.useState(String(الحركة.المبلغ));
  const [بيان, تعيين_بيان] = React.useState(الحركة.البيان ?? "");
  const [حساب, تعيين_حساب] = React.useState(String(الحركة.معرف_الحساب));
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  async function حفظ() {
    تعيين_جارٍ(true);
    const r = await تعديل_دفع_مباشر_من_خزنة(الحركة.id, {
      التاريخ: تاريخ,
      المبلغ: مبلغ,
      معرف_الحساب: Number(حساب),
      البيان: بيان,
    });
    تعيين_جارٍ(false);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    إشعار.نجاح(r.رسالة!);
    عند_الإغلاق();
    router.refresh();
  }

  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإغلاق()}>
      <محتوى_الحوار className="max-w-md">
        <رأس_الحوار>
          <عنوان_الحوار>تعديل دفع مباشر</عنوان_الحوار>
        </رأس_الحوار>
        <p className="rounded-lg bg-appgray px-3 py-2 text-[12px] text-muted-foreground mb-1">
          التعديل يُطبَّق تلقائياً على حساب العميل والمورد والخزنة معاً.
        </p>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <العنوان مطلوب>التاريخ</العنوان>
            <منتقي_تاريخ القيمة={تاريخ} عند_التغيير={تعيين_تاريخ} />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>المبلغ</العنوان>
            <الحقل
              autoFocus
              selectOnFocus
              className="ltr-nums"
              value={مبلغ}
              onChange={(e) => تعيين_مبلغ(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <العنوان مطلوب>حساب الخزنة</العنوان>
            <قائمة_اختيار
              الخيارات={الحسابات.map((a) => ({ القيمة: String(a.id), التسمية: a.التسمية }))}
              القيمة={حساب}
              عند_التغيير={تعيين_حساب}
              قابل_للبحث={false}
              نص_بديل="اختر الحساب…"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <العنوان>بيان (اختياري)</العنوان>
            <الحقل
              value={بيان}
              onChange={(e) => تعيين_بيان(e.target.value)}
              placeholder="يُملأ تلقائيًا إذا تُرك فارغًا"
            />
          </div>
        </div>
        <تذييل_الحوار>
          <الزر variant="success" onClick={حفظ} disabled={جارٍ}>
            {جارٍ ? "جارٍ الحفظ…" : "حفظ التعديل"}
          </الزر>
          <الزر variant="outline" onClick={عند_الإغلاق}>إلغاء</الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}
