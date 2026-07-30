"use client";
import * as React from "react";
import Link from "next/link";
import { ArrowRight, Search, X } from "lucide-react";
import { ChequeStatus } from "@prisma/client";
import { الزر } from "@/components/ui/button";
import { العنوان } from "@/components/ui/label";
import { قائمة_اختيار } from "@/components/combobox";
import { منتقي_تاريخ } from "@/components/date-picker";
import { جدول_بيانات, type عمود } from "@/components/data-table";
import { بطاقة_مؤشر } from "@/components/kpi-card";
import { نص_مبلغ } from "@/components/money-text";
import { نص_تاريخ } from "@/components/date-text";
import { شارة_حالة } from "@/components/status-badge";
import { الشارة } from "@/components/ui/badge";
import { تسمية_حالة_الشيك } from "@/lib/enums";

type شيك = {
  id: number;
  رقم_الشيك: string | null;
  اسم_البنك: string | null;
  المدين: string;
  المستفيد: string | null;
  الاتجاه: "INCOMING" | "OUTGOING";
  الحالة: ChequeStatus;
  تاريخ_الاستحقاق: string; // ISO
  المبلغ: number;
};

const يوم_فقط = (iso: string) => iso.slice(0, 10);
const اليوم = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });

export function شاشة_استعلام_الشيكات({ البيانات }: { البيانات: شيك[] }) {
  const [من, تعيين_من] = React.useState("");
  const [إلى, تعيين_إلى] = React.useState("");
  const [حالة, تعيين_حالة] = React.useState<string>("");
  const [اتجاه, تعيين_اتجاه] = React.useState<string>("");

  const اليوم_str = اليوم();

  // لوحة الملخص: الشيكات المنتظرة (المستحقة) — ثابتة من كل البيانات
  const منتظرة = البيانات.filter((c) => c.الحالة === "PENDING");
  const وارد_منتظر = منتظرة.filter((c) => c.الاتجاه === "INCOMING");
  const صادر_منتظر = منتظرة.filter((c) => c.الاتجاه === "OUTGOING");
  const متأخرة = منتظرة.filter((c) => يوم_فقط(c.تاريخ_الاستحقاق) < اليوم_str);
  const مجموع = (قائمة: شيك[]) => قائمة.reduce((س, c) => س + c.المبلغ, 0);

  // النتائج المفلترة
  const مفلترة = React.useMemo(() => {
    return البيانات.filter((c) => {
      const d = يوم_فقط(c.تاريخ_الاستحقاق);
      if (من && d < من) return false;
      if (إلى && d > إلى) return false;
      if (حالة && c.الحالة !== حالة) return false;
      if (اتجاه && c.الاتجاه !== اتجاه) return false;
      return true;
    });
  }, [البيانات, من, إلى, حالة, اتجاه]);

  const إجمالي_المفلتر = مجموع(مفلترة);
  const فيه_فلتر = !!(من || إلى || حالة || اتجاه);

  const أعمدة: عمود<شيك>[] = [
    {
      المفتاح: "رقم_الشيك",
      العنوان: "رقم الشيك",
      خلية: (c) => <span className="ltr-nums">{c.رقم_الشيك || "—"}</span>,
    },
    { المفتاح: "اسم_البنك", العنوان: "البنك", خلية: (c) => <span>{c.اسم_البنك || "—"}</span> },
    {
      المفتاح: "المدين",
      العنوان: "العميل / المدين",
      خلية: (c) => <span>{c.الاتجاه === "OUTGOING" ? (c.المستفيد || c.المدين) : c.المدين}</span>,
    },
    {
      المفتاح: "الاتجاه",
      العنوان: "الاتجاه",
      خلية: (c) => (
        <الشارة variant={c.الاتجاه === "INCOMING" ? "success" : "navy"}>
          {c.الاتجاه === "INCOMING" ? "وارد (لك)" : "صادر (عليك)"}
        </الشارة>
      ),
    },
    {
      المفتاح: "الحالة",
      العنوان: "الحالة",
      خلية: (c) => <شارة_حالة الحالة={تسمية_حالة_الشيك[c.الحالة]} />,
    },
    {
      المفتاح: "تاريخ_الاستحقاق",
      العنوان: "تاريخ الاستحقاق",
      قابل_للفرز: true,
      قيمة: (c) => c.تاريخ_الاستحقاق,
      خلية: (c) => {
        const متأخر = c.الحالة === "PENDING" && يوم_فقط(c.تاريخ_الاستحقاق) < اليوم_str;
        return (
          <span className={متأخر ? "text-danger font-medium" : ""}>
            <نص_تاريخ القيمة={c.تاريخ_الاستحقاق} />
            {متأخر && <span className="mr-1 text-[11px]">(متأخر)</span>}
          </span>
        );
      },
    },
    {
      المفتاح: "المبلغ",
      العنوان: "المبلغ",
      قابل_للفرز: true,
      قيمة: (c) => c.المبلغ,
      محاذاة: "end",
      خلية: (c) => <نص_مبلغ القيمة={c.المبلغ} />,
    },
  ];

  return (
    <div>
      {/* لوحة الملخص السريعة */}
      <div className="mb-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        <بطاقة_مؤشر
          العنوان="مستحق لك (وارد منتظر)"
          القيمة={<نص_مبلغ القيمة={مجموع(وارد_منتظر)} />}
          وصف={`${وارد_منتظر.length} شيك`}
          لون="success"
        />
        <بطاقة_مؤشر
          العنوان="مستحق عليك (صادر منتظر)"
          القيمة={<نص_مبلغ القيمة={مجموع(صادر_منتظر)} />}
          وصف={`${صادر_منتظر.length} شيك`}
          لون="navy"
        />
        <بطاقة_مؤشر
          العنوان="متأخرة (فات موعدها)"
          القيمة={متأخرة.length}
          وصف={`إجمالي ${مجموع(متأخرة).toLocaleString("en-US", { minimumFractionDigits: 2 })} ج.م`}
          لون="danger"
        />
        <بطاقة_مؤشر
          العنوان="إجمالي المنتظر"
          القيمة={<نص_مبلغ القيمة={مجموع(منتظرة)} />}
          وصف={`${منتظرة.length} شيك`}
          لون="navy"
        />
      </div>

      {/* شريط الفلاتر */}
      <div className="mb-4 flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="min-w-40 space-y-1.5">
          <العنوان>من تاريخ الاستحقاق</العنوان>
          <منتقي_تاريخ القيمة={من} عند_التغيير={تعيين_من} />
        </div>
        <div className="min-w-40 space-y-1.5">
          <العنوان>إلى تاريخ الاستحقاق</العنوان>
          <منتقي_تاريخ القيمة={إلى} عند_التغيير={تعيين_إلى} />
        </div>
        <div className="min-w-40 space-y-1.5">
          <العنوان>الحالة</العنوان>
          <قائمة_اختيار
            قابل_للبحث={false}
            الخيارات={[
              { القيمة: "", التسمية: "كل الحالات" },
              { القيمة: "PENDING", التسمية: "منتظر" },
              { القيمة: "COLLECTED", التسمية: "محصّل" },
              { القيمة: "BOUNCED", التسمية: "مرتد" },
            ]}
            القيمة={حالة}
            عند_التغيير={تعيين_حالة}
          />
        </div>
        <div className="min-w-40 space-y-1.5">
          <العنوان>الاتجاه</العنوان>
          <قائمة_اختيار
            قابل_للبحث={false}
            الخيارات={[
              { القيمة: "", التسمية: "الكل" },
              { القيمة: "INCOMING", التسمية: "وارد (لك)" },
              { القيمة: "OUTGOING", التسمية: "صادر (عليك / للمورد)" },
            ]}
            القيمة={اتجاه}
            عند_التغيير={تعيين_اتجاه}
          />
        </div>
        {فيه_فلتر && (
          <الزر
            variant="outline"
            onClick={() => { تعيين_من(""); تعيين_إلى(""); تعيين_حالة(""); تعيين_اتجاه(""); }}
          >
            <X className="size-4" /> مسح الفلاتر
          </الزر>
        )}
        <الزر variant="outline" asChild>
          <Link href="/cheques"><ArrowRight className="size-4" /> رجوع للشيكات</Link>
        </الزر>
      </div>

      {/* ملخص النتائج */}
      <div className="mb-3 flex flex-wrap items-center justify-between gap-2 rounded-lg bg-appgray px-4 py-2.5">
        <span className="flex items-center gap-2 text-sm font-medium">
          <Search className="size-4 opacity-60" />
          النتائج: {مفلترة.length} شيك
        </span>
        <span className="text-sm">
          إجمالي القيمة: <span className="font-bold text-primary"><نص_مبلغ القيمة={إجمالي_المفلتر} /></span>
        </span>
      </div>

      <جدول_بيانات
        الأعمدة={أعمدة}
        البيانات={مفلترة}
        مفتاح_الصف={(c) => c.id}
        بحث={false}
        رسالة_فراغ="لا توجد شيكات مطابقة للفلاتر."
      />
    </div>
  );
}
