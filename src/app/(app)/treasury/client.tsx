"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Wallet, Plus, Pencil, Trash2, AlertTriangle, ArrowUp, ArrowDown } from "lucide-react";
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
import { تسجيل_حركة, تعديل_حركة_خزنة, حذف_حركة_خزنة } from "./actions";

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
  مرتبط: boolean;
};

const اليوم = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });

export function شاشة_الخزنة({
  الحسابات,
  الحركات,
  الأطراف,
}: {
  الحسابات: حساب[];
  الحركات: حركة[];
  الأطراف: { id: number; name: string }[];
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

  const لقطات = React.useMemo(() => {
    const ترتيب = [...الحركات].sort((a, b) =>
      a.التاريخ === b.التاريخ ? a.id - b.id : a.التاريخ < b.التاريخ ? -1 : 1
    );
    const جارٍ: Record<number, number> = {};
    for (const ح of الحسابات) جارٍ[ح.id] = 0;
    const map = new Map<number, { أرصدة: { النوع: TreasuryAccountType; التسمية: string; رصيد: number }[]; إجمالي: number }>();
    for (const t of ترتيب) {
      جارٍ[t.معرف_الحساب] = (جارٍ[t.معرف_الحساب] ?? 0) + (t.النوع === "INCOME" ? t.المبلغ : -t.المبلغ);
      const أرصدة = الحسابات.map((ح) => ({ النوع: ح.النوع, التسمية: ح.التسمية, رصيد: جارٍ[ح.id] ?? 0 }));
      const إجمالي = أرصدة.reduce((س, a) => س + a.رصيد, 0);
      map.set(t.id, { أرصدة, إجمالي });
    }
    return map;
  }, [الحركات, الحسابات]);

  const أعمدة: عمود<حركة>[] = [
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
            <span>{ص.الحساب}</span>
          </span>
        );
      },
    },
    { المفتاح: "البيان", العنوان: t("ledger.col.statement") },
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

  return (
    <div className="space-y-6">
      {/* البطاقات */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {الحسابات.map((ح) => {
          const تحت_الحد = !مفلتر_فترة && ح.الحد_الأدنى != null && ح.الرصيد < ح.الحد_الأدنى;
          const ملخص = مفلتر_فترة ? ملخص_حساب(ح.id) : null;
          const قيمة = ملخص ? ملخص.صافي : ح.الرصيد;
          return (
            <div key={ح.id} className="card-soft card-hover p-5">
              <div className="flex items-start justify-between">
                <p className="text-sm text-muted-foreground">{ح.التسمية}</p>
                <أيقونة_الحساب النوع={ح.النوع} />
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
            <الزر size="sm" variant="ghost" onClick={() => تعيين_نموذج({ حركة: ص })}>
              <Pencil className="size-4" />
            </الزر>
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
            if (r.نجاح) router.refresh();
          }}
        />
      )}
    </div>
  );
}

function حوار_حركة({
  الحركة,
  الحسابات,
  الأطراف,
  عند_الإغلاق,
}: {
  الحركة?: حركة;
  الحسابات: حساب[];
  الأطراف: { id: number; name: string }[];
  عند_الإغلاق: () => void;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t } = استخدام_اللغة();
  const [تاريخ, تعيين_تاريخ] = React.useState(الحركة ? الحركة.التاريخ.slice(0, 10) : اليوم());
  const [نوع, تعيين_نوع] = React.useState<TxnKind>(الحركة?.النوع ?? "INCOME");
  const [مبلغ, تعيين_مبلغ] = React.useState(الحركة ? String(الحركة.المبلغ) : "");
  const [حساب, تعيين_حساب] = React.useState<string>(
    String(الحركة?.معرف_الحساب ?? الحسابات[0]?.id ?? "")
  );
  const [بيان, تعيين_بيان] = React.useState(الحركة?.البيان ?? "");
  // نوع الطرف: عميل مسجّل أو اسم خارجي حر
  const [نوع_الطرف, تعيين_نوع_الطرف] = React.useState<"customer" | "external">("customer");
  const [طرف_عميل, تعيين_طرف_عميل] = React.useState<string>("");
  const [طرف_خارجي, تعيين_طرف_خارجي] = React.useState("");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  async function حفظ() {
    تعيين_جارٍ(true);
    const payload = {
      التاريخ: تاريخ,
      النوع: نوع,
      المبلغ: مبلغ,
      معرف_الحساب: Number(حساب),
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
              عند_التغيير={تعيين_حساب}
              قابل_للبحث={false}
            />
          </div>
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
