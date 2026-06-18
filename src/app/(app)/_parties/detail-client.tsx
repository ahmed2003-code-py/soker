"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { Plus, HandCoins, Trash2, Pencil, ExternalLink } from "lucide-react";
import { PartyType } from "@prisma/client";
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
import { حوار_تأكيد } from "@/components/confirm-dialog";
import { useإشعار } from "@/components/ui/toast";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";
import { فلتر_فترة } from "@/components/date-filter";
import { منتقي_تاريخ } from "@/components/date-picker";
import { سجل_دفعة, أضف_حركة_يدوية, حذف_حركة, تعديل_حركة, حذف_حركات_مختلطة, حذف_حركة_مرتبطة_بخزنة } from "./actions";
import { حذف_فاتورة } from "@/app/(app)/invoices/actions";

export type حركة = {
  id: number;
  التاريخ: string;
  رقم_المستند: string | null;
  البيان: string;
  التصنيف: string | null;
  الكمية: number | null;
  السعر: number | null;
  مدين: number;
  دائن: number;
  الرصيد_بعد_الحركة: number;
  معرف_الفاتورة: number | null;
  معرف_خزنة: number | null;
  مرتبط: boolean;
};

const اليوم = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });

export function حركات_الطرف({
  الطرف,
  الحركات,
  حسابات_الخزنة,
  طرق_الدفع,
}: {
  الطرف: { id: number; النوع: PartyType };
  الحركات: حركة[];
  حسابات_الخزنة: { id: number; التسمية: string }[];
  طرق_الدفع: string[];
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t } = استخدام_اللغة();
  const [دفعة, تعيين_دفعة] = React.useState(false);
  const [يدوية, تعيين_يدوية] = React.useState(false);
  const [حذف, تعيين_حذف] = React.useState<حركة | null>(null);
  const [حذف_خزنة, تعيين_حذف_خزنة] = React.useState<حركة | null>(null);
  const [حذف_فاتورة_مؤكد, تعيين_حذف_فاتورة_مؤكد] = React.useState<حركة | null>(null);
  const [تعديل, تعيين_تعديل] = React.useState<حركة | null>(null);
  const [من, تعيين_من] = React.useState("");
  const [إلى, تعيين_إلى] = React.useState("");
  const [محددة, تعيين_محددة] = React.useState<Set<number>>(new Set());
  const [حذف_جماعي, تعيين_حذف_جماعي] = React.useState(false);

  const حركات_معروضة = الحركات.filter((ح) => {
    const d = ح.التاريخ.slice(0, 10);
    if (من && d < من) return false;
    if (إلى && d > إلى) return false;
    return true;
  });

  function تبديل_تحديد(id: number) {
    تعيين_محددة((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  function تحديد_الكل() {
    if (محددة.size === حركات_معروضة.length && حركات_معروضة.length > 0) {
      تعيين_محددة(new Set());
    } else {
      تعيين_محددة(new Set(حركات_معروضة.map((ح) => ح.id)));
    }
  }

  const كل_محدد =
    حركات_معروضة.length > 0 && محددة.size === حركات_معروضة.length;

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
      مخفي_موبايل: false,
    },
    {
      المفتاح: "التاريخ",
      العنوان: t("common.date"),
      خلية: (ص) => <نص_تاريخ القيمة={ص.التاريخ} />,
      قيمة: (ص) => ص.التاريخ,
      قابل_للفرز: true,
    },
    {
      المفتاح: "رقم_المستند",
      العنوان: t("ledger.col.doc"),
      خلية: (ص) =>
        ص.معرف_الفاتورة ? (
          <Link
            href={`/invoices/${ص.معرف_الفاتورة}`}
            className="flex items-center gap-1 ltr-nums text-primary-blue hover:underline"
          >
            {ص.رقم_المستند}
            <ExternalLink className="size-3 opacity-60" />
          </Link>
        ) : (
          <span className="ltr-nums">{ص.رقم_المستند || "—"}</span>
        ),
      مخفي_موبايل: true,
    },
    { المفتاح: "البيان", العنوان: t("ledger.col.statement") },
    {
      المفتاح: "المبلغ",
      العنوان: "المبلغ",
      محاذاة: "end",
      خلية: (ص) => {
        const قيمة = ص.مدين || ص.دائن;
        return قيمة ? (
          <نص_مبلغ القيمة={قيمة} مع_العملة={false} />
        ) : (
          <span>—</span>
        );
      },
      مخفي_موبايل: true,
    },
    {
      المفتاح: "مدين",
      العنوان: t("ledger.col.debit"),
      محاذاة: "end",
      خلية: (ص) =>
        ص.مدين ? (
          <نص_مبلغ القيمة={ص.مدين} مع_العملة={false} />
        ) : (
          <span>—</span>
        ),
    },
    {
      المفتاح: "دائن",
      العنوان: t("ledger.col.credit"),
      محاذاة: "end",
      خلية: (ص) =>
        ص.دائن ? (
          <نص_مبلغ القيمة={ص.دائن} مع_العملة={false} />
        ) : (
          <span>—</span>
        ),
    },
    {
      المفتاح: "الرصيد_بعد_الحركة",
      العنوان: t("ledger.col.balance_after"),
      محاذاة: "end",
      خلية: (ص) => (
        <نص_مبلغ القيمة={ص.الرصيد_بعد_الحركة} مع_العملة={false} />
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap items-end justify-between gap-3">
        <فلتر_فترة
          من={من}
          إلى={إلى}
          عند_التغيير={(م, ن) => {
            تعيين_من(م);
            تعيين_إلى(ن);
          }}
        />
        <div className="flex flex-wrap gap-2">
          {محددة.size > 0 && (
            <الزر
              variant="danger"
              size="sm"
              onClick={() => تعيين_حذف_جماعي(true)}
            >
              <Trash2 className="size-4" />
              حذف المحدد ({محددة.size})
            </الزر>
          )}
          <الزر variant="success" onClick={() => تعيين_دفعة(true)}>
            <HandCoins className="size-4" />
            {الطرف.النوع === "CUSTOMER"
              ? t("ledger.collect")
              : t("ledger.disburse")}
          </الزر>
          <الزر variant="outline" onClick={() => تعيين_يدوية(true)}>
            <Plus className="size-4" /> {t("ledger.manual")}
          </الزر>
        </div>
      </div>

      <جدول_بيانات
        الأعمدة={أعمدة}
        البيانات={حركات_معروضة}
        مفتاح_الصف={(ص) => ص.id}
        بحث={false}
        رسالة_فراغ={t("ledger.empty")}
        إجراءات_الصف={(ص) => {
          // في وضع التحديد الجماعي (أكثر من صف) → زر حذف فقط لكل صف
          if (محددة.size > 1) {
            const على_الحذف = () => {
              if (ص.معرف_الفاتورة) تعيين_حذف_فاتورة_مؤكد(ص);
              else if (ص.معرف_خزنة) تعيين_حذف_خزنة(ص);
              else تعيين_حذف(ص);
            };
            return (
              <الزر size="sm" variant="ghost" onClick={على_الحذف} title="حذف">
                <Trash2 className="size-4 text-danger" />
              </الزر>
            );
          }

          // الوضع العادي — أزرار كاملة حسب نوع الصف
          if (ص.معرف_الفاتورة) {
            return (
              <div className="flex items-center gap-1">
                <Link
                  href={`/invoices/${ص.معرف_الفاتورة}`}
                  className="flex items-center gap-1 rounded-lg px-1.5 py-1 text-xs text-primary-blue hover:bg-appgray"
                  title="فتح الفاتورة"
                >
                  <ExternalLink className="size-3" />
                </Link>
                <Link href={`/invoices/${ص.معرف_الفاتورة}/edit`}>
                  <الزر size="sm" variant="ghost" title="تعديل الفاتورة" asChild={false}>
                    <Pencil className="size-4 text-primary" />
                  </الزر>
                </Link>
                <الزر
                  size="sm"
                  variant="ghost"
                  title="حذف الفاتورة"
                  onClick={() => تعيين_حذف_فاتورة_مؤكد(ص)}
                >
                  <Trash2 className="size-4 text-danger" />
                </الزر>
              </div>
            );
          }
          if (ص.معرف_خزنة) {
            return (
              <الزر
                size="sm"
                variant="ghost"
                onClick={() => تعيين_حذف_خزنة(ص)}
                title="حذف وعكس من الخزنة"
              >
                <Trash2 className="size-4 text-danger" />
              </الزر>
            );
          }
          return (
            <div className="flex items-center gap-1">
              <الزر size="sm" variant="ghost" onClick={() => تعيين_تعديل(ص)} title="تعديل">
                <Pencil className="size-4 text-primary" />
              </الزر>
              <الزر size="sm" variant="ghost" onClick={() => تعيين_حذف(ص)} title="حذف">
                <Trash2 className="size-4 text-danger" />
              </الزر>
            </div>
          );
        }}
      />

      {دفعة && (
        <حوار_دفعة
          الطرف={الطرف}
          حسابات_الخزنة={حسابات_الخزنة}
          طرق_الدفع={طرق_الدفع}
          عند_الإغلاق={() => تعيين_دفعة(false)}
        />
      )}
      {يدوية && (
        <حوار_حركة_يدوية
          الطرف={الطرف}
          عند_الإغلاق={() => تعيين_يدوية(false)}
        />
      )}
      {تعديل && (
        <حوار_تعديل_حركة
          الحركة={تعديل}
          الطرف={الطرف}
          عند_الإغلاق={() => تعيين_تعديل(null)}
        />
      )}
      {حذف && (
        <حوار_تأكيد
          مفتوح
          عند_التغيير={(o) => !o && تعيين_حذف(null)}
          العنوان={t("ledger.delete_title")}
          الوصف={t("ledger.delete_desc")}
          عند_التأكيد={async () => {
            const r = await حذف_حركة(حذف.id);
            r.نجاح ? إشعار.نجاح(r.رسالة!) : إشعار.خطأ(r.رسالة);
            if (r.نجاح) {
              تعيين_محددة((prev) => { const next = new Set(prev); next.delete(حذف.id); return next; });
              router.refresh();
            }
          }}
        />
      )}
      {حذف_خزنة && (
        <حوار_تأكيد
          مفتوح
          عند_التغيير={(o) => !o && تعيين_حذف_خزنة(null)}
          العنوان="حذف وعكس الحركة"
          الوصف="سيُحذف هذا القيد وحركة الخزنة المرتبطة به، ويُعاد حساب الرصيدين. لا يمكن التراجع."
          عند_التأكيد={async () => {
            const r = await حذف_حركة_مرتبطة_بخزنة(حذف_خزنة.id);
            r.نجاح ? إشعار.نجاح(r.رسالة!) : إشعار.خطأ(r.رسالة);
            if (r.نجاح) router.refresh();
          }}
        />
      )}
      {حذف_فاتورة_مؤكد && (
        <حوار_تأكيد
          مفتوح
          عند_التغيير={(o) => !o && تعيين_حذف_فاتورة_مؤكد(null)}
          العنوان="حذف الفاتورة"
          الوصف={`سيُحذف الفاتورة رقم ${حذف_فاتورة_مؤكد.رقم_المستند ?? ""} وقيدها في الحساب ويُعاد الحساب. لا يمكن التراجع.`}
          عند_التأكيد={async () => {
            if (!حذف_فاتورة_مؤكد.معرف_الفاتورة) return;
            const r = await حذف_فاتورة(حذف_فاتورة_مؤكد.معرف_الفاتورة);
            r.نجاح ? إشعار.نجاح(r.رسالة!) : إشعار.خطأ(r.رسالة);
            if (r.نجاح) router.refresh();
          }}
        />
      )}
      {حذف_جماعي && (
        <حوار_تأكيد
          مفتوح
          عند_التغيير={(o) => !o && تعيين_حذف_جماعي(false)}
          العنوان={`حذف ${محددة.size} حركة`}
          الوصف="سيُعاد حساب رصيد الطرف بعد الحذف. لا يمكن التراجع."
          عند_التأكيد={async () => {
            const r = await حذف_حركات_مختلطة([...محددة]);
            r.نجاح ? إشعار.نجاح(r.رسالة!) : إشعار.خطأ(r.رسالة);
            if (r.نجاح) {
              تعيين_محددة(new Set());
              router.refresh();
            }
          }}
        />
      )}
    </>
  );
}

function حوار_دفعة({
  الطرف,
  حسابات_الخزنة,
  طرق_الدفع,
  عند_الإغلاق,
}: {
  الطرف: { id: number; النوع: PartyType };
  حسابات_الخزنة: { id: number; التسمية: string }[];
  طرق_الدفع: string[];
  عند_الإغلاق: () => void;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t } = استخدام_اللغة();
  const [تاريخ, تعيين_تاريخ] = React.useState(اليوم());
  const [مبلغ, تعيين_مبلغ] = React.useState("");
  const [طريقة, تعيين_طريقة] = React.useState(طرق_الدفع[0] ?? "نقدي");
  const [حساب, تعيين_حساب] = React.useState<string>(
    حسابات_الخزنة[0] ? String(حسابات_الخزنة[0].id) : ""
  );
  const [رقم, تعيين_رقم] = React.useState("");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  async function حفظ() {
    تعيين_جارٍ(true);
    const r = await سجل_دفعة({
      معرف_الطرف: الطرف.id,
      التاريخ: تاريخ,
      المبلغ: مبلغ,
      طريقة_الدفع: طريقة,
      معرف_حساب_الخزنة: حساب ? Number(حساب) : null,
      رقم_الفاتورة: رقم || null,
    });
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
          <عنوان_الحوار>
            {الطرف.النوع === "CUSTOMER"
              ? t("pay.collect_from")
              : t("pay.disburse_to")}
          </عنوان_الحوار>
        </رأس_الحوار>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <العنوان مطلوب>{t("common.date")}</العنوان>
            <منتقي_تاريخ القيمة={تاريخ} عند_التغيير={تعيين_تاريخ} />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>{t("pay.amount")}</العنوان>
            <الحقل
              autoFocus
              selectOnFocus
              value={مبلغ}
              onChange={(e) => تعيين_مبلغ(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>{t("pay.method")}</العنوان>
            <قائمة_اختيار
              الخيارات={طرق_الدفع.map((m) => ({ القيمة: m, التسمية: m }))}
              القيمة={طريقة}
              عند_التغيير={تعيين_طريقة}
              قابل_للبحث={false}
            />
          </div>
          <div className="space-y-1.5">
            <العنوان>{t("pay.account")}</العنوان>
            <قائمة_اختيار
              الخيارات={حسابات_الخزنة.map((a) => ({
                القيمة: String(a.id),
                التسمية: a.التسمية,
              }))}
              القيمة={حساب}
              عند_التغيير={تعيين_حساب}
              قابل_للبحث={false}
            />
            <p className="text-xs text-muted-foreground">
              {t("pay.treasury_hint")}
            </p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <العنوان>{t("pay.invoice_opt")}</العنوان>
            <الحقل
              className="ltr-nums"
              value={رقم}
              onChange={(e) => تعيين_رقم(e.target.value)}
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

function حوار_حركة_يدوية({
  الطرف,
  عند_الإغلاق,
}: {
  الطرف: { id: number; النوع: PartyType };
  عند_الإغلاق: () => void;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t } = استخدام_اللغة();
  const [تاريخ, تعيين_تاريخ] = React.useState(اليوم());
  const [بيان, تعيين_بيان] = React.useState("");
  const [مدين, تعيين_مدين] = React.useState("");
  const [دائن, تعيين_دائن] = React.useState("");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  async function حفظ() {
    تعيين_جارٍ(true);
    const r = await أضف_حركة_يدوية({
      معرف_الطرف: الطرف.id,
      التاريخ: تاريخ,
      البيان: بيان,
      مدين: مدين || "",
      دائن: دائن || "",
    });
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
          <عنوان_الحوار>{t("manual.title")}</عنوان_الحوار>
        </رأس_الحوار>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <العنوان مطلوب>{t("common.date")}</العنوان>
            <منتقي_تاريخ القيمة={تاريخ} عند_التغيير={تعيين_تاريخ} />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>{t("ledger.col.statement")}</العنوان>
            <الحقل
              autoFocus
              value={بيان}
              onChange={(e) => تعيين_بيان(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <العنوان>{t("ledger.col.debit")}</العنوان>
            <الحقل
              selectOnFocus
              value={مدين}
              onChange={(e) => تعيين_مدين(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5">
            <العنوان>{t("ledger.col.credit")}</العنوان>
            <الحقل
              selectOnFocus
              value={دائن}
              onChange={(e) => تعيين_دائن(e.target.value)}
              placeholder="0.00"
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

function حوار_تعديل_حركة({
  الحركة,
  الطرف,
  عند_الإغلاق,
}: {
  الحركة: حركة;
  الطرف: { id: number; النوع: PartyType };
  عند_الإغلاق: () => void;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t } = استخدام_اللغة();
  const [تاريخ, تعيين_تاريخ] = React.useState(
    الحركة.التاريخ.slice(0, 10)
  );
  const [بيان, تعيين_بيان] = React.useState(الحركة.البيان);
  const [مدين, تعيين_مدين] = React.useState(
    الحركة.مدين ? String(الحركة.مدين) : ""
  );
  const [دائن, تعيين_دائن] = React.useState(
    الحركة.دائن ? String(الحركة.دائن) : ""
  );
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  async function حفظ() {
    تعيين_جارٍ(true);
    const r = await تعديل_حركة(الحركة.id, {
      معرف_الطرف: الطرف.id,
      التاريخ: تاريخ,
      البيان: بيان,
      مدين: مدين || "",
      دائن: دائن || "",
    });
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
          <عنوان_الحوار>تعديل الحركة</عنوان_الحوار>
        </رأس_الحوار>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <العنوان مطلوب>{t("common.date")}</العنوان>
            <منتقي_تاريخ القيمة={تاريخ} عند_التغيير={تعيين_تاريخ} />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>{t("ledger.col.statement")}</العنوان>
            <الحقل
              autoFocus
              value={بيان}
              onChange={(e) => تعيين_بيان(e.target.value)}
            />
          </div>
          <div className="space-y-1.5">
            <العنوان>{t("ledger.col.debit")}</العنوان>
            <الحقل
              selectOnFocus
              value={مدين}
              onChange={(e) => تعيين_مدين(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5">
            <العنوان>{t("ledger.col.credit")}</العنوان>
            <الحقل
              selectOnFocus
              value={دائن}
              onChange={(e) => تعيين_دائن(e.target.value)}
              placeholder="0.00"
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
