"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Wallet,
  Plus,
  Pencil,
  Trash2,
  Smartphone,
  Banknote,
  Building2,
  CircleDollarSign,
  AlertTriangle,
} from "lucide-react";
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
  طريقة_الدفع: string | null;
  الرصيد_بعد_الحركة: number;
  مرتبط: boolean;
};

const أيقونات: Record<TreasuryAccountType, React.ReactNode> = {
  INSTAPAY: <Smartphone className="size-5" />,
  CASH: <Banknote className="size-5" />,
  BANK: <Building2 className="size-5" />,
  VODAFONE: <CircleDollarSign className="size-5" />,
};

const اليوم = () => new Date().toISOString().slice(0, 10);

export function شاشة_الخزنة({
  الحسابات,
  الحركات,
  الأطراف,
  طرق_الدفع,
}: {
  الحسابات: حساب[];
  الحركات: حركة[];
  الأطراف: { id: number; name: string }[];
  طرق_الدفع: string[];
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t } = استخدام_اللغة();
  const [نموذج, تعيين_نموذج] = React.useState<{ حركة?: حركة } | null>(null);
  const [حذف, تعيين_حذف] = React.useState<حركة | null>(null);
  const [فلتر_حساب, تعيين_فلتر_حساب] = React.useState("");
  const [فلتر_نوع, تعيين_فلتر_نوع] = React.useState("");

  const الإجمالي = الحسابات.reduce((س, ح) => س + ح.الرصيد, 0);

  const حركات_مصفّاة = الحركات.filter(
    (ح) =>
      (!فلتر_حساب || ح.معرف_الحساب === Number(فلتر_حساب)) &&
      (!فلتر_نوع || ح.النوع === فلتر_نوع)
  );

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
    { المفتاح: "الحساب", العنوان: t("treasury.col.account") },
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
      خلية: (ص) => <نص_مبلغ القيمة={ص.الرصيد_بعد_الحركة} مع_العملة={false} />,
      مخفي_موبايل: true,
    },
  ];

  return (
    <div className="space-y-6">
      {/* البطاقات */}
      <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-5">
        {الحسابات.map((ح) => {
          const تحت_الحد = ح.الحد_الأدنى != null && ح.الرصيد < ح.الحد_الأدنى;
          return (
            <div key={ح.id} className="card-soft p-5">
              <div className="flex items-start justify-between">
                <p className="text-sm text-muted-foreground">{ح.التسمية}</p>
                <span className="rounded-xl bg-appgray p-2 text-primary">
                  {أيقونات[ح.النوع]}
                </span>
              </div>
              <div className={`mt-2 text-xl font-bold ${ح.الرصيد < 0 ? "text-danger" : "text-foreground"}`}>
                <نص_مبلغ القيمة={ح.الرصيد} />
              </div>
              {تحت_الحد && (
                <p className="mt-1 flex items-center gap-1 text-xs text-warning">
                  <AlertTriangle className="size-3.5" /> {t("dash.under_threshold")}
                </p>
              )}
            </div>
          );
        })}
        <div className="card-soft border-primary/30 bg-primary/5 p-5">
          <div className="flex items-start justify-between">
            <p className="text-sm text-muted-foreground">{t("treasury.total")}</p>
            <span className="rounded-xl bg-primary/10 p-2 text-primary">
              <Wallet className="size-5" />
            </span>
          </div>
          <div className="mt-2 text-xl font-bold text-primary">
            <نص_مبلغ القيمة={الإجمالي} />
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
          طرق_الدفع={طرق_الدفع}
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
  طرق_الدفع,
  عند_الإغلاق,
}: {
  الحركة?: حركة;
  الحسابات: حساب[];
  الأطراف: { id: number; name: string }[];
  طرق_الدفع: string[];
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
  const [طرف, تعيين_طرف] = React.useState<string>("");
  const [طريقة, تعيين_طريقة] = React.useState(الحركة?.طريقة_الدفع ?? "");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  async function حفظ() {
    تعيين_جارٍ(true);
    const payload = {
      التاريخ: تاريخ,
      النوع: نوع,
      المبلغ: مبلغ,
      معرف_الحساب: Number(حساب),
      البيان: بيان,
      معرف_الطرف: طرف ? Number(طرف) : null,
      طريقة_الدفع: طريقة || null,
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
            <الحقل type="date" value={تاريخ} onChange={(e) => تعيين_تاريخ(e.target.value)} />
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
          <div className="space-y-1.5">
            <العنوان>{t("treasury.f.party_opt")}</العنوان>
            <قائمة_اختيار
              الخيارات={[
                { القيمة: "", التسمية: t("common.none") },
                ...الأطراف.map((p) => ({ القيمة: String(p.id), التسمية: p.name })),
              ]}
              القيمة={طرف}
              عند_التغيير={تعيين_طرف}
            />
          </div>
          <div className="space-y-1.5">
            <العنوان>{t("pay.method")}</العنوان>
            <قائمة_اختيار
              الخيارات={[
                { القيمة: "", التسمية: "—" },
                ...طرق_الدفع.map((m) => ({ القيمة: m, التسمية: m })),
              ]}
              القيمة={طريقة}
              عند_التغيير={تعيين_طريقة}
              قابل_للبحث={false}
            />
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
