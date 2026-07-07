"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HandCoins, Trash2, Pencil, ExternalLink, Landmark } from "lucide-react";
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
import { سجل_دفعة, حذف_حركة, تعديل_حركة, حذف_حركات_مختلطة, حذف_حركة_مرتبطة_بخزنة, تعديل_الرصيد_الابتدائي } from "./actions";
import { حذف_فاتورة } from "@/app/(app)/invoices/actions";
import { تعديل_حركة_خزنة } from "@/app/(app)/treasury/actions";
import { أنشئ_حساب_فرعي, type خريطة_حسابات_فرعية } from "@/app/(app)/treasury/sub-account-actions";
import { TreasuryAccountType } from "@prisma/client";

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
  معرف_حساب_خزنة: number | null;
  مرتبط: boolean;
};

const اليوم = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });

/** تسمية الحساب الفرعي حسب النوع */
function تسمية_فرعي(النوع: TreasuryAccountType): string {
  if (النوع === "VODAFONE") return "المحفظة";
  if (النوع === "INSTAPAY") return "حساب إنستا";
  if (النوع === "BANK") return "البنك";
  return "الحساب الفرعي";
}

export function حركات_الطرف({
  الطرف,
  الحركات,
  رصيد_ابتدائي = 0,
  حسابات_الخزنة,
  حسابات_فرعية,
}: {
  الطرف: { id: number; النوع: PartyType };
  الحركات: حركة[];
  رصيد_ابتدائي?: number;
  حسابات_الخزنة: { id: number; النوع: TreasuryAccountType; التسمية: string }[];
  حسابات_فرعية: خريطة_حسابات_فرعية;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t } = استخدام_اللغة();
  const [دفعة, تعيين_دفعة] = React.useState(false);
  const [حذف, تعيين_حذف] = React.useState<حركة | null>(null);
  const [حذف_خزنة, تعيين_حذف_خزنة] = React.useState<حركة | null>(null);
  const [حذف_فاتورة_مؤكد, تعيين_حذف_فاتورة_مؤكد] = React.useState<حركة | null>(null);
  const [تعديل, تعيين_تعديل] = React.useState<حركة | null>(null);
  const [تعديل_خزنة, تعيين_تعديل_خزنة] = React.useState<حركة | null>(null);
  const [من, تعيين_من] = React.useState("");
  const [إلى, تعيين_إلى] = React.useState("");
  const [محددة, تعيين_محددة] = React.useState<Set<number>>(new Set());
  const [حذف_جماعي, تعيين_حذف_جماعي] = React.useState(false);
  const [رصيد_ابتدائي_حوار, تعيين_رصيد_ابتدائي_حوار] = React.useState(false);
  const [قيمة_رصيد_ابتدائي, تعيين_قيمة_رصيد_ابتدائي] = React.useState("");

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
          <الزر
            variant="outline"
            size="sm"
            onClick={() => {
              تعيين_قيمة_رصيد_ابتدائي(رصيد_ابتدائي !== 0 ? String(رصيد_ابتدائي) : "");
              تعيين_رصيد_ابتدائي_حوار(true);
            }}
          >
            <Landmark className="size-4" />
            الرصيد الابتدائي
          </الزر>
          <الزر variant="success" onClick={() => تعيين_دفعة(true)}>
            <HandCoins className="size-4" />
            {الطرف.النوع === "CUSTOMER"
              ? t("ledger.collect")
              : t("ledger.disburse")}
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
              <div className="flex items-center gap-1">
                <الزر size="sm" variant="ghost" onClick={() => تعيين_تعديل_خزنة(ص)} title="تعديل">
                  <Pencil className="size-4 text-primary" />
                </الزر>
                <الزر
                  size="sm"
                  variant="ghost"
                  onClick={() => تعيين_حذف_خزنة(ص)}
                  title="حذف وعكس من الخزنة"
                >
                  <Trash2 className="size-4 text-danger" />
                </الزر>
              </div>
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
          حسابات_فرعية={حسابات_فرعية}
          عند_الإغلاق={() => تعيين_دفعة(false)}
        />
      )}
      {تعديل && (
        <حوار_تعديل_حركة
          الحركة={تعديل}
          الطرف={الطرف}
          عند_الإغلاق={() => تعيين_تعديل(null)}
        />
      )}
      {تعديل_خزنة && (
        <حوار_تعديل_حركة_خزنة
          الحركة={تعديل_خزنة}
          حسابات_الخزنة={حسابات_الخزنة}
          حسابات_فرعية={حسابات_فرعية}
          عند_الإغلاق={() => تعيين_تعديل_خزنة(null)}
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

      {/* حوار تعيين الرصيد الابتدائي */}
      {رصيد_ابتدائي_حوار && (
        <الحوار open onOpenChange={(o) => !o && تعيين_رصيد_ابتدائي_حوار(false)}>
          <محتوى_الحوار>
            <رأس_الحوار>
              <عنوان_الحوار>تعيين الرصيد الابتدائي</عنوان_الحوار>
            </رأس_الحوار>
            <div className="space-y-3">
              <p className="text-sm text-muted-foreground">
                الرصيد الابتدائي هو المبلغ الموجود <strong>قبل</strong> استخدام البرنامج.
                {الطرف.النوع === "CUSTOMER"
                  ? " موجب = العميل مدين لك."
                  : " موجب = أنت مدين للمورد."}
                <br />
                الحركات الموجودة تبقى — فقط نقطة البداية تتغير.
              </p>
              <div className="space-y-1.5">
                <العنوان>الرصيد الابتدائي</العنوان>
                <الحقل
                  autoFocus
                  selectOnFocus
                  type="number"
                  step="0.01"
                  value={قيمة_رصيد_ابتدائي}
                  onChange={(e) => تعيين_قيمة_رصيد_ابتدائي(e.target.value)}
                  placeholder="0.00"
                />
              </div>
            </div>
            <تذييل_الحوار>
              <الزر
                variant="success"
                onClick={async () => {
                  const r = await تعديل_الرصيد_الابتدائي(الطرف.id, قيمة_رصيد_ابتدائي || "0");
                  r.نجاح ? إشعار.نجاح(r.رسالة!) : إشعار.خطأ(r.رسالة);
                  if (r.نجاح) {
                    تعيين_رصيد_ابتدائي_حوار(false);
                    router.refresh();
                  }
                }}
              >
                حفظ
              </الزر>
              <الزر variant="outline" onClick={() => تعيين_رصيد_ابتدائي_حوار(false)}>
                إلغاء
              </الزر>
            </تذييل_الحوار>
          </محتوى_الحوار>
        </الحوار>
      )}
    </>
  );
}

function حوار_دفعة({
  الطرف,
  حسابات_الخزنة,
  حسابات_فرعية,
  عند_الإغلاق,
}: {
  الطرف: { id: number; النوع: PartyType };
  حسابات_الخزنة: { id: number; النوع: TreasuryAccountType; التسمية: string }[];
  حسابات_فرعية: خريطة_حسابات_فرعية;
  عند_الإغلاق: () => void;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t } = استخدام_اللغة();
  const [تاريخ, تعيين_تاريخ] = React.useState(اليوم());
  const [مبلغ_له, تعيين_مبلغ_له] = React.useState("");
  const [مبلغ_عليه, تعيين_مبلغ_عليه] = React.useState("");
  const [حساب, تعيين_حساب] = React.useState<string>(
    حسابات_الخزنة[0] ? String(حسابات_الخزنة[0].id) : ""
  );
  const [حساب_فرعي, تعيين_حساب_فرعي] = React.useState<string>("");
  const [بيان, تعيين_بيان] = React.useState("");
  const [رقم, تعيين_رقم] = React.useState("");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);
  const [خيارات_فرعية_محلية, تعيين_خيارات_فرعية_محلية] = React.useState<خريطة_حسابات_فرعية>(حسابات_فرعية);

  const نوع_الحساب = React.useMemo(
    () => حسابات_الخزنة.find((h) => h.id === Number(حساب))?.النوع ?? null,
    [حساب, حسابات_الخزنة]
  );
  const له_فرعية = نوع_الحساب !== null && نوع_الحساب !== "CASH";
  const خيارات_فرعية = له_فرعية && نوع_الحساب ? (خيارات_فرعية_محلية[نوع_الحساب] ?? []) : [];

  // تحديد تلقائي لو فيه خيار واحد بس
  React.useEffect(() => {
    if (له_فرعية && خيارات_فرعية.length === 1 && !حساب_فرعي) {
      تعيين_حساب_فرعي(String(خيارات_فرعية[0].id));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [له_فرعية, خيارات_فرعية.length]);

  function تغيير_الحساب(معرف: string) {
    const نوع_الجديد = حسابات_الخزنة.find((h) => h.id === Number(معرف))?.النوع;
    const نوع_القديم = حسابات_الخزنة.find((h) => h.id === Number(حساب))?.النوع;
    if (نوع_الجديد !== نوع_القديم) تعيين_حساب_فرعي("");
    تعيين_حساب(معرف);
  }

  async function إضافة_فرعي(الاسم: string) {
    if (!نوع_الحساب || نوع_الحساب === "CASH") return;
    const r = await أنشئ_حساب_فرعي(نوع_الحساب, الاسم);
    if (!r.نجاح || !r.بيانات) return;
    تعيين_خيارات_فرعية_محلية((prev) => ({
      ...prev,
      [نوع_الحساب]: [...(prev[نوع_الحساب] ?? []), { id: r.بيانات!.id, الاسم, الرصيد: 0 }],
    }));
    تعيين_حساب_فرعي(String(r.بيانات.id));
  }

  async function حفظ() {
    if (له_فرعية && !حساب_فرعي) {
      return إشعار.خطأ(`يرجى اختيار ${تسمية_فرعي(نوع_الحساب!)}`);
    }
    تعيين_جارٍ(true);
    const r = await سجل_دفعة({
      معرف_الطرف: الطرف.id,
      التاريخ: تاريخ,
      مبلغ_له: مبلغ_له || null,
      مبلغ_عليه: مبلغ_عليه || null,
      معرف_حساب_الخزنة: حساب ? Number(حساب) : 0,
      معرف_حساب_فرعي: حساب_فرعي ? Number(حساب_فرعي) : null,
      البيان: بيان || null,
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
            <العنوان مطلوب>{t("pay.method")}</العنوان>
            <قائمة_اختيار
              الخيارات={حسابات_الخزنة.map((a) => ({
                القيمة: String(a.id),
                التسمية: a.التسمية,
              }))}
              القيمة={حساب}
              عند_التغيير={تغيير_الحساب}
              قابل_للبحث={false}
            />
          </div>

          {/* الحساب الفرعي — إجباري */}
          {له_فرعية && نوع_الحساب && (
            <div className="space-y-1.5 sm:col-span-2">
              <العنوان مطلوب>{تسمية_فرعي(نوع_الحساب)}</العنوان>
              <قائمة_اختيار
                الخيارات={خيارات_فرعية.map((s) => ({ القيمة: String(s.id), التسمية: s.الاسم }))}
                القيمة={حساب_فرعي}
                عند_التغيير={تعيين_حساب_فرعي}
                عند_الإضافة={إضافة_فرعي}
                تسمية_الإضافة={`إضافة ${تسمية_فرعي(نوع_الحساب)}`}
                نص_بديل={`اختر ${تسمية_فرعي(نوع_الحساب)}…`}
              />
            </div>
          )}

          <div className="space-y-1.5">
            <العنوان>له</العنوان>
            <الحقل
              autoFocus
              selectOnFocus
              value={مبلغ_له}
              onChange={(e) => { تعيين_مبلغ_له(e.target.value); if (e.target.value) تعيين_مبلغ_عليه(""); }}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5">
            <العنوان>عليه</العنوان>
            <الحقل
              selectOnFocus
              value={مبلغ_عليه}
              onChange={(e) => { تعيين_مبلغ_عليه(e.target.value); if (e.target.value) تعيين_مبلغ_له(""); }}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <العنوان>التفاصيل <span className="text-muted-foreground font-normal">(اختياري)</span></العنوان>
            <الحقل
              value={بيان}
              onChange={(e) => تعيين_بيان(e.target.value)}
              placeholder="تفاصيل..."
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <العنوان>رقم الفاتورة <span className="text-muted-foreground font-normal">(اختياري)</span></العنوان>
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

function حوار_تعديل_حركة_خزنة({
  الحركة,
  حسابات_الخزنة,
  // eslint-disable-next-line @typescript-eslint/no-unused-vars
  حسابات_فرعية: _,
  عند_الإغلاق,
}: {
  الحركة: حركة;
  حسابات_الخزنة: { id: number; النوع: TreasuryAccountType; التسمية: string }[];
  حسابات_فرعية: خريطة_حسابات_فرعية;
  عند_الإغلاق: () => void;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t } = استخدام_اللغة();
  const القيمة = الحركة.مدين || الحركة.دائن;
  const [تاريخ, تعيين_تاريخ] = React.useState(الحركة.التاريخ.slice(0, 10));
  const [مبلغ, تعيين_مبلغ] = React.useState(String(القيمة));
  const [بيان, تعيين_بيان] = React.useState(الحركة.البيان);
  const [حساب, تعيين_حساب] = React.useState(
    String(الحركة.معرف_حساب_خزنة ?? حسابات_الخزنة[0]?.id ?? "")
  );
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  // نوع الحركة: إذا دائن > 0 → إيراد (تحصيل من عميل)؛ وإلا → مصروف (صرف لمورد)
  const النوع = الحركة.دائن > 0 ? "INCOME" : "EXPENSE";

  async function حفظ() {
    if (!الحركة.معرف_خزنة) return;
    تعيين_جارٍ(true);
    const r = await تعديل_حركة_خزنة(الحركة.معرف_خزنة, {
      التاريخ: تاريخ,
      النوع,
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
      <محتوى_الحوار>
        <رأس_الحوار>
          <عنوان_الحوار>تعديل حركة الخزنة</عنوان_الحوار>
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
              className="ltr-nums"
              value={مبلغ}
              onChange={(e) => تعيين_مبلغ(e.target.value)}
              placeholder="0.00"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
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
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <العنوان مطلوب>{t("ledger.col.statement")}</العنوان>
            <الحقل
              value={بيان}
              onChange={(e) => تعيين_بيان(e.target.value)}
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
