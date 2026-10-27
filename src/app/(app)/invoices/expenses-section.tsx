"use client";
import * as React from "react";
import { Plus, Trash2, Receipt } from "lucide-react";
import { الزر } from "@/components/ui/button";
import { الحقل } from "@/components/ui/input";
import { نص_مبلغ } from "@/components/money-text";

/** صف مصروف إضافي في النموذج (نصوص كما كتبها المستخدم — التحويل للرقم على الخادم). */
export type صف_مصروف = { معرف_محلي: number; البيان: string; المبلغ: string };

let عداد_محلي = 0;
export const صف_مصروف_جديد = (ب?: { البيان: string; المبلغ: string }): صف_مصروف => ({
  معرف_محلي: ++عداد_محلي,
  البيان: ب?.البيان ?? "",
  المبلغ: ب?.المبلغ ?? "",
});

const ع = (s: string) => Number(s.replace(/,/g, "")) || 0;

/** إجمالي المصروفات للمعاينة فقط — الإجمالي المعتمد يُحسب على الخادم بالـ Decimal. */
export const إجمالي_المصروفات_للعرض = (صفوف: صف_مصروف[]) => صفوف.reduce((س, م) => س + ع(م.المبلغ), 0);

/** الصفوف غير الفارغة للإرسال (الصف الفاضي تماماً يُتجاهل). */
export const مصروفات_للإرسال = (صفوف: صف_مصروف[]) =>
  صفوف
    .filter((م) => م.البيان.trim() || م.المبلغ.trim())
    .map((م) => ({ البيان: م.البيان.trim(), المبلغ: م.المبلغ.trim() }));

/** تحقق سريع قبل الإرسال (الخادم يتحقق كمان بنفس مخطط Zod). */
export function تحقق_المصروفات(صفوف: صف_مصروف[], تسمية = "المصروفات الإضافية"): string | null {
  for (const [i, م] of مصروفات_للإرسال(صفوف).entries()) {
    if (!م.البيان) return `${تسمية}: اكتب بيان المصروف رقم ${i + 1}`;
    if (!(ع(م.المبلغ) > 0)) return `${تسمية}: مبلغ المصروف رقم ${i + 1} يجب أن يكون أكبر من صفر`;
  }
  return null;
}

/** قسم المصروفات الإضافية (اختياري) — مشترك بين كل أنواع الفواتير وجهتي الفاتورة المباشرة. */
export function قسم_المصروفات({
  العنوان = "مصروفات إضافية (اختياري)",
  الوصف = "نقل، تحميل، … — تُضاف لإجمالي الفاتورة وتُرحَّل معه.",
  الصفوف,
  عند_التغيير,
}: {
  العنوان?: string;
  الوصف?: string;
  الصفوف: صف_مصروف[];
  عند_التغيير: (صفوف: صف_مصروف[]) => void;
}) {
  const حدّث = (معرف: number, تعديل: Partial<صف_مصروف>) =>
    عند_التغيير(الصفوف.map((م) => (م.معرف_محلي === معرف ? { ...م, ...تعديل } : م)));
  const الإجمالي = إجمالي_المصروفات_للعرض(الصفوف);

  return (
    <div className="card-soft p-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center gap-2.5">
          <Receipt className="size-4 text-muted-foreground" />
          <span className="font-medium">{العنوان}</span>
        </div>
        <الزر
          type="button"
          size="sm"
          variant="outline"
          onClick={() => عند_التغيير([...الصفوف, صف_مصروف_جديد()])}
        >
          <Plus className="size-4" /> إضافة مصروف
        </الزر>
      </div>
      <p className="mt-1 text-[12px] text-muted-foreground">{الوصف}</p>

      {الصفوف.length > 0 && (
        <div className="mt-3 space-y-2 border-t border-border pt-3">
          {الصفوف.map((م) => (
            <div key={م.معرف_محلي} className="flex flex-wrap items-center gap-2">
              <الحقل
                className="min-w-[160px] flex-[2]"
                value={م.البيان}
                onChange={(e) => حدّث(م.معرف_محلي, { البيان: e.target.value })}
                placeholder="البيان (مثال: نقل)"
                aria-label="بيان المصروف"
              />
              <الحقل
                selectOnFocus
                className="ltr-nums min-w-[110px] flex-1"
                value={م.المبلغ}
                onChange={(e) => حدّث(م.معرف_محلي, { المبلغ: e.target.value })}
                placeholder="0.00"
                aria-label="مبلغ المصروف"
              />
              <الزر
                type="button"
                size="sm"
                variant="ghost"
                onClick={() => عند_التغيير(الصفوف.filter((x) => x.معرف_محلي !== م.معرف_محلي))}
                title="حذف المصروف"
              >
                <Trash2 className="size-4 text-danger" />
              </الزر>
            </div>
          ))}
          <div className="flex items-center justify-end gap-1.5 text-sm">
            <span className="text-muted-foreground">إجمالي المصروفات:</span>
            <نص_مبلغ القيمة={الإجمالي} />
          </div>
        </div>
      )}
    </div>
  );
}
