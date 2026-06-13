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
import { حوار_تأكيد } from "@/components/confirm-dialog";
import { useإشعار } from "@/components/ui/toast";
import { تسمية_نوع_الحركة } from "@/lib/enums";
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
      العنوان: "التاريخ",
      خلية: (ص) => <نص_تاريخ القيمة={ص.التاريخ} />,
      قيمة: (ص) => ص.التاريخ,
      قابل_للفرز: true,
    },
    {
      المفتاح: "النوع",
      العنوان: "النوع",
      خلية: (ص) => <شارة_حالة الحالة={تسمية_نوع_الحركة[ص.النوع]} />,
    },
    { المفتاح: "الحساب", العنوان: "الحساب" },
    { المفتاح: "البيان", العنوان: "البيان" },
    {
      المفتاح: "الطرف",
      العنوان: "الطرف",
      خلية: (ص) => ص.الطرف || "—",
      مخفي_موبايل: true,
    },
    {
      المفتاح: "المبلغ",
      العنوان: "المبلغ",
      محاذاة: "end",
      قيمة: (ص) => ص.المبلغ,
      قابل_للفرز: true,
      خلية: (ص) => (
        <نص_مبلغ القيمة={ص.المبلغ} النوع={ص.النوع === "INCOME" ? "إيراد" : "مصروف"} مع_العملة={false} />
      ),
    },
    {
      المفتاح: "الرصيد_بعد_الحركة",
      العنوان: "الرصيد بعد الحركة",
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
                  <AlertTriangle className="size-3.5" /> تحت الحد الأدنى
                </p>
              )}
            </div>
          );
        })}
        <div className="card-soft border-primary/30 bg-primary/5 p-5">
          <div className="flex items-start justify-between">
            <p className="text-sm text-muted-foreground">إجمالي الخزنة</p>
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
          <Plus className="size-4" /> تسجيل حركة
        </الزر>
        <div className="min-w-40 space-y-1.5">
          <العنوان>تصفية: الحساب</العنوان>
          <قائمة_اختيار
            الخيارات={[
              { القيمة: "", التسمية: "كل الحسابات" },
              ...الحسابات.map((h) => ({ القيمة: String(h.id), التسمية: h.التسمية })),
            ]}
            القيمة={فلتر_حساب}
            عند_التغيير={تعيين_فلتر_حساب}
            قابل_للبحث={false}
          />
        </div>
        <div className="min-w-40 space-y-1.5">
          <العنوان>تصفية: النوع</العنوان>
          <قائمة_اختيار
            الخيارات={[
              { القيمة: "", التسمية: "الكل" },
              { القيمة: "INCOME", التسمية: "إيراد" },
              { القيمة: "EXPENSE", التسمية: "مصروف" },
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
        رسالة_فراغ="لا توجد حركات"
        إجراءات_الصف={(ص) =>
          ص.مرتبط ? (
            <span className="text-xs text-muted-foreground">مرتبطة بطرف</span>
          ) : (
            <div className="flex justify-end gap-1">
              <الزر size="sm" variant="ghost" onClick={() => تعيين_نموذج({ حركة: ص })}>
                <Pencil className="size-4" />
              </الزر>
              <الزر size="sm" variant="ghost" onClick={() => تعيين_حذف(ص)}>
                <Trash2 className="size-4 text-danger" />
              </الزر>
            </div>
          )
        }
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
          العنوان="حذف الحركة"
          الوصف="سيُعاد حساب رصيد الحساب والإجمالي."
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
          <عنوان_الحوار>{الحركة ? "تعديل حركة خزنة" : "تسجيل حركة خزنة"}</عنوان_الحوار>
        </رأس_الحوار>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <العنوان مطلوب>التاريخ</العنوان>
            <الحقل type="date" value={تاريخ} onChange={(e) => تعيين_تاريخ(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>النوع</العنوان>
            <قائمة_اختيار
              الخيارات={[
                { القيمة: "INCOME", التسمية: "إيراد" },
                { القيمة: "EXPENSE", التسمية: "مصروف" },
              ]}
              القيمة={نوع}
              عند_التغيير={(v) => تعيين_نوع(v as TxnKind)}
              قابل_للبحث={false}
            />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>المبلغ</العنوان>
            <الحقل autoFocus selectOnFocus value={مبلغ} onChange={(e) => تعيين_مبلغ(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>الحساب</العنوان>
            <قائمة_اختيار
              الخيارات={الحسابات.map((h) => ({ القيمة: String(h.id), التسمية: h.التسمية }))}
              القيمة={حساب}
              عند_التغيير={تعيين_حساب}
              قابل_للبحث={false}
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <العنوان مطلوب>البيان</العنوان>
            <الحقل value={بيان} onChange={(e) => تعيين_بيان(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <العنوان>الطرف (اختياري)</العنوان>
            <قائمة_اختيار
              الخيارات={[
                { القيمة: "", التسمية: "بدون" },
                ...الأطراف.map((p) => ({ القيمة: String(p.id), التسمية: p.name })),
              ]}
              القيمة={طرف}
              عند_التغيير={تعيين_طرف}
            />
          </div>
          <div className="space-y-1.5">
            <العنوان>طريقة الدفع</العنوان>
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
