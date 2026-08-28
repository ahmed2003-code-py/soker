"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import {
  Plus, Pencil, Trash2, ChevronRight, ChevronLeft, CalendarDays, Wallet,
  AlertTriangle, ListChecks, Power, Receipt,
} from "lucide-react";
import { الزر } from "@/components/ui/button";
import { الحقل, منطقة_نص } from "@/components/ui/input";
import { العنوان } from "@/components/ui/label";
import { الحوار, محتوى_الحوار, رأس_الحوار, تذييل_الحوار, عنوان_الحوار } from "@/components/ui/dialog";
import { حوار_تأكيد } from "@/components/confirm-dialog";
import { نص_مبلغ } from "@/components/money-text";
import { نص_تاريخ } from "@/components/date-text";
import { حالة_فارغة } from "@/components/empty-state";
import { useإشعار } from "@/components/ui/toast";
import { بطاقة_مؤشر } from "@/components/kpi-card";
import type { بند_شهر_محسوب, شهر } from "@/lib/monthly-expenses";
import {
  أضف_بند_مصروف, عدّل_بند_مصروف, عدّل_مبلغ_الشهر, احذف_بند_مصروف,
  بدّل_تفعيل_بند, اجلب_حركات_بند_الشهر,
} from "./actions";

const رقم = (v: number) => v.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });

/** إجماليات الشهر (لبطاقات المؤشرات أعلى الصفحة) */
function اجمع_الشهر(بنود: بند_شهر_محسوب[]) {
  return {
    عدد: بنود.length,
    المقرر: بنود.reduce((س, ب) => س + ب.المقرر, 0),
    المرحّل: بنود.reduce((س, ب) => س + ب.المرحّل, 0),
    المتاح: بنود.reduce((س, ب) => س + ب.المتاح, 0),
    المدفوع: بنود.reduce((س, ب) => س + ب.المدفوع, 0),
    المتبقي: بنود.reduce((س, ب) => س + ب.المتبقي, 0),
    متجاوزة: بنود.filter((ب) => ب.المتبقي < -0.0001).length,
  };
}

/**
 * بروجريس بار البند:
 *  - العجز المرحَّل من الشهر السابق يظهر كجزء «مستهلك سلفاً» (كهرماني) في أول البار
 *  - المدفوع الفعلي بعده (أخضر)، والباقي رمادي
 *  - لو الاستهلاك عدّى المتاح ⇒ البار كله أحمر مع شارة «تجاوز»
 */
function بار_البند({ بند }: { بند: بند_شهر_محسوب }) {
  const عجز_مرحَّل = Math.max(-بند.المرحّل, 0);
  const القاعدة = بند.المقرر + Math.max(بند.المرحّل, 0);
  const المستهلك = عجز_مرحَّل + بند.المدفوع;
  const متجاوز = بند.المتبقي < -0.0001;
  const نسبة = (v: number) => (القاعدة > 0 ? Math.min(100, (v / القاعدة) * 100) : 0);

  return (
    <div className="space-y-1.5">
      <div className="relative h-3 w-full overflow-hidden rounded-full bg-appgray">
        {متجاوز ? (
          <div className="h-full w-full bg-danger" />
        ) : (
          <div className="flex h-full">
            {عجز_مرحَّل > 0 && (
              <div
                className="h-full bg-warning/70"
                style={{ width: `${نسبة(عجز_مرحَّل)}%` }}
                title={`مستهلك من الشهر السابق: ${رقم(عجز_مرحَّل)}`}
              />
            )}
            <div className="h-full bg-success transition-all" style={{ width: `${نسبة(بند.المدفوع)}%` }} />
          </div>
        )}
      </div>
      <div className="flex flex-wrap items-center justify-between gap-x-3 gap-y-1 text-[12px]">
        <span className="text-muted-foreground">
          مدفوع <span className="ltr-nums font-semibold text-foreground">{رقم(بند.المدفوع)}</span> من{" "}
          <span className="ltr-nums font-semibold text-foreground">{رقم(بند.المتاح)}</span>
          {القاعدة > 0 && (
            <span className="ms-1 text-muted-foreground">({Math.round(نسبة(المستهلك))}%)</span>
          )}
        </span>
        {متجاوز ? (
          <span className="rounded-md border border-danger/40 bg-danger/10 px-2 py-0.5 font-semibold text-danger">
            تجاوز بمقدار {رقم(-بند.المتبقي)}
          </span>
        ) : (
          <span className="text-muted-foreground">
            باقي <span className="ltr-nums font-semibold text-success">{رقم(بند.المتبقي)}</span>
          </span>
        )}
      </div>
    </div>
  );
}

export function قائمة_المصروفات_الشهرية({
  الشهر, تسمية, السابق, التالي, هو_الشهر_الحالي, البنود,
}: {
  الشهر: شهر;
  تسمية: string;
  السابق: شهر;
  التالي: شهر;
  هو_الشهر_الحالي: boolean;
  البنود: بند_شهر_محسوب[];
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const [إضافة, تعيين_إضافة] = React.useState(false);
  const [تعديل_بند, تعيين_تعديل_بند] = React.useState<بند_شهر_محسوب | null>(null);
  const [تعديل_مبلغ, تعيين_تعديل_مبلغ] = React.useState<بند_شهر_محسوب | null>(null);
  const [حذف, تعيين_حذف] = React.useState<بند_شهر_محسوب | null>(null);
  const [حركات, تعيين_حركات] = React.useState<بند_شهر_محسوب | null>(null);

  const إج = اجمع_الشهر(البنود);
  const اذهب = (س: شهر) => router.push(`/monthly-expenses?y=${س.سنة}&m=${س.شهر}`);

  return (
    <div className="space-y-5">
      {/* شريط الشهر */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-border bg-card p-3">
        <div className="flex items-center gap-2">
          <الزر size="sm" variant="outline" onClick={() => اذهب(السابق)} title="الشهر السابق">
            <ChevronRight className="size-4" />
          </الزر>
          <div className="flex items-center gap-2 px-2">
            <CalendarDays className="size-4 text-primary" />
            <span className="text-lg font-bold">{تسمية}</span>
            {هو_الشهر_الحالي && (
              <span className="rounded-md bg-primary/10 px-2 py-0.5 text-[11px] font-medium text-primary">
                الشهر الحالي
              </span>
            )}
          </div>
          <الزر size="sm" variant="outline" onClick={() => اذهب(التالي)} title="الشهر التالي">
            <ChevronLeft className="size-4" />
          </الزر>
        </div>
        <الزر onClick={() => تعيين_إضافة(true)}>
          <Plus className="size-4" /> إضافة بند مصروف
        </الزر>
      </div>

      {/* المؤشرات */}
      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
        <بطاقة_مؤشر
          العنوان="إجمالي المقرر"
          القيمة={<نص_مبلغ القيمة={إج.المتاح} />}
          وصف={إج.المرحّل !== 0 ? `شامل ${رقم(Math.abs(إج.المرحّل))} ${إج.المرحّل > 0 ? "فائض" : "تجاوز"} مرحَّل` : `${إج.عدد} بند`}
          أيقونة={<Receipt className="size-5" />}
          لون="navy"
        />
        <بطاقة_مؤشر
          العنوان="المدفوع"
          القيمة={<نص_مبلغ القيمة={إج.المدفوع} />}
          وصف={`${إج.المتاح > 0 ? Math.round((إج.المدفوع / إج.المتاح) * 100) : 0}% من المقرر`}
          أيقونة={<Wallet className="size-5" />}
          لون="success"
        />
        <بطاقة_مؤشر
          العنوان="المتبقي"
          القيمة={<نص_مبلغ القيمة={إج.المتبقي} />}
          وصف="اللي لسه ما اتصرفش من الشهر"
          أيقونة={<ListChecks className="size-5" />}
          لون={إج.المتبقي < 0 ? "danger" : "neutral"}
        />
        <بطاقة_مؤشر
          العنوان="بنود متجاوزة"
          القيمة={<span className="ltr-nums">{إج.متجاوزة}</span>}
          وصف={إج.متجاوزة ? "الزيادة هتترحّل للشهر الجاي" : "مفيش تجاوز"}
          أيقونة={<AlertTriangle className="size-5" />}
          لون={إج.متجاوزة ? "warning" : "neutral"}
        />
      </div>

      {/* البنود */}
      {البنود.length === 0 ? (
        <حالة_فارغة
          العنوان="مفيش بنود مصروفات للشهر ده"
          الوصف="ضيف بنودك الثابتة (إيجار، كهربا، مرتبات…) وهي هتتكرر تلقائياً كل شهر."
          أيقونة={<Receipt className="size-6" />}
          إجراء={<الزر onClick={() => تعيين_إضافة(true)}><Plus className="size-4" /> إضافة بند مصروف</الزر>}
        />
      ) : (
        <div className="grid gap-3 lg:grid-cols-2">
          {البنود.map((ب) => (
            <div key={ب.معرف} className="card-soft space-y-3 p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <div className="flex flex-wrap items-center gap-2">
                    <h3 className="truncate text-base font-semibold">{ب.الاسم}</h3>
                    {!ب.نشط && (
                      <span className="rounded border border-border bg-appgray px-1.5 py-0.5 text-[11px] text-muted-foreground">
                        موقوف
                      </span>
                    )}
                    {ب.المرحّل !== 0 && (
                      <span
                        className={`rounded px-1.5 py-0.5 text-[11px] font-medium ${
                          ب.المرحّل > 0
                            ? "border border-success/40 bg-success/10 text-success"
                            : "border border-warning/40 bg-warning/10 text-warning"
                        }`}
                        title={
                          ب.المرحّل > 0
                            ? "فائض من الشهر السابق — اتضاف لمتاح الشهر ده"
                            : "تجاوز من الشهر السابق — بيستهلك من رصيد الشهر ده"
                        }
                      >
                        {ب.المرحّل > 0 ? "+" : "−"}
                        {رقم(Math.abs(ب.المرحّل))} مرحَّل من الشهر السابق
                      </span>
                    )}
                  </div>
                  <p className="mt-0.5 text-[12px] text-muted-foreground">
                    المقرر <span className="ltr-nums font-medium text-foreground">{رقم(ب.المقرر)}</span>
                    {ب.المرحّل !== 0 && (
                      <>
                        {" "}
                        {ب.المرحّل > 0 ? "+" : "−"} <span className="ltr-nums">{رقم(Math.abs(ب.المرحّل))}</span> ={" "}
                        <span className="ltr-nums font-medium text-foreground">{رقم(ب.المتاح)}</span> متاح
                      </>
                    )}
                  </p>
                </div>
                <div className="flex shrink-0 items-center gap-0.5">
                  {ب.عدد_الحركات > 0 && (
                    <الزر size="sm" variant="ghost" title="حركات البند" onClick={() => تعيين_حركات(ب)}>
                      <ListChecks className="size-4 text-primary-blue" />
                    </الزر>
                  )}
                  <الزر size="sm" variant="ghost" title="تعديل مبلغ الشهر" onClick={() => تعيين_تعديل_مبلغ(ب)}>
                    <Wallet className="size-4 text-primary" />
                  </الزر>
                  <الزر size="sm" variant="ghost" title="تعديل البند" onClick={() => تعيين_تعديل_بند(ب)}>
                    <Pencil className="size-4 text-primary" />
                  </الزر>
                  <الزر
                    size="sm"
                    variant="ghost"
                    title={ب.نشط ? "إيقاف البند" : "تشغيل البند"}
                    onClick={async () => {
                      const r = await بدّل_تفعيل_بند(ب.معرف_البند);
                      if (!r.نجاح) return إشعار.خطأ(r.رسالة);
                      إشعار.نجاح(r.رسالة!);
                      router.refresh();
                    }}
                  >
                    <Power className={`size-4 ${ب.نشط ? "text-muted-foreground" : "text-success"}`} />
                  </الزر>
                  <الزر size="sm" variant="ghost" title="حذف البند" onClick={() => تعيين_حذف(ب)}>
                    <Trash2 className="size-4 text-danger" />
                  </الزر>
                </div>
              </div>
              <بار_البند بند={ب} />
            </div>
          ))}
        </div>
      )}

      {/* حوارات */}
      {إضافة && (
        <حوار_بند
          الشهر={الشهر}
          عند_الإغلاق={() => تعيين_إضافة(false)}
        />
      )}
      {تعديل_بند && (
        <حوار_بند
          الشهر={الشهر}
          بند={تعديل_بند}
          عند_الإغلاق={() => تعيين_تعديل_بند(null)}
        />
      )}
      {تعديل_مبلغ && (
        <حوار_مبلغ_الشهر بند={تعديل_مبلغ} تسمية_الشهر={تسمية} عند_الإغلاق={() => تعيين_تعديل_مبلغ(null)} />
      )}
      {حركات && <حوار_حركات_البند بند={حركات} عند_الإغلاق={() => تعيين_حركات(null)} />}
      <حوار_تأكيد
        مفتوح={!!حذف}
        عند_التغيير={(o) => !o && تعيين_حذف(null)}
        العنوان={`حذف بند «${حذف?.الاسم ?? ""}»؟`}
        الوصف="هيتحذف البند بكل شهوره. حركات الخزنة المسجّلة عليه هتفضل زي ما هي بس من غير ربط بالبند."
        عند_التأكيد={async () => {
          if (!حذف) return;
          const r = await احذف_بند_مصروف(حذف.معرف_البند);
          تعيين_حذف(null);
          if (!r.نجاح) return إشعار.خطأ(r.رسالة);
          إشعار.نجاح(r.رسالة!);
          router.refresh();
        }}
      />
    </div>
  );
}

/** إضافة/تعديل بند متكرر */
function حوار_بند({
  بند, الشهر, عند_الإغلاق,
}: {
  بند?: بند_شهر_محسوب;
  الشهر: شهر;
  عند_الإغلاق: () => void;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const [اسم, تعيين_اسم] = React.useState(بند?.الاسم ?? "");
  const [مبلغ, تعيين_مبلغ] = React.useState(بند ? String(بند.المقرر) : "");
  const [ملاحظات, تعيين_ملاحظات] = React.useState(بند?.ملاحظات ?? "");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  async function احفظ() {
    if (!اسم.trim()) return إشعار.خطأ("اسم البند مطلوب");
    if (!مبلغ || Number(String(مبلغ).replace(/,/g, "")) <= 0) return إشعار.خطأ("أدخل مبلغاً صحيحاً");
    تعيين_جارٍ(true);
    const payload = { الاسم: اسم, المبلغ: مبلغ, ملاحظات };
    const r = بند ? await عدّل_بند_مصروف(بند.معرف_البند, payload) : await أضف_بند_مصروف(payload, الشهر);
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
          <عنوان_الحوار>{بند ? "تعديل بند مصروف" : "إضافة بند مصروف شهري"}</عنوان_الحوار>
        </رأس_الحوار>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <العنوان مطلوب>اسم البند</العنوان>
            <الحقل autoFocus value={اسم} onChange={(e) => تعيين_اسم(e.target.value)} placeholder="إيجار / كهربا / مرتبات…" />
          </div>
          <div className="space-y-1.5">
            <العنوان مطلوب>المبلغ المقرر شهرياً</العنوان>
            <الحقل selectOnFocus className="ltr-nums" value={مبلغ} onChange={(e) => تعيين_مبلغ(e.target.value)} placeholder="0.00" />
          </div>
          <div className="space-y-1.5">
            <العنوان>ملاحظات</العنوان>
            <منطقة_نص value={ملاحظات} onChange={(e) => تعيين_ملاحظات(e.target.value)} />
          </div>
          <p className="rounded-lg border border-primary-blue/30 bg-primary-blue/5 px-3 py-2 text-[12px] leading-6 text-primary-blue">
            البند بيتكرر تلقائياً كل شهر بنفس المبلغ، وأول ما الشهر الجديد يبدأ بينضاف له فرق الشهر اللي فات
            (فائض أو تجاوز). بتسدّده من <span className="font-semibold">الخزنة</span> بتسجيل حركة «مصروف» واختيار البند.
          </p>
        </div>
        <تذييل_الحوار>
          <الزر variant="success" onClick={احفظ} disabled={جارٍ}>{جارٍ ? "جارٍ الحفظ…" : "حفظ"}</الزر>
          <الزر variant="outline" onClick={عند_الإغلاق}>إلغاء</الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}

/** تعديل المبلغ المقرر لشهر بعينه */
function حوار_مبلغ_الشهر({
  بند, تسمية_الشهر, عند_الإغلاق,
}: {
  بند: بند_شهر_محسوب;
  تسمية_الشهر: string;
  عند_الإغلاق: () => void;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const [مبلغ, تعيين_مبلغ] = React.useState(String(بند.المقرر));
  const [للشهور_الجاية, تعيين_للشهور_الجاية] = React.useState(false);
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإغلاق()}>
      <محتوى_الحوار className="max-w-md">
        <رأس_الحوار>
          <عنوان_الحوار>مبلغ «{بند.الاسم}» — {تسمية_الشهر}</عنوان_الحوار>
        </رأس_الحوار>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <العنوان مطلوب>المبلغ المقرر لهذا الشهر</العنوان>
            <الحقل autoFocus selectOnFocus className="ltr-nums" value={مبلغ} onChange={(e) => تعيين_مبلغ(e.target.value)} />
          </div>
          <label className="flex cursor-pointer select-none items-center gap-2 text-sm">
            <input
              type="checkbox"
              className="size-4 rounded accent-primary"
              checked={للشهور_الجاية}
              onChange={(e) => تعيين_للشهور_الجاية(e.target.checked)}
            />
            <span className="text-muted-foreground">طبّق المبلغ ده على الشهور الجاية كمان</span>
          </label>
          <div className="rounded-lg bg-appgray px-3 py-2 text-[12px] text-muted-foreground">
            المدفوع حتى الآن: <span className="ltr-nums font-semibold text-foreground">{رقم(بند.المدفوع)}</span>
            {بند.المرحّل !== 0 && (
              <> — المرحَّل: <span className="ltr-nums font-semibold text-foreground">{رقم(بند.المرحّل)}</span></>
            )}
          </div>
        </div>
        <تذييل_الحوار>
          <الزر
            variant="success"
            disabled={جارٍ}
            onClick={async () => {
              تعيين_جارٍ(true);
              const r = await عدّل_مبلغ_الشهر(بند.معرف, مبلغ, للشهور_الجاية);
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

/** حركات الخزنة المسجّلة على البند في شهره */
function حوار_حركات_البند({ بند, عند_الإغلاق }: { بند: بند_شهر_محسوب; عند_الإغلاق: () => void }) {
  const [حركات, تعيين_حركات] = React.useState<
    { id: number; التاريخ: string; البيان: string; الحساب: string; المبلغ: number }[] | null
  >(null);

  React.useEffect(() => {
    اجلب_حركات_بند_الشهر(بند.معرف).then(تعيين_حركات);
  }, [بند.معرف]);

  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإغلاق()}>
      <محتوى_الحوار className="max-w-2xl">
        <رأس_الحوار>
          <عنوان_الحوار>حركات «{بند.الاسم}»</عنوان_الحوار>
        </رأس_الحوار>
        {!حركات ? (
          <p className="py-6 text-center text-sm text-muted-foreground">جارٍ التحميل…</p>
        ) : حركات.length === 0 ? (
          <p className="py-6 text-center text-sm text-muted-foreground">مفيش حركات على البند ده لسه.</p>
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border">
            <table className="w-full text-sm">
              <thead className="bg-appgray text-muted-foreground">
                <tr>
                  <th className="p-2 text-start">التاريخ</th>
                  <th className="p-2 text-start">البيان</th>
                  <th className="p-2 text-start">الحساب</th>
                  <th className="p-2 text-end">المبلغ</th>
                </tr>
              </thead>
              <tbody>
                {حركات.map((ح) => (
                  <tr key={ح.id} className="border-t border-border">
                    <td className="p-2"><نص_تاريخ القيمة={ح.التاريخ} /></td>
                    <td className="p-2">{ح.البيان}</td>
                    <td className="p-2">{ح.الحساب}</td>
                    <td className="p-2 text-end"><نص_مبلغ القيمة={ح.المبلغ} النوع="مصروف" مع_العملة={false} /></td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr className="border-t-2 border-border bg-appgray font-semibold">
                  <td className="p-2" colSpan={3}>الإجمالي</td>
                  <td className="p-2 text-end"><نص_مبلغ القيمة={بند.المدفوع} مع_العملة={false} /></td>
                </tr>
              </tfoot>
            </table>
          </div>
        )}
        <تذييل_الحوار>
          <الزر variant="outline" onClick={عند_الإغلاق}>إغلاق</الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}
