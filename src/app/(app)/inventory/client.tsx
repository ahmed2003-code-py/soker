"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import {
  Search, Plus, ChevronDown, ChevronLeft, AlertTriangle, Boxes, Layers,
  ListChecks, SlidersHorizontal, RefreshCw, Building2, Pencil, Trash2,
} from "lucide-react";
import { الزر } from "@/components/ui/button";
import { الحقل, منطقة_نص } from "@/components/ui/input";
import { العنوان } from "@/components/ui/label";
import { الحوار, محتوى_الحوار, رأس_الحوار, تذييل_الحوار, عنوان_الحوار } from "@/components/ui/dialog";
import { قائمة_اختيار } from "@/components/combobox";
import { منتقي_تاريخ } from "@/components/date-picker";
import { نص_تاريخ } from "@/components/date-text";
import { حالة_فارغة } from "@/components/empty-state";
import { بطاقة_مؤشر } from "@/components/kpi-card";
import { useإشعار } from "@/components/ui/toast";
import type { شركة_رصيد } from "@/lib/stock";
import {
  سجّل_لط_افتتاحي, سجّل_تسوية_لط, اضبط_الحد_الأدنى, اجلب_كشف_اللط, أعد_حساب_المخزن,
  عدّل_لط, احذف_لط,
} from "./actions";
import { حوار_تأكيد } from "@/components/confirm-dialog";

const رقم = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const اليوم = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });

export function شاشة_المخزن({
  الأرصدة, البحث, الحدود, الموردون, الكتالوج,
}: {
  الأرصدة: شركة_رصيد[];
  البحث: string;
  الحدود: { id: number; التصنيف: string; اللون: string | null; الكمية: number; الوزن: number }[];
  الموردون: { id: number; name: string }[];
  الكتالوج: { شركات: string[]; أصناف: string[]; ألوان: string[] };
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const [نص_البحث, تعيين_نص_البحث] = React.useState(البحث);
  const [شركات_مفتوحة, تعيين_شركات_مفتوحة] = React.useState<Set<string>>(
    () => new Set(البحث ? الأرصدة.map((ش) => ش.الشركة) : الأرصدة.slice(0, 1).map((ش) => ش.الشركة))
  );
  const [ألوان_مفتوحة, تعيين_ألوان_مفتوحة] = React.useState<Set<string>>(new Set());
  const [افتتاحي, تعيين_افتتاحي] = React.useState(false);
  const [حدود_مفتوحة, تعيين_حدود_مفتوحة] = React.useState(false);
  const [كشف, تعيين_كشف] = React.useState<number | null>(null);
  const [تسوية, تعيين_تسوية] = React.useState<{ id: number; رقم_اللط: string; الكمية: number } | null>(null);
  const [تعديل, تعيين_تعديل] = React.useState<{
    id: number; رقم_اللط: string; التصنيف: string; اللون: string; الشركة: string; التاريخ: string;
  } | null>(null);
  const [حذف, تعيين_حذف] = React.useState<{ id: number; رقم_اللط: string } | null>(null);

  const إجمالي_الكمية = الأرصدة.reduce((س, ش) => س + ش.الكمية, 0);
  const إجمالي_الوزن = الأرصدة.reduce((س, ش) => س + ش.الوزن, 0);
  const عدد_اللطات = الأرصدة.reduce((س, ش) => س + ش.عدد_اللطات, 0);
  const تحت_الحد = الأرصدة.flatMap((ش) =>
    ش.الأصناف.flatMap((ص) =>
      ص.الألوان.filter((ل) => ل.تحت_الحد_الأدنى).map((ل) => ({ الشركة: ش.الشركة, التصنيف: ص.التصنيف, ...ل }))
    )
  );
  const عدد_الألوان = الأرصدة.reduce((س, ش) => س + ش.الأصناف.reduce((x, ص) => x + ص.الألوان.length, 0), 0);

  const بدّل = (مجموعة: Set<string>, تعيين: (s: Set<string>) => void, مفتاح: string) => {
    const ن = new Set(مجموعة);
    if (ن.has(مفتاح)) ن.delete(مفتاح); else ن.add(مفتاح);
    تعيين(ن);
  };
  function ابحث() {
    router.push(نص_البحث.trim() ? `/inventory?q=${encodeURIComponent(نص_البحث.trim())}` : "/inventory");
  }

  return (
    <div className="space-y-5">
      {/* المؤشرات */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <بطاقة_مؤشر العنوان="الشركات" القيمة={<span className="ltr-nums">{الأرصدة.length}</span>}
          وصف={`${عدد_الألوان} صنف/لون · ${عدد_اللطات} لط`} أيقونة={<Boxes className="size-5" />} لون="navy" />
        <بطاقة_مؤشر العنوان="إجمالي الكمية" القيمة={<span className="ltr-nums">{رقم(إجمالي_الكمية)}</span>}
          وصف="شكارة" أيقونة={<Layers className="size-5" />} لون="neutral" />
        <بطاقة_مؤشر العنوان="إجمالي الوزن" القيمة={<span className="ltr-nums">{رقم(إجمالي_الوزن)}</span>}
          وصف="كجم" أيقونة={<ListChecks className="size-5" />} لون="neutral" />
        <بطاقة_مؤشر العنوان="تحت الحد الأدنى" القيمة={<span className="ltr-nums">{تحت_الحد.length}</span>}
          وصف={تحت_الحد.length ? "محتاجة شراء" : "كله تمام"} أيقونة={<AlertTriangle className="size-5" />}
          لون={تحت_الحد.length ? "warning" : "neutral"} />
      </div>

      {/* تنبيه الحد الأدنى */}
      {تحت_الحد.length > 0 && (
        <div className="rounded-xl border border-warning/40 bg-warning/10 p-4">
          <p className="mb-2 flex items-center gap-2 text-sm font-semibold text-warning">
            <AlertTriangle className="size-4" /> أصناف وصلت للحد الأدنى — محتاجة شراء
          </p>
          <div className="flex flex-wrap gap-2">
            {تحت_الحد.map((ل) => (
              <span key={`${ل.الشركة}-${ل.التصنيف}-${ل.اللون}`} className="rounded-lg border border-warning/40 bg-card px-2.5 py-1 text-[13px]">
                <span className="text-muted-foreground">{ل.الشركة} · </span>
                {ل.التصنيف} — {ل.اللون}:{" "}
                <span className="ltr-nums font-semibold">{رقم(ل.الكمية)}</span>
                <span className="text-muted-foreground"> / الحد {رقم(ل.الحد_الأدنى_كمية)}</span>
              </span>
            ))}
          </div>
        </div>
      )}

      {/* شريط الأدوات */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="pointer-events-none absolute end-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <الحقل
              className="w-64 pe-9"
              placeholder="ابحث بالشركة أو الصنف أو اللون أو اللط…"
              value={نص_البحث}
              onChange={(e) => تعيين_نص_البحث(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") ابحث(); }}
            />
          </div>
          <الزر variant="outline" onClick={ابحث}>بحث</الزر>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <الزر variant="outline" onClick={() => تعيين_حدود_مفتوحة(true)}>
            <SlidersHorizontal className="size-4" /> الحد الأدنى
          </الزر>
          <الزر
            variant="outline"
            onClick={async () => {
              const r = await أعد_حساب_المخزن();
              if (!r.نجاح) return إشعار.خطأ(r.رسالة);
              إشعار.نجاح(r.رسالة!);
              router.refresh();
            }}
            title="إعادة حساب أرصدة اللطات من الحركات"
          >
            <RefreshCw className="size-4" /> إعادة حساب
          </الزر>
          <الزر onClick={() => تعيين_افتتاحي(true)}>
            <Plus className="size-4" /> إضافة رصيد
          </الزر>
        </div>
      </div>

      {/* الأرصدة: شركة ← تصنيف ← لون ← لطات */}
      {الأرصدة.length === 0 ? (
        <حالة_فارغة
          العنوان={البحث ? "مفيش نتائج للبحث ده" : "المخزن فاضي"}
          الوصف={
            البحث
              ? "جرّب كلمة تانية — البحث بيشمل الشركة والصنف واللون ورقم اللط والمورد ورقم فاتورة المورد."
              : "ابدأ بتسجيل الأرصدة الموجودة عندك فعلياً («إضافة رصيد»)، وبعدها كل فاتورة شراء هتزوّد المخزن تلقائياً."
          }
          أيقونة={<Boxes className="size-6" />}
          إجراء={<الزر onClick={() => تعيين_افتتاحي(true)}><Plus className="size-4" /> إضافة رصيد</الزر>}
        />
      ) : (
        <div className="space-y-3">
          {الأرصدة.map((ش) => {
            const مفتوحة = شركات_مفتوحة.has(ش.الشركة);
            return (
              <div key={ش.الشركة} className="card-soft overflow-hidden">
                {/* رأس الشركة */}
                <button
                  type="button"
                  onClick={() => بدّل(شركات_مفتوحة, تعيين_شركات_مفتوحة, ش.الشركة)}
                  className="flex w-full items-center justify-between gap-3 p-4 text-start transition-colors hover:bg-muted/40"
                >
                  <span className="flex items-center gap-2.5">
                    {مفتوحة ? <ChevronDown className="size-4 text-muted-foreground" /> : <ChevronLeft className="size-4 text-muted-foreground" />}
                    <Building2 className="size-4 text-primary" />
                    <span className="text-base font-bold">{ش.الشركة}</span>
                    <span className="rounded-md bg-appgray px-2 py-0.5 text-[11px] text-muted-foreground">
                      {ش.الأصناف.length} صنف · {ش.عدد_اللطات} لط
                    </span>
                    {ش.تحت_الحد_الأدنى > 0 && (
                      <span className="rounded-md border border-warning/40 bg-warning/10 px-2 py-0.5 text-[11px] font-medium text-warning">
                        {ش.تحت_الحد_الأدنى} تحت الحد
                      </span>
                    )}
                  </span>
                  <span className="flex shrink-0 items-center gap-4 text-sm">
                    <span className="ltr-nums font-bold">{رقم(ش.الكمية)}<span className="ms-1 text-[11px] font-normal text-muted-foreground">شكارة</span></span>
                    <span className="ltr-nums text-muted-foreground">{رقم(ش.الوزن)}<span className="ms-1 text-[11px]">كجم</span></span>
                  </span>
                </button>

                {/* الأصناف */}
                {مفتوحة && (
                  <div className="border-t border-border">
                    {ش.الأصناف.map((ص) => (
                      <div key={ص.التصنيف} className="border-b border-border/60 last:border-b-0">
                        <div className="flex items-center justify-between gap-3 bg-appgray/70 px-4 py-2">
                          <span className="flex items-center gap-2">
                            <span className="rounded-md border border-primary/30 bg-primary/10 px-2 py-0.5 text-[12px] font-bold text-primary">
                              {ص.التصنيف}
                            </span>
                            <span className="text-[12px] text-muted-foreground">{ص.الألوان.length} لون</span>
                          </span>
                          <span className="flex items-center gap-4 text-[13px]">
                            <span className="ltr-nums font-semibold">{رقم(ص.الكمية)}</span>
                            <span className="ltr-nums text-muted-foreground">{رقم(ص.الوزن)} كجم</span>
                          </span>
                        </div>

                        {/* الألوان */}
                        <table className="w-full text-sm">
                          <tbody>
                            {ص.الألوان.map((ل) => {
                              const مفتاح = `${ش.الشركة}||${ص.التصنيف}||${ل.اللون}`;
                              const لون_مفتوح = ألوان_مفتوحة.has(مفتاح);
                              return (
                                <React.Fragment key={مفتاح}>
                                  <tr
                                    className={`cursor-pointer border-t border-border/50 hover:bg-muted/30 ${ل.تحت_الحد_الأدنى ? "bg-warning/5" : ""}`}
                                    onClick={() => بدّل(ألوان_مفتوحة, تعيين_ألوان_مفتوحة, مفتاح)}
                                  >
                                    <td className="w-8 py-2 ps-4 text-muted-foreground">
                                      {لون_مفتوح ? <ChevronDown className="size-3.5" /> : <ChevronLeft className="size-3.5" />}
                                    </td>
                                    <td className="py-2 font-medium">{ل.اللون}</td>
                                    <td className="py-2 text-end text-[12px] text-muted-foreground">{ل.عدد_اللطات} لط</td>
                                    <td className="py-2 text-end ltr-nums font-semibold">{رقم(ل.الكمية)}</td>
                                    <td className="py-2 text-end ltr-nums text-muted-foreground">{رقم(ل.الوزن)} كجم</td>
                                    <td className="w-28 py-2 pe-4 text-end">
                                      {ل.تحت_الحد_الأدنى ? (
                                        <span className="rounded border border-warning/40 bg-warning/10 px-1.5 py-0.5 text-[11px] font-medium text-warning">
                                          تحت الحد {رقم(ل.الحد_الأدنى_كمية)}
                                        </span>
                                      ) : ل.الحد_الأدنى_كمية > 0 ? (
                                        <span className="text-[11px] text-muted-foreground">الحد {رقم(ل.الحد_الأدنى_كمية)}</span>
                                      ) : null}
                                    </td>
                                  </tr>
                                  {لون_مفتوح &&
                                    ل.اللطات.map((لط) => (
                                      <tr key={لط.id} className="border-t border-border/30 bg-muted/20 text-[12.5px]">
                                        <td />
                                        <td className="py-1.5 ps-2 text-muted-foreground" colSpan={3}>
                                          لط <span className="font-semibold text-foreground">{لط.رقم_اللط}</span>
                                          {لط.المورد && <span> — {لط.المورد}</span>}
                                          <span> — <نص_تاريخ القيمة={لط.تاريخ_الاستلام} /></span>
                                        </td>
                                        <td className="py-1.5 text-end ltr-nums">
                                          {رقم(لط.الكمية)} / {رقم(لط.الوزن)} كجم
                                        </td>
                                        <td className="py-1.5 pe-4 text-end">
                                          <span className="flex justify-end gap-1.5">
                                            <button
                                              type="button"
                                              title="كشف حركة اللط"
                                              onClick={(e) => { e.stopPropagation(); تعيين_كشف(لط.id); }}
                                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[12px] font-semibold text-foreground shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/5 hover:text-primary"
                                            >
                                              <ListChecks className="size-3.5" /> كشف
                                            </button>
                                            <button
                                              type="button"
                                              title="تسوية جرد (زيادة أو عجز)"
                                              onClick={(e) => { e.stopPropagation(); تعيين_تسوية({ id: لط.id, رقم_اللط: لط.رقم_اللط, الكمية: لط.الكمية }); }}
                                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2.5 py-1 text-[12px] font-semibold text-foreground shadow-sm transition-colors hover:border-warning/60 hover:bg-warning/10 hover:text-warning"
                                            >
                                              <SlidersHorizontal className="size-3.5" /> تسوية
                                            </button>
                                            <button
                                              type="button"
                                              title="تعديل بيانات اللط"
                                              onClick={(e) => {
                                                e.stopPropagation();
                                                تعيين_تعديل({
                                                  id: لط.id, رقم_اللط: لط.رقم_اللط, التصنيف: ص.التصنيف,
                                                  اللون: ل.اللون, الشركة: ش.الشركة === "بدون شركة" ? "" : ش.الشركة,
                                                  التاريخ: لط.تاريخ_الاستلام.slice(0, 10),
                                                });
                                              }}
                                              className="inline-flex items-center gap-1 rounded-lg border border-border bg-card px-2 py-1 text-[12px] font-semibold text-primary shadow-sm transition-colors hover:border-primary/50 hover:bg-primary/10"
                                            >
                                              <Pencil className="size-3.5" /> تعديل
                                            </button>
                                            <button
                                              type="button"
                                              title="حذف اللط"
                                              onClick={(e) => { e.stopPropagation(); تعيين_حذف({ id: لط.id, رقم_اللط: لط.رقم_اللط }); }}
                                              className="inline-flex items-center gap-1 rounded-lg border border-danger/30 bg-card px-2 py-1 text-[12px] font-semibold text-danger shadow-sm transition-colors hover:border-danger/60 hover:bg-danger/10"
                                            >
                                              <Trash2 className="size-3.5" /> حذف
                                            </button>
                                          </span>
                                        </td>
                                      </tr>
                                    ))}
                                </React.Fragment>
                              );
                            })}
                          </tbody>
                        </table>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {افتتاحي && (
        <حوار_رصيد_افتتاحي الموردون={الموردون} الكتالوج={الكتالوج} عند_الإغلاق={() => تعيين_افتتاحي(false)} />
      )}
      {حدود_مفتوحة && <حوار_الحد_الأدنى الحدود={الحدود} عند_الإغلاق={() => تعيين_حدود_مفتوحة(false)} />}
      {كشف !== null && <حوار_كشف_اللط معرف={كشف} عند_الإغلاق={() => تعيين_كشف(null)} />}
      {تسوية && <حوار_تسوية لط={تسوية} عند_الإغلاق={() => تعيين_تسوية(null)} />}
      {تعديل && (
        <حوار_تعديل_لط لط={تعديل} الموردون={الموردون} الكتالوج={الكتالوج} عند_الإغلاق={() => تعيين_تعديل(null)} />
      )}
      <حوار_تأكيد
        مفتوح={!!حذف}
        عند_التغيير={(o) => !o && تعيين_حذف(null)}
        العنوان={`حذف اللط ${حذف?.رقم_اللط ?? ""}؟`}
        الوصف="الحذف مسموح بس لو اللط ما اتصرفش منه حاجة ومش جاي من فاتورة. غير كده استخدم «تسوية»."
        عند_التأكيد={async () => {
          if (!حذف) return;
          const r = await احذف_لط(حذف.id);
          تعيين_حذف(null);
          if (!r.نجاح) return إشعار.خطأ(r.رسالة);
          إشعار.نجاح(r.رسالة!);
          router.refresh();
        }}
      />
    </div>
  );
}

/** تعديل بيانات اللط (بلا مساس بالأرصدة — الفروق بـ«تسوية») */
function حوار_تعديل_لط({
  لط, الموردون, الكتالوج, عند_الإغلاق,
}: {
  لط: { id: number; رقم_اللط: string; التصنيف: string; اللون: string; الشركة: string; التاريخ: string };
  الموردون: { id: number; name: string }[];
  الكتالوج: { شركات: string[]; أصناف: string[]; ألوان: string[] };
  عند_الإغلاق: () => void;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const [رقم_اللط, تعيين_رقم] = React.useState(لط.رقم_اللط);
  const [شركة, تعيين_شركة] = React.useState(لط.الشركة);
  const [تصنيف, تعيين_تصنيف] = React.useState(لط.التصنيف);
  const [لون, تعيين_لون] = React.useState(لط.اللون);
  const [تاريخ, تعيين_تاريخ] = React.useState(لط.التاريخ);
  const [مورد, تعيين_مورد] = React.useState("");
  const [ملاحظات, تعيين_ملاحظات] = React.useState("");
  const [شركات, تعيين_شركات] = React.useState(الكتالوج.شركات);
  const [أصناف, تعيين_أصناف] = React.useState(الكتالوج.أصناف);
  const [ألوان, تعيين_ألوان] = React.useState(الكتالوج.ألوان);
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإغلاق()}>
      <محتوى_الحوار className="max-w-xl">
        <رأس_الحوار><عنوان_الحوار>تعديل اللط {لط.رقم_اللط}</عنوان_الحوار></رأس_الحوار>
        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <العنوان مطلوب>رقم اللط</العنوان>
            <الحقل autoFocus className="ltr-nums" value={رقم_اللط} onChange={(e) => تعيين_رقم(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <العنوان>الشركة</العنوان>
            <قائمة_اختيار
              الخيارات={شركات.map((x) => ({ القيمة: x, التسمية: x }))}
              القيمة={شركة}
              عند_التغيير={تعيين_شركة}
              عند_الإضافة={(ج) => { if (!شركات.includes(ج)) تعيين_شركات((s) => [...s, ج]); تعيين_شركة(ج); }}
              تسمية_الإضافة="إضافة شركة جديدة"
              نص_بديل="بدون شركة"
            />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>التصنيف</العنوان>
            <قائمة_اختيار
              الخيارات={أصناف.map((x) => ({ القيمة: x, التسمية: x }))}
              القيمة={تصنيف}
              عند_التغيير={تعيين_تصنيف}
              عند_الإضافة={(ج) => { if (!أصناف.includes(ج)) تعيين_أصناف((s) => [...s, ج]); تعيين_تصنيف(ج); }}
              تسمية_الإضافة="إضافة تصنيف جديد"
              نص_بديل="اختر التصنيف"
            />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>اللون</العنوان>
            <قائمة_اختيار
              الخيارات={ألوان.map((x) => ({ القيمة: x, التسمية: x }))}
              القيمة={لون}
              عند_التغيير={تعيين_لون}
              عند_الإضافة={(ج) => { if (!ألوان.includes(ج)) تعيين_ألوان((s) => [...s, ج]); تعيين_لون(ج); }}
              تسمية_الإضافة="إضافة لون جديد"
              نص_بديل="اختر اللون"
            />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>تاريخ الاستلام</العنوان>
            <منتقي_تاريخ القيمة={تاريخ} عند_التغيير={تعيين_تاريخ} />
          </div>
          <div className="space-y-1.5">
            <العنوان>المورد</العنوان>
            <قائمة_اختيار
              الخيارات={[{ القيمة: "", التسمية: "— بدون —" }, ...الموردون.map((m) => ({ القيمة: String(m.id), التسمية: m.name }))]}
              القيمة={مورد}
              عند_التغيير={تعيين_مورد}
              نص_بديل="اختر المورد…"
            />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <العنوان>ملاحظات</العنوان>
            <منطقة_نص value={ملاحظات} onChange={(e) => تعيين_ملاحظات(e.target.value)} />
          </div>
          <p className="sm:col-span-2 rounded-lg bg-appgray px-3 py-2 text-[12px] text-muted-foreground">
            الكمية والوزن ما بيتعدلوش من هنا — أي فرق بيتسجّل بـ«تسوية» عشان يفضل باين في كشف اللط.
          </p>
        </div>
        <تذييل_الحوار>
          <الزر
            variant="success"
            disabled={جارٍ}
            onClick={async () => {
              تعيين_جارٍ(true);
              const r = await عدّل_لط(لط.id, {
                رقم_اللط, التصنيف: تصنيف, اللون: لون, الشركة: شركة,
                التاريخ: تاريخ, ملاحظات, معرف_المورد: مورد ? Number(مورد) : null,
              });
              تعيين_جارٍ(false);
              if (!r.نجاح) return إشعار.خطأ(r.رسالة);
              إشعار.نجاح(r.رسالة!);
              عند_الإغلاق();
              router.refresh();
            }}
          >
            {جارٍ ? "جارٍ الحفظ…" : "حفظ"}
          </الزر>
          <الزر variant="outline" onClick={عند_الإغلاق}>إلغاء</الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}

/**
 * إضافة رصيد للمخزن بالترتيب الطبيعي: الشركة ← التصنيف ← اللون ← الكمية.
 * كل خانة بتقترح الموجود فعلاً وتسمح بإضافة جديد على طول.
 */
function حوار_رصيد_افتتاحي({
  الموردون, الكتالوج, عند_الإغلاق,
}: {
  الموردون: { id: number; name: string }[];
  الكتالوج: { شركات: string[]; أصناف: string[]; ألوان: string[] };
  عند_الإغلاق: () => void;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const [شركة, تعيين_شركة] = React.useState("");
  const [تصنيف, تعيين_تصنيف] = React.useState("");
  const [لون, تعيين_لون] = React.useState("");
  const [شركات, تعيين_شركات] = React.useState(الكتالوج.شركات);
  const [أصناف, تعيين_أصناف] = React.useState(الكتالوج.أصناف);
  const [ألوان, تعيين_ألوان] = React.useState(الكتالوج.ألوان);
  const [ق, تعيين] = React.useState({ رقم_اللط: "", الكمية: "", الوزن: "", التاريخ: اليوم(), ملاحظات: "" });
  const [مورد, تعيين_مورد] = React.useState("");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);
  const حدّث = (ك: string, v: string) => تعيين((س) => ({ ...س, [ك]: v }));

  const خطوة = (رقم_الخطوة: number, نص: string, تمّت: boolean) => (
    <span className={`flex items-center gap-1.5 ${تمّت ? "text-success" : "text-muted-foreground"}`}>
      <span className={`grid size-5 place-items-center rounded-full text-[11px] font-bold ${تمّت ? "bg-success/15 text-success" : "bg-appgray"}`}>
        {رقم_الخطوة}
      </span>
      {نص}
    </span>
  );

  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإغلاق()}>
      <محتوى_الحوار className="max-w-xl">
        <رأس_الحوار><عنوان_الحوار>إضافة رصيد للمخزن</عنوان_الحوار></رأس_الحوار>

        <div className="mb-1 flex flex-wrap items-center gap-x-4 gap-y-1 text-[12px]">
          {خطوة(1, "الشركة", !!شركة)}
          {خطوة(2, "التصنيف", !!تصنيف)}
          {خطوة(3, "اللون", !!لون)}
          {خطوة(4, "الكمية والوزن", Number(ق.الكمية) > 0 || Number(ق.الوزن) > 0)}
        </div>

        <div className="grid gap-3 sm:grid-cols-2">
          <div className="space-y-1.5">
            <العنوان مطلوب>الشركة</العنوان>
            <قائمة_اختيار
              الخيارات={شركات.map((x) => ({ القيمة: x, التسمية: x }))}
              القيمة={شركة}
              عند_التغيير={تعيين_شركة}
              عند_الإضافة={(جديد) => { if (!شركات.includes(جديد)) تعيين_شركات((s) => [...s, جديد]); تعيين_شركة(جديد); }}
              تسمية_الإضافة="إضافة شركة جديدة"
              نص_بديل="اختر الشركة أو أضف جديدة"
            />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>التصنيف</العنوان>
            <قائمة_اختيار
              الخيارات={أصناف.map((x) => ({ القيمة: x, التسمية: x }))}
              القيمة={تصنيف}
              عند_التغيير={تعيين_تصنيف}
              عند_الإضافة={(جديد) => { if (!أصناف.includes(جديد)) تعيين_أصناف((s) => [...s, جديد]); تعيين_تصنيف(جديد); }}
              تسمية_الإضافة="إضافة تصنيف جديد"
              نص_بديل={شركة ? "اختر التصنيف أو أضف جديد" : "اختر الشركة أولاً"}
            />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>اللون</العنوان>
            <قائمة_اختيار
              الخيارات={ألوان.map((x) => ({ القيمة: x, التسمية: x }))}
              القيمة={لون}
              عند_التغيير={تعيين_لون}
              عند_الإضافة={(جديد) => { if (!ألوان.includes(جديد)) تعيين_ألوان((s) => [...s, جديد]); تعيين_لون(جديد); }}
              تسمية_الإضافة="إضافة لون جديد"
              نص_بديل={تصنيف ? "اختر اللون أو أضف جديد" : "اختر التصنيف أولاً"}
            />
          </div>
          <div className="space-y-1.5">
            <العنوان>رقم اللط</العنوان>
            <الحقل className="ltr-nums" value={ق.رقم_اللط} onChange={(e) => حدّث("رقم_اللط", e.target.value)} placeholder="يُولَّد تلقائياً لو فاضي" />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>الكمية (شكارة)</العنوان>
            <الحقل selectOnFocus className="ltr-nums" value={ق.الكمية} onChange={(e) => حدّث("الكمية", e.target.value)} placeholder="0" />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>الوزن (كجم)</العنوان>
            <الحقل selectOnFocus className="ltr-nums" value={ق.الوزن} onChange={(e) => حدّث("الوزن", e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <العنوان>المورد (اختياري)</العنوان>
            <قائمة_اختيار
              الخيارات={[{ القيمة: "", التسمية: "— بدون —" }, ...الموردون.map((m) => ({ القيمة: String(m.id), التسمية: m.name }))]}
              القيمة={مورد}
              عند_التغيير={تعيين_مورد}
              نص_بديل="اختر المورد…"
            />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>تاريخ الاستلام</العنوان>
            <منتقي_تاريخ القيمة={ق.التاريخ} عند_التغيير={(v) => حدّث("التاريخ", v)} />
          </div>
          <div className="space-y-1.5 sm:col-span-2">
            <العنوان>ملاحظات</العنوان>
            <منطقة_نص value={ق.ملاحظات} onChange={(e) => حدّث("ملاحظات", e.target.value)} />
          </div>
        </div>

        <تذييل_الحوار>
          <الزر
            variant="success"
            disabled={جارٍ}
            onClick={async () => {
              تعيين_جارٍ(true);
              const r = await سجّل_لط_افتتاحي({
                التصنيف: تصنيف, اللون: لون, الشركة: شركة,
                رقم_اللط: ق.رقم_اللط, الكمية: ق.الكمية, الوزن: ق.الوزن,
                التاريخ: ق.التاريخ, ملاحظات: ق.ملاحظات,
                معرف_المورد: مورد ? Number(مورد) : null,
              });
              تعيين_جارٍ(false);
              if (!r.نجاح) return إشعار.خطأ(r.رسالة);
              إشعار.نجاح(r.رسالة!);
              عند_الإغلاق();
              router.refresh();
            }}
          >
            {جارٍ ? "جارٍ الحفظ…" : "حفظ"}
          </الزر>
          <الزر variant="outline" onClick={عند_الإغلاق}>إلغاء</الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}

/** ضبط حدود إعادة الطلب */
function حوار_الحد_الأدنى({
  الحدود, عند_الإغلاق,
}: {
  الحدود: { id: number; التصنيف: string; اللون: string | null; الكمية: number; الوزن: number }[];
  عند_الإغلاق: () => void;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const [تصنيف, تعيين_تصنيف] = React.useState("");
  const [لون, تعيين_لون] = React.useState("");
  const [كمية, تعيين_كمية] = React.useState("");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإغلاق()}>
      <محتوى_الحوار className="max-w-lg">
        <رأس_الحوار><عنوان_الحوار>الحد الأدنى للمخزون</عنوان_الحوار></رأس_الحوار>
        <p className="text-[13px] leading-6 text-muted-foreground">
          حدّد أقل كمية مسموح بيها للصنف. لو سِبت اللون فاضي، الحد بيسري على الصنف كله؛ ولو حددت لون،
          بيسري على اللون ده بالتحديد. لما الرصيد يوصل للحد بيظهر تنبيه في الصفحة دي.
        </p>
        <div className="mt-3 grid gap-3 sm:grid-cols-3">
          <div className="space-y-1.5">
            <العنوان مطلوب>الصنف</العنوان>
            <الحقل autoFocus value={تصنيف} onChange={(e) => تعيين_تصنيف(e.target.value)} placeholder="14/1" />
          </div>
          <div className="space-y-1.5">
            <العنوان>اللون (اختياري)</العنوان>
            <الحقل value={لون} onChange={(e) => تعيين_لون(e.target.value)} />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>أقل كمية</العنوان>
            <الحقل selectOnFocus className="ltr-nums" value={كمية} onChange={(e) => تعيين_كمية(e.target.value)} placeholder="0" />
          </div>
        </div>
        {الحدود.length > 0 && (
          <div className="mt-4 overflow-hidden rounded-lg border border-border">
            <table className="w-full text-[13px]">
              <thead className="bg-appgray text-muted-foreground">
                <tr><th className="p-2 text-start">الصنف</th><th className="p-2 text-start">اللون</th><th className="p-2 text-end">أقل كمية</th></tr>
              </thead>
              <tbody>
                {الحدود.map((h) => (
                  <tr key={h.id} className="border-t border-border">
                    <td className="p-2">{h.التصنيف}</td>
                    <td className="p-2">{h.اللون ?? "— كل الألوان —"}</td>
                    <td className="p-2 text-end ltr-nums">{رقم(h.الكمية)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <تذييل_الحوار>
          <الزر
            variant="success"
            disabled={جارٍ}
            onClick={async () => {
              تعيين_جارٍ(true);
              const r = await اضبط_الحد_الأدنى({ التصنيف: تصنيف, اللون: لون || null, الكمية: كمية || 0 });
              تعيين_جارٍ(false);
              if (!r.نجاح) return إشعار.خطأ(r.رسالة);
              إشعار.نجاح(r.رسالة!);
              تعيين_تصنيف(""); تعيين_لون(""); تعيين_كمية("");
              router.refresh();
            }}
          >
            {جارٍ ? "جارٍ الحفظ…" : "حفظ الحد"}
          </الزر>
          <الزر variant="outline" onClick={عند_الإغلاق}>إغلاق</الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}

/** كشف حركة اللط */
function حوار_كشف_اللط({ معرف, عند_الإغلاق }: { معرف: number; عند_الإغلاق: () => void }) {
  const [بيانات, تعيين_بيانات] = React.useState<Awaited<ReturnType<typeof اجلب_كشف_اللط>> | null>(null);
  React.useEffect(() => { اجلب_كشف_اللط(معرف).then(تعيين_بيانات); }, [معرف]);

  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإغلاق()}>
      <محتوى_الحوار className="max-w-4xl">
        <رأس_الحوار>
          <عنوان_الحوار>
            {بيانات ? `كشف اللط ${بيانات.رقم_اللط} — ${بيانات.التصنيف} / ${بيانات.اللون}` : "كشف اللط"}
          </عنوان_الحوار>
        </رأس_الحوار>
        {!بيانات ? (
          <p className="py-6 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : (
          <>
            <div className="mb-3 flex flex-wrap gap-x-6 gap-y-1 text-[13px] text-muted-foreground">
              {بيانات.المورد && <span>المورد: <span className="font-medium text-foreground">{بيانات.المورد}</span></span>}
              {بيانات.الشركة && <span>الشركة: <span className="font-medium text-foreground">{بيانات.الشركة}</span></span>}
              <span>الرصيد الحالي: <span className="ltr-nums font-semibold text-foreground">{رقم(بيانات.الكمية)}</span> شكارة / <span className="ltr-nums font-semibold text-foreground">{رقم(بيانات.الوزن)}</span> كجم</span>
            </div>
            <div className="overflow-x-auto rounded-lg border border-border">
              <table className="w-full text-[13px]">
                <thead className="bg-appgray text-muted-foreground">
                  <tr>
                    <th className="p-2 text-start">التاريخ</th>
                    <th className="p-2 text-start">الحركة</th>
                    <th className="p-2 text-start">المستند</th>
                    <th className="p-2 text-end">كمية</th>
                    <th className="p-2 text-end">وزن</th>
                    <th className="p-2 text-end">الرصيد بعدها</th>
                    <th className="p-2 text-start">بواسطة</th>
                  </tr>
                </thead>
                <tbody>
                  {بيانات.الحركات.map((ح) => (
                    <tr key={ح.id} className="border-t border-border">
                      <td className="p-2 whitespace-nowrap"><نص_تاريخ القيمة={ح.التاريخ} /></td>
                      <td className={`p-2 whitespace-nowrap ${ح.وارد ? "text-success" : "text-danger"}`}>{ح.النوع}</td>
                      <td className="p-2">
                        {ح.معرف_الفاتورة ? (
                          <Link href={`/invoices/${ح.معرف_الفاتورة}`} className="text-primary-blue hover:underline">
                            {ح.رقم_الفاتورة ?? "فاتورة"}
                          </Link>
                        ) : (
                          <span className="text-muted-foreground">{ح.البيان ?? "—"}</span>
                        )}
                        {ح.الطرف && <span className="text-muted-foreground"> — {ح.الطرف}</span>}
                      </td>
                      <td className={`p-2 text-end ltr-nums ${ح.وارد ? "text-success" : "text-danger"}`}>
                        {ح.وارد ? "+" : "−"}{رقم(ح.الكمية)}
                      </td>
                      <td className={`p-2 text-end ltr-nums ${ح.وارد ? "text-success" : "text-danger"}`}>
                        {ح.وارد ? "+" : "−"}{رقم(ح.الوزن)}
                      </td>
                      <td className="p-2 text-end ltr-nums font-semibold">{رقم(ح.رصيد_الكمية)}</td>
                      <td className="p-2 text-[11px] text-muted-foreground">{ح.بواسطة}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </>
        )}
        <تذييل_الحوار><الزر variant="outline" onClick={عند_الإغلاق}>إغلاق</الزر></تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}

/** تسوية جرد على لط */
function حوار_تسوية({
  لط, عند_الإغلاق,
}: {
  لط: { id: number; رقم_اللط: string; الكمية: number };
  عند_الإغلاق: () => void;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const [اتجاه, تعيين_اتجاه] = React.useState<"زيادة" | "عجز">("عجز");
  const [كمية, تعيين_كمية] = React.useState("");
  const [وزن, تعيين_وزن] = React.useState("");
  const [سبب, تعيين_سبب] = React.useState("");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإغلاق()}>
      <محتوى_الحوار className="max-w-md">
        <رأس_الحوار><عنوان_الحوار>تسوية جرد — لط {لط.رقم_اللط}</عنوان_الحوار></رأس_الحوار>
        <div className="space-y-3">
          <div className="flex overflow-hidden rounded-lg border border-border text-sm w-fit">
            {(["عجز", "زيادة"] as const).map((a) => (
              <button key={a} type="button"
                className={`px-4 py-1.5 transition-colors ${اتجاه === a ? "bg-primary text-white" : "hover:bg-muted"}`}
                onClick={() => تعيين_اتجاه(a)}>
                {a}
              </button>
            ))}
          </div>
          <p className="rounded-lg bg-appgray px-3 py-2 text-[12px] text-muted-foreground">
            الرصيد الحالي: <span className="ltr-nums font-semibold text-foreground">{رقم(لط.الكمية)}</span> شكارة
          </p>
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="space-y-1.5">
              <العنوان مطلوب>الكمية</العنوان>
              <الحقل autoFocus selectOnFocus className="ltr-nums" value={كمية} onChange={(e) => تعيين_كمية(e.target.value)} placeholder="0" />
            </div>
            <div className="space-y-1.5">
              <العنوان>الوزن</العنوان>
              <الحقل selectOnFocus className="ltr-nums" value={وزن} onChange={(e) => تعيين_وزن(e.target.value)} placeholder="0.00" />
            </div>
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>السبب</العنوان>
            <الحقل value={سبب} onChange={(e) => تعيين_سبب(e.target.value)} placeholder="جرد فعلي / تالف / خطأ إدخال…" />
          </div>
        </div>
        <تذييل_الحوار>
          <الزر
            variant="success"
            disabled={جارٍ}
            onClick={async () => {
              تعيين_جارٍ(true);
              const r = await سجّل_تسوية_لط({ معرف_اللط: لط.id, الاتجاه: اتجاه, الكمية: كمية || 0, الوزن: وزن || 0, التاريخ: اليوم(), السبب: سبب });
              تعيين_جارٍ(false);
              if (!r.نجاح) return إشعار.خطأ(r.رسالة);
              إشعار.نجاح(r.رسالة!);
              عند_الإغلاق();
              router.refresh();
            }}
          >
            {جارٍ ? "جارٍ الحفظ…" : "تسجيل التسوية"}
          </الزر>
          <الزر variant="outline" onClick={عند_الإغلاق}>إلغاء</الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}
