"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { HandCoins, Trash2, Pencil, ExternalLink, Landmark, Layers, Plus, ReceiptText, Undo2, FileText } from "lucide-react";
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
import { تسمية_حالة_الشيك } from "@/lib/enums";
import { حوار_تأكيد } from "@/components/confirm-dialog";
import { useإشعار } from "@/components/ui/toast";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";
import { فلتر_فترة } from "@/components/date-filter";
import { منتقي_تاريخ } from "@/components/date-picker";
import { سجل_دفعة, حذف_حركة, تعديل_حركة, حذف_حركات_مختلطة, حذف_حركة_مرتبطة_بخزنة, تعديل_الرصيد_الابتدائي, سجل_دفعة_موزعة, تعديل_دفعة_موزعة, اجلب_دفعة_موزعة } from "./actions";
import { تعديل_دفع_مباشر } from "@/app/(app)/treasury/actions";
import { حذف_فاتورة } from "@/app/(app)/invoices/actions";
import { أرجع_شيك_مظهّر, اجلب_شيكات_متاحة_للتظهير, ظهّر_شيكات_لمورد, أرجع_شيك_من_عميل, اجلب_شيكات_متاحة_للإسناد, اربط_شيكات_بعميل } from "@/app/(app)/cheques/actions";
import { تعديل_حركة_خزنة } from "@/app/(app)/treasury/actions";
import { أنشئ_حساب_فرعي, type خريطة_حسابات_فرعية } from "@/app/(app)/treasury/sub-account-actions";
import { TreasuryAccountType } from "@prisma/client";
import { استخدم_تراجع_الحذف } from "@/hooks/use-undo-delete";

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
  معرف_دفع_مباشر: number | null;
  معرف_دفعة_موزعة: number | null;
  شيك_مرتبط?: معلومة_شيك_قيد | null;
  مرتبط: boolean;
  // صف مجمّع (شيكات مُظهَّرة متتالية) — للعرض فقط
  مجموعة_شيكات?: معلومة_شيك_قيد[];
};

/** معلومات شيك مرتبط بقيد (لعرضها في نافذة تفاصيل الشيكات المجمّعة). */
export type معلومة_شيك_قيد = {
  id: number;
  المبلغ: number;
  رقم_الشيك: string | null;
  تاريخ_الاستحقاق: string;
  اسم_المدين: string;
  محول_من: string | null;
  اسم_البنك: string | null;
  افتتاحي: boolean;
  الحالة: string;
  معرف_معاملة?: number | null; // شيكات نفس معرّف المعاملة تُجمَّع سوياً (تظهير مورد)
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
  const [دفعة_موزعة, تعيين_دفعة_موزعة] = React.useState(false);
  const { احذف, معلقة } = استخدم_تراجع_الحذف();
  const [تعديل, تعيين_تعديل] = React.useState<حركة | null>(null);
  const [تعديل_خزنة, تعيين_تعديل_خزنة] = React.useState<حركة | null>(null);
  const [تعديل_دفع, تعيين_تعديل_دفع] = React.useState<حركة | null>(null);
  const [تعديل_موزعة, تعيين_تعديل_موزعة] = React.useState<number | null>(null);
  const [من, تعيين_من] = React.useState("");
  const [إلى, تعيين_إلى] = React.useState("");
  const [محددة, تعيين_محددة] = React.useState<Set<number>>(new Set());
  const [حذف_جماعي, تعيين_حذف_جماعي] = React.useState(false);
  const [رصيد_ابتدائي_حوار, تعيين_رصيد_ابتدائي_حوار] = React.useState(false);
  const [قيمة_رصيد_ابتدائي, تعيين_قيمة_رصيد_ابتدائي] = React.useState("");

  const حركات_مفلترة = الحركات.filter((ح) => {
    if (معلقة.has(ح.id)) return false;
    const d = ح.التاريخ.slice(0, 10);
    if (من && d < من) return false;
    if (إلى && d > إلى) return false;
    return true;
  });

  // تجميع صفوف الشيكات المتتالية في صف واحد (إجمالي + عدد) — العرض فقط، مع الحفاظ على الترتيب الزمني:
  //  الصف المجمّع = سلسلة متتالية من صفوف شيكات تشترك في نفس «معرّف المعاملة» (null = قديم/استلام).
  //  التظهير المفرد له معرّف خاص → لا يندمج مع القديمة. أي قيد آخر (فاتورة/دفعة) يفصل المجموعة فيبقى في مكانه.
  const [تفاصيل_مجموعة, تعيين_تفاصيل_مجموعة] = React.useState<معلومة_شيك_قيد[] | null>(null);
  const بناء_مجموعة = (أعضاء: حركة[], مفتاح: number): حركة => {
    const مجموع_مدين = أعضاء.reduce((س, x) => س + x.مدين, 0);
    const مجموع_دائن = أعضاء.reduce((س, x) => س + x.دائن, 0);
    return {
      ...أعضاء[0],
      id: -(1_000_000_000 + مفتاح), // مفتاح صف اصطناعي فريد
      البيان: `${أعضاء.length} شيكات ${مجموع_مدين > 0 ? "مُظهَّرة سداداً للمورد" : "واردة من العميل"}`,
      مدين: مجموع_مدين,
      دائن: مجموع_دائن,
      الرصيد_بعد_الحركة: أعضاء[0].الرصيد_بعد_الحركة, // الرصيد بعد أحدث حركة في المجموعة
      مجموعة_شيكات: أعضاء.map((x) => x.شيك_مرتبط!).filter(Boolean),
    };
  };
  const مفتاح_شيك = (ح: حركة): string | null => (ح.شيك_مرتبط ? String(ح.شيك_مرتبط.معرف_معاملة ?? "قديم") : null);
  const حركات_معروضة: حركة[] = [];
  for (let i = 0; i < حركات_مفلترة.length; ) {
    const ح = حركات_مفلترة[i];
    const مفتاح = مفتاح_شيك(ح);
    if (مفتاح != null) {
      // اجمع الصفوف المتتالية بنفس مفتاح المعاملة
      const مجموعة: حركة[] = [];
      let j = i;
      while (j < حركات_مفلترة.length && مفتاح_شيك(حركات_مفلترة[j]) === مفتاح) { مجموعة.push(حركات_مفلترة[j]); j++; }
      حركات_معروضة.push(مجموعة.length >= 2 ? بناء_مجموعة(مجموعة, مجموعة[0].id) : ح);
      i = j;
      continue;
    }
    حركات_معروضة.push(ح);
    i++;
  }

  function تبديل_تحديد(id: number) {
    تعيين_محددة((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });
  }

  const صفوف_قابلة_للتحديد = حركات_معروضة.filter((ح) => !ح.مجموعة_شيكات);
  function تحديد_الكل() {
    if (محددة.size === صفوف_قابلة_للتحديد.length && صفوف_قابلة_للتحديد.length > 0) {
      تعيين_محددة(new Set());
    } else {
      تعيين_محددة(new Set(صفوف_قابلة_للتحديد.map((ح) => ح.id)));
    }
  }

  const كل_محدد =
    صفوف_قابلة_للتحديد.length > 0 && محددة.size === صفوف_قابلة_للتحديد.length;

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
      خلية: (ص) =>
        ص.مجموعة_شيكات ? null : (
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
    {
      المفتاح: "البيان",
      العنوان: t("ledger.col.statement"),
      خلية: (ص) =>
        ص.مجموعة_شيكات ? (
          <button
            type="button"
            onClick={() => تعيين_تفاصيل_مجموعة(ص.مجموعة_شيكات!)}
            className="inline-flex items-center gap-1.5 rounded-md border border-primary-blue/30 bg-primary-blue/5 px-2 py-1 text-primary-blue hover:bg-primary-blue/10"
            title="عرض تفاصيل الشيكات"
          >
            <ReceiptText className="size-3.5" />
            <span>{ص.البيان}</span>
            <span className="rounded bg-primary-blue/15 px-1.5 text-[11px] font-semibold">{ص.مجموعة_شيكات!.length}</span>
          </button>
        ) : (
          <span>{ص.البيان}</span>
        ),
    },
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
          <الزر variant="blue" onClick={() => تعيين_دفعة_موزعة(true)}>
            <Layers className="size-4" />
            دفعة موزّعة
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
          // الصف المجمّع (شيكات مُظهَّرة) للعرض فقط — التعديل من موديول الشيكات
          if (ص.مجموعة_شيكات) return null;
          // في وضع التحديد الجماعي (أكثر من صف) → زر حذف فقط لكل صف
          // دالة الحذف حسب نوع الصف
          const على_الحذف = () => {
            if (ص.معرف_الفاتورة) احذف(ص.id, () => حذف_فاتورة(ص.معرف_الفاتورة!));
            else if (ص.معرف_خزنة) احذف(ص.id, () => حذف_حركة_مرتبطة_بخزنة(ص.id));
            else احذف(ص.id, () => حذف_حركة(ص.id));
          };

          if (محددة.size > 1) {
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
                <الزر size="sm" variant="ghost" title="حذف الفاتورة" onClick={على_الحذف}>
                  <Trash2 className="size-4 text-danger" />
                </الزر>
              </div>
            );
          }
          if (ص.معرف_دفع_مباشر) {
            return (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground bg-appgray rounded px-1">مباشر</span>
                <الزر size="sm" variant="ghost" onClick={() => تعيين_تعديل_دفع(ص)} title="تعديل الدفع المباشر">
                  <Pencil className="size-4 text-primary" />
                </الزر>
                <الزر size="sm" variant="ghost" onClick={على_الحذف} title="حذف وعكس من الكل">
                  <Trash2 className="size-4 text-danger" />
                </الزر>
              </div>
            );
          }
          if (ص.معرف_دفعة_موزعة) {
            return (
              <div className="flex items-center gap-1">
                <span className="text-[10px] text-muted-foreground bg-appgray rounded px-1">موزّعة</span>
                <الزر size="sm" variant="ghost" onClick={() => تعيين_تعديل_موزعة(ص.معرف_دفعة_موزعة)} title="تعديل الدفعة الموزّعة">
                  <Pencil className="size-4 text-primary" />
                </الزر>
                <الزر size="sm" variant="ghost" onClick={على_الحذف} title="حذف وعكس كل الحركات">
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
                <الزر size="sm" variant="ghost" onClick={على_الحذف} title="حذف وعكس من الخزنة">
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
              <الزر size="sm" variant="ghost" onClick={على_الحذف} title="حذف">
                <Trash2 className="size-4 text-danger" />
              </الزر>
            </div>
          );
        }}
      />

      {تفاصيل_مجموعة && (
        <حوار_تفاصيل_الشيكات_المجمّعة
          الشيكات={تفاصيل_مجموعة}
          نوع_الطرف={الطرف.النوع}
          معرف_الطرف={الطرف.id}
          عند_الإغلاق={() => تعيين_تفاصيل_مجموعة(null)}
        />
      )}
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
      {تعديل_دفع && (
        <حوار_تعديل_دفع_مباشر
          الحركة={تعديل_دفع}
          حسابات_الخزنة={حسابات_الخزنة}
          حسابات_فرعية={حسابات_فرعية}
          عند_الإغلاق={() => تعيين_تعديل_دفع(null)}
        />
      )}
      {(دفعة_موزعة || تعديل_موزعة != null) && (
        <حوار_دفعة_موزعة
          الطرف={الطرف}
          حسابات_الخزنة={حسابات_الخزنة}
          حسابات_فرعية={حسابات_فرعية}
          معرف_للتعديل={تعديل_موزعة}
          عند_الإغلاق={() => { تعيين_دفعة_موزعة(false); تعيين_تعديل_موزعة(null); }}
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

// ─── حوار الدفعة الموزّعة (إجمالي واحد موزّع على عدة وسائل/حسابات) ───────────
type بند_موزّع = { معرف_محلي: number; حساب: string; حساب_فرعي: string; مبلغ: string };

function حوار_دفعة_موزعة({
  الطرف,
  حسابات_الخزنة,
  حسابات_فرعية,
  معرف_للتعديل,
  عند_الإغلاق,
}: {
  الطرف: { id: number; النوع: PartyType };
  حسابات_الخزنة: { id: number; النوع: TreasuryAccountType; التسمية: string }[];
  حسابات_فرعية: خريطة_حسابات_فرعية;
  معرف_للتعديل: number | null;
  عند_الإغلاق: () => void;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const عداد = React.useRef(0);
  const بند_جديد = React.useCallback((): بند_موزّع => ({
    معرف_محلي: ++عداد.current,
    حساب: حسابات_الخزنة[0] ? String(حسابات_الخزنة[0].id) : "",
    حساب_فرعي: "",
    مبلغ: "",
  }), [حسابات_الخزنة]);

  const [تاريخ, تعيين_تاريخ] = React.useState(اليوم());
  const [بيان, تعيين_بيان] = React.useState("");
  const [بنود, تعيين_بنود] = React.useState<بند_موزّع[]>(() => [بند_جديد()]);
  const [جارٍ, تعيين_جارٍ] = React.useState(false);
  const [يحمّل, تعيين_يحمّل] = React.useState(معرف_للتعديل != null);

  // وضع التعديل: حمّل بيانات المجموعة
  React.useEffect(() => {
    if (معرف_للتعديل == null) return;
    (async () => {
      const r = await اجلب_دفعة_موزعة(معرف_للتعديل);
      if (r.نجاح && r.بيانات) {
        تعيين_تاريخ(r.بيانات.التاريخ);
        تعيين_بيان(r.بيانات.البيان ?? "");
        تعيين_بنود(
          r.بيانات.بنود.map((ب) => ({
            معرف_محلي: ++عداد.current,
            حساب: String(ب.معرف_الحساب),
            حساب_فرعي: ب.معرف_حساب_فرعي ? String(ب.معرف_حساب_فرعي) : "",
            مبلغ: String(ب.المبلغ),
          }))
        );
      } else {
        إشعار.خطأ(r.رسالة ?? "تعذّر تحميل الدفعة");
        عند_الإغلاق();
      }
      تعيين_يحمّل(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [معرف_للتعديل]);

  // الإجمالي يُحسب تلقائياً من مجموع البنود (لا يُدخله المستخدم)
  const مجموع = بنود.reduce((س, ب) => س + (Number(ب.مبلغ.replace(/,/g, "")) || 0), 0);
  const صالح = مجموع > 0;

  function حدّث_بند(معرف_محلي: number, تعديل: Partial<بند_موزّع>) {
    تعيين_بنود((س) => س.map((ب) => (ب.معرف_محلي === معرف_محلي ? { ...ب, ...تعديل } : ب)));
  }
  function نوع_حساب(معرف: string) {
    return حسابات_الخزنة.find((h) => h.id === Number(معرف))?.النوع ?? null;
  }

  async function حفظ() {
    if (!صالح) return إشعار.خطأ("أدخل مبلغاً في بند واحد على الأقل");
    // تحقق من الحسابات الفرعية الإجبارية
    for (const ب of بنود) {
      const نوع = نوع_حساب(ب.حساب);
      if (نوع && نوع !== "CASH") {
        const خيارات = حسابات_فرعية[نوع] ?? [];
        if (خيارات.length > 0 && !ب.حساب_فرعي) {
          return إشعار.خطأ(`اختر ${تسمية_فرعي(نوع)} لكل بند من نوع ${تسمية_فرعي(نوع)}`);
        }
      }
    }
    تعيين_جارٍ(true);
    const payload = {
      معرف_الطرف: الطرف.id,
      التاريخ: تاريخ,
      الإجمالي: String(مجموع),
      البيان: بيان || null,
      بنود: بنود.map((ب) => ({
        معرف_الحساب: Number(ب.حساب),
        معرف_حساب_فرعي: ب.حساب_فرعي ? Number(ب.حساب_فرعي) : null,
        المبلغ: ب.مبلغ.replace(/,/g, ""),
      })),
    };
    const r = معرف_للتعديل != null
      ? await تعديل_دفعة_موزعة(معرف_للتعديل, payload)
      : await سجل_دفعة_موزعة(payload);
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
            <Layers className="size-5 text-primary" />
            {معرف_للتعديل != null ? "تعديل دفعة موزّعة" : "دفعة موزّعة"}
            {" — "}
            {الطرف.النوع === "CUSTOMER" ? "تحصيل من العميل" : "صرف للمورد"}
          </عنوان_الحوار>
        </رأس_الحوار>

        {يحمّل ? (
          <p className="py-6 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : (
          <>
            <div className="space-y-1.5">
              <العنوان مطلوب>التاريخ</العنوان>
              <منتقي_تاريخ القيمة={تاريخ} عند_التغيير={تعيين_تاريخ} />
            </div>

            {/* بنود التوزيع */}
            <div className="mt-3 space-y-2">
              <div className="flex items-center justify-between">
                <العنوان className="mb-0">توزيع المبلغ على الوسائل</العنوان>
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
                      <span className="text-[11px] text-muted-foreground">الوسيلة</span>
                      <قائمة_اختيار
                        الخيارات={حسابات_الخزنة.map((a) => ({ القيمة: String(a.id), التسمية: a.التسمية }))}
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

            {/* الإجمالي التلقائي (مجموع البنود) */}
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
                {جارٍ ? "جارٍ الحفظ…" : معرف_للتعديل != null ? "حفظ التعديل" : "تأكيد الدفعة"}
              </الزر>
              <الزر variant="outline" onClick={عند_الإغلاق}>إلغاء</الزر>
            </تذييل_الحوار>
          </>
        )}
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

function حوار_تعديل_دفع_مباشر({
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

  async function حفظ() {
    تعيين_جارٍ(true);
    const r = await تعديل_دفع_مباشر(الحركة.id, {
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
            <العنوان مطلوب>{t("pay.account")}</العنوان>
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
            <العنوان>{t("ledger.col.statement")}</العنوان>
            <الحقل value={بيان} onChange={(e) => تعيين_بيان(e.target.value)} />
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

/** نافذة تفاصيل الشيكات المُجمّعة في صف واحد بحساب الطرف — إضافة/إزالة شيكات من المعاملة (مورد: تظهير، عميل: استلام). */
function حوار_تفاصيل_الشيكات_المجمّعة({
  الشيكات,
  نوع_الطرف,
  معرف_الطرف,
  عند_الإغلاق,
}: {
  الشيكات: معلومة_شيك_قيد[];
  نوع_الطرف?: PartyType;
  معرف_الطرف?: number;
  عند_الإغلاق: () => void;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  // ترتيب شيكات المعاملة بتاريخ الاستحقاق (تصاعدياً) للعرض
  const رتّب = (ل: معلومة_شيك_قيد[]) => [...ل].sort((a, b) => a.تاريخ_الاستحقاق.localeCompare(b.تاريخ_الاستحقاق));
  const [قائمة, تعيين_قائمة] = React.useState<معلومة_شيك_قيد[]>(() => رتّب(الشيكات));
  const [إزالة, تعيين_إزالة] = React.useState<معلومة_شيك_قيد | null>(null);
  const [إضافة, تعيين_إضافة] = React.useState(false);
  const إجمالي = قائمة.reduce((س, ش) => س + ش.المبلغ, 0);

  const مورد = نوع_الطرف === "SUPPLIER";
  const يدعم = معرف_الطرف != null && (نوع_الطرف === "SUPPLIER" || نوع_الطرف === "CUSTOMER");
  const حالة_قابلة_للإزالة = مورد ? "ENDORSED" : "REGISTERED"; // مورد: مظهّر → يرجع لليد؛ عميل: مسجّل → يُفكّ من العميل
  const حالة_المضاف = مورد ? "ENDORSED" : "REGISTERED";
  const نص_زر_الإزالة = مورد ? "إرجاع لليد" : "إزالة من العميل";
  const عنوان_الإزالة = مورد ? "إزالة الشيك من المعاملة (إرجاع لليد)" : "إزالة الشيك من حساب العميل";
  const وصف_الإزالة = (ش: معلومة_شيك_قيد) => مورد
    ? `سيرجع الشيك ${ش.رقم_الشيك ? "رقم " + ش.رقم_الشيك : ""} لليد (كأنه لم يُظهَّر للمورد): يزيد مستحق المورد بقيمته ويصبح متاحاً. دين العميل لا يتغيّر.`
    : `سيُزال الشيك ${ش.رقم_الشيك ? "رقم " + ش.رقم_الشيك : ""} من حساب العميل: يزيد دين العميل بقيمته ويصبح الشيك غير مرتبط بعميل (متاح لإسناده لعميل آخر). الشيك لا يُمسح.`;

  return (
    <>
      <الحوار open onOpenChange={(o) => !o && عند_الإغلاق()}>
        <محتوى_الحوار className="max-w-3xl">
          <رأس_الحوار>
            <عنوان_الحوار>
              تفاصيل الشيكات ({قائمة.length}) — الإجمالي <نص_مبلغ القيمة={إجمالي} />
            </عنوان_الحوار>
          </رأس_الحوار>
          <div className="max-h-[60vh] overflow-auto">
            <table className="w-full text-sm">
              <thead className="sticky top-0 bg-appgray text-muted-foreground">
                <tr className="text-start">
                  <th className="px-3 py-2 text-start font-medium">#</th>
                  <th className="px-3 py-2 text-start font-medium">رقم الشيك</th>
                  <th className="px-3 py-2 text-start font-medium">المدين / محوّل من</th>
                  <th className="px-3 py-2 text-start font-medium">البنك</th>
                  <th className="px-3 py-2 text-start font-medium">الاستحقاق</th>
                  <th className="px-3 py-2 text-start font-medium">الحالة</th>
                  <th className="px-3 py-2 text-end font-medium">المبلغ</th>
                  {يدعم && <th className="px-3 py-2 text-end font-medium">إجراء</th>}
                </tr>
              </thead>
              <tbody>
                {قائمة.map((ش, i) => (
                  <tr key={ش.id} className="border-t border-border">
                    <td className="px-3 py-2 text-muted-foreground">{i + 1}</td>
                    <td className="px-3 py-2 ltr-nums">{ش.رقم_الشيك || "—"}</td>
                    <td className="px-3 py-2">
                      <span className="inline-flex items-center gap-1.5">
                        {ش.محول_من || ش.اسم_المدين}
                        {ش.افتتاحي && (
                          <span className="rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800 border border-amber-300">افتتاحي</span>
                        )}
                      </span>
                    </td>
                    <td className="px-3 py-2">{ش.اسم_البنك || "—"}</td>
                    <td className="px-3 py-2"><نص_تاريخ القيمة={ش.تاريخ_الاستحقاق} /></td>
                    <td className="px-3 py-2">{تسمية_حالة_الشيك[ش.الحالة as keyof typeof تسمية_حالة_الشيك] ?? ش.الحالة}</td>
                    <td className="px-3 py-2 text-end"><نص_مبلغ القيمة={ش.المبلغ} مع_العملة={false} /></td>
                    {يدعم && (
                      <td className="px-3 py-2 text-end">
                        {ش.الحالة === حالة_قابلة_للإزالة ? (
                          <الزر size="sm" variant="ghost" title={عنوان_الإزالة} onClick={() => تعيين_إزالة(ش)}>
                            <Undo2 className="size-4 text-danger" />
                          </الزر>
                        ) : (
                          <span className="text-muted-foreground">—</span>
                        )}
                      </td>
                    )}
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border font-semibold">
                  <td className="px-3 py-2" colSpan={6}>الإجمالي</td>
                  <td className="px-3 py-2 text-end"><نص_مبلغ القيمة={إجمالي} مع_العملة={false} /></td>
                  {يدعم && <td />}
                </tr>
              </tfoot>
            </table>
          </div>
          <تذييل_الحوار>
            {/* الإضافة للتظهير (المورد) فقط — عند العميل الاستلام يتم بتسجيل الشيك نفسه */}
            {مورد && (
              <الزر variant="success" onClick={() => تعيين_إضافة(true)}>
                <Plus className="size-4" /> إضافة شيك للمعاملة
              </الزر>
            )}
            {معرف_الطرف != null && قائمة.length > 0 && (
              <الزر
                variant="blue"
                onClick={() =>
                  window.open(
                    `/cheque-report?ids=${قائمة.map((x) => x.id).join(",")}&party=${معرف_الطرف}&type=${نوع_الطرف ?? ""}`,
                    "_blank",
                    "noopener"
                  )
                }
              >
                <FileText className="size-4" /> تقرير
              </الزر>
            )}
            <الزر variant="outline" onClick={عند_الإغلاق}>إغلاق</الزر>
          </تذييل_الحوار>
        </محتوى_الحوار>
      </الحوار>

      {إضافة && مورد && معرف_الطرف != null && نوع_الطرف && (
        <حوار_إضافة_شيكات_للمعاملة
          نوع_الطرف={نوع_الطرف}
          معرف_الطرف={معرف_الطرف}
          معرف_معاملة={قائمة[0]?.معرف_معاملة ?? null}
          معرفات_المعاملة={قائمة.map((x) => x.id)}
          عند_الإلغاء={() => تعيين_إضافة(false)}
          عند_الإضافة={(مضافة, معرف_معاملة_ناتج) => {
            تعيين_قائمة((ح) => رتّب([
              ...ح.map((x) => ({ ...x, معرف_معاملة: معرف_معاملة_ناتج })),
              ...مضافة.map((m) => ({
                id: m.id,
                المبلغ: m.المبلغ,
                رقم_الشيك: m.رقم_الشيك,
                تاريخ_الاستحقاق: m.تاريخ_الاستحقاق,
                اسم_المدين: m.الاسم,
                محول_من: m.الاسم,
                اسم_البنك: m.اسم_البنك,
                افتتاحي: m.افتتاحي,
                الحالة: حالة_المضاف,
                معرف_معاملة: معرف_معاملة_ناتج,
              })),
            ]));
            تعيين_إضافة(false);
            router.refresh();
          }}
        />
      )}

      {إزالة && (
        <حوار_تأكيد
          مفتوح
          خطر={false}
          عند_التغيير={(o) => !o && تعيين_إزالة(null)}
          العنوان={عنوان_الإزالة}
          الوصف={وصف_الإزالة(إزالة)}
          نص_التأكيد={نص_زر_الإزالة}
          عند_التأكيد={async () => {
            const r = مورد ? await أرجع_شيك_مظهّر(إزالة.id) : await أرجع_شيك_من_عميل(إزالة.id);
            if (!r.نجاح) { إشعار.خطأ(r.رسالة); return; }
            إشعار.نجاح(r.رسالة || "تمت الإزالة");
            const باقٍ = قائمة.filter((x) => x.id !== إزالة.id);
            تعيين_قائمة(باقٍ);
            تعيين_إزالة(null);
            router.refresh();
            if (باقٍ.length === 0) عند_الإغلاق();
          }}
        />
      )}
    </>
  );
}

type شيك_متاح_للتظهير = { id: number; المبلغ: number; الاسم: string; رقم_الشيك: string | null; اسم_البنك: string | null; تاريخ_الاستحقاق: string; افتتاحي: boolean };

/** اختيار شيكات متاحة وإضافتها لمعاملة الطرف (مورد: تظهير له وخروجها من اليد؛ عميل: إسناد استلام منه). */
function حوار_إضافة_شيكات_للمعاملة({
  نوع_الطرف,
  معرف_الطرف,
  معرف_معاملة,
  معرفات_المعاملة,
  عند_الإلغاء,
  عند_الإضافة,
}: {
  نوع_الطرف: PartyType;
  معرف_الطرف: number;
  معرف_معاملة: number | null;
  معرفات_المعاملة: number[];
  عند_الإلغاء: () => void;
  عند_الإضافة: (مضافة: شيك_متاح_للتظهير[], معرف_معاملة_ناتج: number) => void;
}) {
  const إشعار = useإشعار();
  const مورد = نوع_الطرف === "SUPPLIER";
  const [متاحة, تعيين_متاحة] = React.useState<شيك_متاح_للتظهير[]>([]);
  const [محمّل, تعيين_محمّل] = React.useState(false);
  const [مختارة, تعيين_مختارة] = React.useState<Set<number>>(new Set());
  const [بحث, تعيين_بحث] = React.useState("");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  React.useEffect(() => {
    let ملغى = false;
    (async () => {
      const r = مورد ? await اجلب_شيكات_متاحة_للتظهير() : await اجلب_شيكات_متاحة_للإسناد();
      if (ملغى) return;
      if (r.نجاح && r.بيانات) {
        const موجودة = new Set(معرفات_المعاملة);
        تعيين_متاحة(r.بيانات.الشيكات.filter((ش) => !موجودة.has(ش.id)));
      } else if (!r.نجاح) إشعار.خطأ(r.رسالة);
      تعيين_محمّل(true);
    })();
    return () => { ملغى = true; };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const طبّع = (s: string) => s.toLowerCase().replace(/[إأآا]/g, "ا").replace(/ى/g, "ي").replace(/ة/g, "ه").replace(/\s+/g, "");
  const مفلترة = بحث.trim()
    ? متاحة.filter((ش) => طبّع(`${ش.الاسم} ${ش.رقم_الشيك ?? ""} ${ش.اسم_البنك ?? ""}`).includes(طبّع(بحث)))
    : متاحة;
  const مجموع_المختار = متاحة.filter((ش) => مختارة.has(ش.id)).reduce((س, ش) => س + ش.المبلغ, 0);
  const بدّل = (id: number) => تعيين_مختارة((p) => { const n = new Set(p); n.has(id) ? n.delete(id) : n.add(id); return n; });

  async function أضف() {
    if (مختارة.size === 0) { إشعار.خطأ("اختر شيكاً واحداً على الأقل"); return; }
    تعيين_جارٍ(true);
    const r = مورد
      ? await ظهّر_شيكات_لمورد(معرف_الطرف, [...مختارة], معرف_معاملة, معرفات_المعاملة)
      : await اربط_شيكات_بعميل(معرف_الطرف, [...مختارة], معرف_معاملة, معرفات_المعاملة);
    تعيين_جارٍ(false);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    إشعار.نجاح(r.رسالة || "تمت الإضافة");
    عند_الإضافة(متاحة.filter((ش) => مختارة.has(ش.id)), r.بيانات!.معرف_معاملة);
  }

  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإلغاء()}>
      <محتوى_الحوار className="max-w-2xl">
        <رأس_الحوار>
          <عنوان_الحوار>{مورد ? "إضافة شيكات للمعاملة (تظهير للمورد)" : "إضافة شيكات للمعاملة (استلام من العميل)"}</عنوان_الحوار>
        </رأس_الحوار>
        <div className="space-y-2">
          <الحقل placeholder="بحث بالاسم / رقم الشيك / البنك…" value={بحث} onChange={(e) => تعيين_بحث(e.target.value)} />
          <div className="max-h-[50vh] overflow-auto rounded-lg border border-border">
            {!محمّل ? (
              <div className="p-4 text-center text-muted-foreground">جارٍ التحميل…</div>
            ) : مفلترة.length === 0 ? (
              <div className="p-4 text-center text-muted-foreground">{مورد ? "لا توجد شيكات متاحة في اليد" : "لا توجد شيكات متاحة غير مرتبطة بعميل"}</div>
            ) : (
              <table className="w-full text-sm">
                <tbody>
                  {مفلترة.map((ش) => (
                    <tr key={ش.id} className="border-b border-border last:border-0 hover:bg-appgray cursor-pointer" onClick={() => بدّل(ش.id)}>
                      <td className="px-2 py-2 w-8"><input type="checkbox" checked={مختارة.has(ش.id)} onChange={() => بدّل(ش.id)} className="size-4" /></td>
                      <td className="px-2 py-2 ltr-nums">{ش.رقم_الشيك || "—"}</td>
                      <td className="px-2 py-2">
                        <span className="inline-flex items-center gap-1.5">
                          {ش.الاسم}
                          {ش.افتتاحي && <span className="rounded bg-amber-100 px-1 text-[10px] font-medium text-amber-800 border border-amber-300">افتتاحي</span>}
                        </span>
                      </td>
                      <td className="px-2 py-2">{ش.اسم_البنك || "—"}</td>
                      <td className="px-2 py-2"><نص_تاريخ القيمة={ش.تاريخ_الاستحقاق} /></td>
                      <td className="px-2 py-2 text-end"><نص_مبلغ القيمة={ش.المبلغ} مع_العملة={false} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </div>
          <div className="flex items-center justify-between text-sm">
            <span className="text-muted-foreground">المختار: {مختارة.size} شيك</span>
            <span className="font-semibold">الإجمالي المضاف: <نص_مبلغ القيمة={مجموع_المختار} /></span>
          </div>
        </div>
        <تذييل_الحوار>
          <الزر variant="success" onClick={أضف} disabled={جارٍ || مختارة.size === 0}>
            {جارٍ ? "جارٍ الإضافة..." : `إضافة (${مختارة.size})`}
          </الزر>
          <الزر variant="outline" onClick={عند_الإلغاء}>إلغاء</الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}
