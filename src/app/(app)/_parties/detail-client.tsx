"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, HandCoins, Trash2 } from "lucide-react";
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
import { سجل_دفعة, أضف_حركة_يدوية, حذف_حركة } from "./actions";

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
  مرتبط: boolean; // مرتبط بفاتورة/خزنة → لا يُحذف يدوياً
};

const اليوم = () => new Date().toISOString().slice(0, 10);

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
  const [دفعة, تعيين_دفعة] = React.useState(false);
  const [يدوية, تعيين_يدوية] = React.useState(false);
  const [حذف, تعيين_حذف] = React.useState<حركة | null>(null);

  const أعمدة: عمود<حركة>[] = [
    {
      المفتاح: "التاريخ",
      العنوان: "التاريخ",
      خلية: (ص) => <نص_تاريخ القيمة={ص.التاريخ} />,
      قيمة: (ص) => ص.التاريخ,
      قابل_للفرز: true,
    },
    {
      المفتاح: "رقم_المستند",
      العنوان: "المستند/الفاتورة",
      خلية: (ص) => <span className="ltr-nums">{ص.رقم_المستند || "—"}</span>,
      مخفي_موبايل: true,
    },
    { المفتاح: "البيان", العنوان: "البيان" },
    {
      المفتاح: "الكمية",
      العنوان: "الكمية",
      خلية: (ص) => (ص.الكمية != null ? <span className="ltr-nums">{ص.الكمية}</span> : "—"),
      مخفي_موبايل: true,
    },
    {
      المفتاح: "مدين",
      العنوان: "مدين",
      محاذاة: "end",
      خلية: (ص) => (ص.مدين ? <نص_مبلغ القيمة={ص.مدين} مع_العملة={false} /> : "—"),
    },
    {
      المفتاح: "دائن",
      العنوان: "دائن",
      محاذاة: "end",
      خلية: (ص) => (ص.دائن ? <نص_مبلغ القيمة={ص.دائن} مع_العملة={false} /> : "—"),
    },
    {
      المفتاح: "الرصيد_بعد_الحركة",
      العنوان: "الرصيد بعد الحركة",
      محاذاة: "end",
      خلية: (ص) => <نص_مبلغ القيمة={ص.الرصيد_بعد_الحركة} مع_العملة={false} />,
    },
  ];

  return (
    <>
      <div className="mb-4 flex flex-wrap justify-end gap-2">
        <الزر variant="success" onClick={() => تعيين_دفعة(true)}>
          <HandCoins className="size-4" />
          {الطرف.النوع === "CUSTOMER" ? "تحصيل دفعة" : "صرف دفعة"}
        </الزر>
        <الزر variant="outline" onClick={() => تعيين_يدوية(true)}>
          <Plus className="size-4" /> حركة يدوية
        </الزر>
      </div>

      <جدول_بيانات
        الأعمدة={أعمدة}
        البيانات={الحركات}
        مفتاح_الصف={(ص) => ص.id}
        بحث={false}
        رسالة_فراغ="لا توجد حركات بعد"
        إجراءات_الصف={(ص) =>
          ص.مرتبط ? (
            <span className="text-xs text-muted-foreground">مرتبطة</span>
          ) : (
            <الزر size="sm" variant="ghost" onClick={() => تعيين_حذف(ص)}>
              <Trash2 className="size-4 text-danger" />
            </الزر>
          )
        }
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
        <حوار_حركة_يدوية الطرف={الطرف} عند_الإغلاق={() => تعيين_يدوية(false)} />
      )}
      {حذف && (
        <حوار_تأكيد
          مفتوح
          عند_التغيير={(o) => !o && تعيين_حذف(null)}
          العنوان="حذف الحركة"
          الوصف="سيُعاد حساب رصيد الطرف بعد الحذف."
          عند_التأكيد={async () => {
            const r = await حذف_حركة(حذف.id);
            r.نجاح ? إشعار.نجاح(r.رسالة!) : إشعار.خطأ(r.رسالة);
            if (r.نجاح) router.refresh();
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
            {الطرف.النوع === "CUSTOMER" ? "تحصيل دفعة من العميل" : "صرف دفعة للمورد"}
          </عنوان_الحوار>
        </رأس_الحوار>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <العنوان مطلوب>التاريخ</العنوان>
            <الحقل type="date" value={تاريخ} onChange={(e) => تعيين_تاريخ(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>المبلغ</العنوان>
            <الحقل autoFocus selectOnFocus value={مبلغ} onChange={(e) => تعيين_مبلغ(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>طريقة الدفع</العنوان>
            <قائمة_اختيار
              الخيارات={طرق_الدفع.map((m) => ({ القيمة: m, التسمية: m }))}
              القيمة={طريقة}
              عند_التغيير={تعيين_طريقة}
              قابل_للبحث={false}
            />
          </div>
          <div className="space-y-1.5">
            <العنوان>حساب الخزنة</العنوان>
            <قائمة_اختيار
              الخيارات={حسابات_الخزنة.map((a) => ({ القيمة: String(a.id), التسمية: a.التسمية }))}
              القيمة={حساب}
              عند_التغيير={تعيين_حساب}
              قابل_للبحث={false}
            />
            <p className="text-xs text-muted-foreground">
              يُربط بالخزنة تلقائياً في المرحلة 9.
            </p>
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <العنوان>رقم الفاتورة (اختياري)</العنوان>
            <الحقل className="ltr-nums" value={رقم} onChange={(e) => تعيين_رقم(e.target.value)} />
          </div>
        </div>
        <تذييل_الحوار>
          <الزر variant="success" onClick={حفظ} disabled={جارٍ}>
            {جارٍ ? "جارٍ الحفظ…" : "حفظ"}
          </الزر>
          <الزر variant="outline" onClick={عند_الإغلاق}>
            إلغاء
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
          <عنوان_الحوار>حركة يدوية (رصيد افتتاحي / تسوية)</عنوان_الحوار>
        </رأس_الحوار>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <العنوان مطلوب>التاريخ</العنوان>
            <الحقل type="date" value={تاريخ} onChange={(e) => تعيين_تاريخ(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>البيان</العنوان>
            <الحقل autoFocus value={بيان} onChange={(e) => تعيين_بيان(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <العنوان>مدين</العنوان>
            <الحقل selectOnFocus value={مدين} onChange={(e) => تعيين_مدين(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <العنوان>دائن</العنوان>
            <الحقل selectOnFocus value={دائن} onChange={(e) => تعيين_دائن(e.target.value)} placeholder="0.00" />
          </div>
        </div>
        <تذييل_الحوار>
          <الزر variant="success" onClick={حفظ} disabled={جارٍ}>
            {جارٍ ? "جارٍ الحفظ…" : "حفظ"}
          </الزر>
          <الزر variant="outline" onClick={عند_الإغلاق}>
            إلغاء
          </الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}
