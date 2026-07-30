"use client";
import * as React from "react";
import { FileSpreadsheet, X } from "lucide-react";
import { ChequeStatus } from "@prisma/client";
import { الزر } from "@/components/ui/button";
import { الحقل } from "@/components/ui/input";
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
import { تصدير_إكسل } from "@/lib/export";

type صف = {
  id: number;
  رقم_الشيك: string | null;
  اسم_البنك: string | null;
  الطرف: string;
  معرف_الطرف: number | null;
  الاتجاه: "INCOMING" | "OUTGOING";
  الحالة: ChequeStatus;
  تاريخ_الاستحقاق: string;
  المبلغ: number;
};

const يوم_فقط = (iso: string) => iso.slice(0, 10);
const اليوم_str = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });

/** فرق أيام (تاريخ − اليوم) اعتماداً على نص yyyy-mm-dd. */
function فرق_أيام(due: string, today: string): number {
  const a = Date.parse(due + "T00:00:00Z");
  const b = Date.parse(today + "T00:00:00Z");
  return Math.round((a - b) / 86400000);
}

const شرائح_العمر = [
  { المفتاح: "قادمة", التسمية: "قادمة (> 7 أيام)", لون: "navy" as const },
  { المفتاح: "خلال_7", التسمية: "خلال 7 أيام", لون: "warning" as const },
  { المفتاح: "متأخر_1_30", التسمية: "متأخرة 1-30", لون: "danger" as const },
  { المفتاح: "متأخر_31_60", التسمية: "متأخرة 31-60", لون: "danger" as const },
  { المفتاح: "متأخر_61_90", التسمية: "متأخرة 61-90", لون: "danger" as const },
  { المفتاح: "متأخر_90", التسمية: "أكثر من 90", لون: "danger" as const },
];

function شريحة(due: string, today: string): string {
  const f = فرق_أيام(due, today);
  if (f > 7) return "قادمة";
  if (f >= 0) return "خلال_7";
  const t = -f;
  if (t <= 30) return "متأخر_1_30";
  if (t <= 60) return "متأخر_31_60";
  if (t <= 90) return "متأخر_61_90";
  return "متأخر_90";
}

export function شاشة_تقارير_الشيكات({ الصفوف }: { الصفوف: صف[] }) {
  const [من, تعيين_من] = React.useState("");
  const [إلى, تعيين_إلى] = React.useState("");
  const [حالة, تعيين_حالة] = React.useState("");
  const [اتجاه, تعيين_اتجاه] = React.useState("");
  const [طرف, تعيين_طرف] = React.useState("");
  const [بنك, تعيين_بنك] = React.useState("");

  const today = اليوم_str();

  const خيارات_الطرف = React.useMemo(() => {
    const م = new Map<number, string>();
    for (const r of الصفوف) if (r.معرف_الطرف) م.set(r.معرف_الطرف, r.الطرف);
    return [...م.entries()].map(([id, اسم]) => ({ القيمة: String(id), التسمية: اسم }));
  }, [الصفوف]);

  const مفلترة = React.useMemo(() => {
    return الصفوف.filter((r) => {
      const d = يوم_فقط(r.تاريخ_الاستحقاق);
      if (من && d < من) return false;
      if (إلى && d > إلى) return false;
      if (حالة && r.الحالة !== حالة) return false;
      if (اتجاه && r.الاتجاه !== اتجاه) return false;
      if (طرف && String(r.معرف_الطرف) !== طرف) return false;
      if (بنك && !(r.اسم_البنك ?? "").toLowerCase().includes(بنك.toLowerCase())) return false;
      return true;
    });
  }, [الصفوف, من, إلى, حالة, اتجاه, طرف, بنك]);

  const إجمالي = مفلترة.reduce((س, r) => س + r.المبلغ, 0);

  // تجميع حسب الحالة
  const بالحالة = React.useMemo(() => {
    const م = new Map<ChequeStatus, { عدد: number; إجمالي: number }>();
    for (const r of مفلترة) {
      const v = م.get(r.الحالة) ?? { عدد: 0, إجمالي: 0 };
      v.عدد++; v.إجمالي += r.المبلغ; م.set(r.الحالة, v);
    }
    return [...م.entries()].map(([k, v]) => ({ الحالة: k, التسمية: تسمية_حالة_الشيك[k], ...v })).sort((a, b) => b.إجمالي - a.إجمالي);
  }, [مفلترة]);

  // تجميع حسب البنك
  const بالبنك = React.useMemo(() => {
    const م = new Map<string, { عدد: number; إجمالي: number }>();
    for (const r of مفلترة) {
      const k = r.اسم_البنك?.trim() || "— بدون بنك —";
      const v = م.get(k) ?? { عدد: 0, إجمالي: 0 };
      v.عدد++; v.إجمالي += r.المبلغ; م.set(k, v);
    }
    return [...م.entries()].map(([الاسم, v]) => ({ الاسم, ...v })).sort((a, b) => b.إجمالي - a.إجمالي);
  }, [مفلترة]);

  // تجميع حسب الطرف
  const بالطرف = React.useMemo(() => {
    const م = new Map<string, { عدد: number; إجمالي: number }>();
    for (const r of مفلترة) {
      const k = r.الطرف || "— غير مربوط —";
      const v = م.get(k) ?? { عدد: 0, إجمالي: 0 };
      v.عدد++; v.إجمالي += r.المبلغ; م.set(k, v);
    }
    return [...م.entries()].map(([الاسم, v]) => ({ الاسم, ...v })).sort((a, b) => b.إجمالي - a.إجمالي);
  }, [مفلترة]);

  // أعمار الشيكات (تحت التحصيل فقط)
  const أعمار = React.useMemo(() => {
    const م = new Map<string, { عدد: number; إجمالي: number }>();
    for (const s of شرائح_العمر) م.set(s.المفتاح, { عدد: 0, إجمالي: 0 });
    for (const r of مفلترة) {
      if (r.الحالة !== "PENDING") continue;
      const k = شريحة(يوم_فقط(r.تاريخ_الاستحقاق), today);
      const v = م.get(k)!; v.عدد++; v.إجمالي += r.المبلغ;
    }
    return شرائح_العمر.map((s) => ({ ...s, ...م.get(s.المفتاح)! }));
  }, [مفلترة, today]);

  const فيه_فلتر = !!(من || إلى || حالة || اتجاه || طرف || بنك);

  function صدّر() {
    تصدير_إكسل({
      اسم_الملف: "تقرير-الشيكات",
      اسم_الورقة: "الشيكات",
      العنوان_العلوي: "تقرير الشيكات",
      الأعمدة: [
        { المفتاح: "رقم_الشيك", العنوان: "رقم الشيك" },
        { المفتاح: "اسم_البنك", العنوان: "البنك" },
        { المفتاح: "الطرف", العنوان: "الطرف" },
        { المفتاح: "الاتجاه", العنوان: "الاتجاه" },
        { المفتاح: "الحالة", العنوان: "الحالة" },
        { المفتاح: "تاريخ_الاستحقاق", العنوان: "الاستحقاق" },
        { المفتاح: "المبلغ", العنوان: "المبلغ", مبلغ: true },
      ],
      الصفوف: مفلترة.map((r) => ({
        رقم_الشيك: r.رقم_الشيك ?? "",
        اسم_البنك: r.اسم_البنك ?? "",
        الطرف: r.الطرف,
        الاتجاه: r.الاتجاه === "INCOMING" ? "وارد" : "صادر",
        الحالة: تسمية_حالة_الشيك[r.الحالة],
        تاريخ_الاستحقاق: يوم_فقط(r.تاريخ_الاستحقاق),
        المبلغ: r.المبلغ,
      })),
      صف_الإجمالي: { الطرف: "الإجمالي", المبلغ: إجمالي },
    });
  }

  const أعمدة: عمود<صف>[] = [
    { المفتاح: "رقم_الشيك", العنوان: "رقم الشيك", خلية: (r) => <span className="ltr-nums">{r.رقم_الشيك || "—"}</span> },
    { المفتاح: "اسم_البنك", العنوان: "البنك", خلية: (r) => r.اسم_البنك || "—" },
    { المفتاح: "الطرف", العنوان: "الطرف" },
    { المفتاح: "الاتجاه", العنوان: "الاتجاه", خلية: (r) => <الشارة variant={r.الاتجاه === "INCOMING" ? "success" : "navy"}>{r.الاتجاه === "INCOMING" ? "وارد" : "صادر"}</الشارة> },
    { المفتاح: "الحالة", العنوان: "الحالة", خلية: (r) => <شارة_حالة الحالة={تسمية_حالة_الشيك[r.الحالة]} /> },
    { المفتاح: "تاريخ_الاستحقاق", العنوان: "الاستحقاق", قابل_للفرز: true, قيمة: (r) => r.تاريخ_الاستحقاق, خلية: (r) => <نص_تاريخ القيمة={r.تاريخ_الاستحقاق} /> },
    { المفتاح: "المبلغ", العنوان: "المبلغ", قابل_للفرز: true, قيمة: (r) => r.المبلغ, محاذاة: "end", خلية: (r) => <نص_مبلغ القيمة={r.المبلغ} /> },
  ];

  return (
    <div className="space-y-5">
      {/* شريط الفلاتر */}
      <div className="flex flex-wrap items-end gap-3 rounded-xl border border-border bg-card p-4">
        <div className="min-w-36 space-y-1"><العنوان>من الاستحقاق</العنوان><منتقي_تاريخ القيمة={من} عند_التغيير={تعيين_من} /></div>
        <div className="min-w-36 space-y-1"><العنوان>إلى الاستحقاق</العنوان><منتقي_تاريخ القيمة={إلى} عند_التغيير={تعيين_إلى} /></div>
        <div className="min-w-40 space-y-1"><العنوان>الاتجاه</العنوان>
          <قائمة_اختيار قابل_للبحث={false} الخيارات={[{ القيمة: "", التسمية: "الكل" }, { القيمة: "INCOMING", التسمية: "وارد" }, { القيمة: "OUTGOING", التسمية: "صادر" }]} القيمة={اتجاه} عند_التغيير={تعيين_اتجاه} />
        </div>
        <div className="min-w-40 space-y-1"><العنوان>الحالة</العنوان>
          <قائمة_اختيار قابل_للبحث={false} الخيارات={[{ القيمة: "", التسمية: "كل الحالات" }, ...Object.keys(تسمية_حالة_الشيك).map((k) => ({ القيمة: k, التسمية: تسمية_حالة_الشيك[k as ChequeStatus] }))]} القيمة={حالة} عند_التغيير={تعيين_حالة} />
        </div>
        <div className="min-w-48 space-y-1"><العنوان>الطرف</العنوان>
          <قائمة_اختيار الخيارات={[{ القيمة: "", التسمية: "كل الأطراف" }, ...خيارات_الطرف]} القيمة={طرف} عند_التغيير={تعيين_طرف} نص_بديل="اختر طرفاً…" />
        </div>
        <div className="min-w-36 space-y-1"><العنوان>البنك</العنوان><الحقل value={بنك} onChange={(e) => تعيين_بنك(e.target.value)} placeholder="بحث بالبنك" /></div>
        {فيه_فلتر && (
          <الزر variant="outline" onClick={() => { تعيين_من(""); تعيين_إلى(""); تعيين_حالة(""); تعيين_اتجاه(""); تعيين_طرف(""); تعيين_بنك(""); }}>
            <X className="size-4" /> مسح
          </الزر>
        )}
        <الزر variant="success" onClick={صدّر} disabled={مفلترة.length === 0}>
          <FileSpreadsheet className="size-4" /> تصدير إكسل
        </الزر>
      </div>

      {/* أعمار الشيكات المستحقة */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">أعمار الشيكات المستحقة (تحت التحصيل)</h2>
        <div className="grid gap-3 grid-cols-2 sm:grid-cols-3 lg:grid-cols-6">
          {أعمار.map((a) => (
            <بطاقة_مؤشر key={a.المفتاح} العنوان={a.التسمية} القيمة={<نص_مبلغ القيمة={a.إجمالي} />} وصف={`${a.عدد} شيك`} لون={a.لون} />
          ))}
        </div>
      </div>

      {/* ملخص العدد والإجمالي */}
      <div className="flex flex-wrap items-center justify-between gap-2 rounded-lg bg-appgray px-4 py-2.5 text-sm">
        <span className="font-medium">النتائج: {مفلترة.length} شيك</span>
        <span>الإجمالي: <span className="font-bold text-primary"><نص_مبلغ القيمة={إجمالي} /></span></span>
      </div>

      {/* التجميعات */}
      <div className="grid gap-4 lg:grid-cols-3">
        <جدول_تجميع العنوان="حسب الحالة" صفوف={بالحالة.map((r) => ({ الاسم: r.التسمية, عدد: r.عدد, إجمالي: r.إجمالي }))} />
        <جدول_تجميع العنوان="حسب البنك" صفوف={بالبنك} />
        <جدول_تجميع العنوان="حسب الطرف" صفوف={بالطرف} />
      </div>

      {/* التفصيل */}
      <div>
        <h2 className="mb-2 text-sm font-semibold text-muted-foreground">التفصيل</h2>
        <جدول_بيانات الأعمدة={أعمدة} البيانات={مفلترة} مفتاح_الصف={(r) => r.id} بحث={false} رسالة_فراغ="لا توجد شيكات مطابقة." />
      </div>
    </div>
  );
}

function جدول_تجميع({ العنوان: عنوان, صفوف }: { العنوان: string; صفوف: { الاسم: string; عدد: number; إجمالي: number }[] }) {
  const مجموع = صفوف.reduce((س, r) => س + r.إجمالي, 0);
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="mb-2 text-sm font-semibold">{عنوان}</h3>
      {صفوف.length === 0 ? (
        <p className="py-4 text-center text-[12px] text-muted-foreground">لا بيانات</p>
      ) : (
        <div className="space-y-1">
          {صفوف.map((r) => (
            <div key={r.الاسم} className="flex items-center justify-between border-b border-border/60 py-1 text-sm last:border-0">
              <span className="truncate">{r.الاسم} <span className="text-[11px] text-muted-foreground">({r.عدد})</span></span>
              <نص_مبلغ القيمة={r.إجمالي} className="shrink-0 font-medium" />
            </div>
          ))}
          <div className="flex items-center justify-between pt-1.5 text-sm font-bold">
            <span>الإجمالي</span>
            <نص_مبلغ القيمة={مجموع} className="text-primary" />
          </div>
        </div>
      )}
    </div>
  );
}
