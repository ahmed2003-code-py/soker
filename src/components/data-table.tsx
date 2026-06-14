"use client";
import * as React from "react";
import { ArrowUpDown, ChevronLeft, ChevronRight, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { الحقل } from "@/components/ui/input";
import { الزر } from "@/components/ui/button";
import { هيكل_تحميل } from "@/components/ui/skeleton";
import { حالة_فارغة } from "@/components/empty-state";

export type عمود<ت> = {
  المفتاح: string;
  العنوان: string;
  /** عرض الخلية */
  خلية?: (صف: ت) => React.ReactNode;
  /** قيمة للفرز/البحث النصي */
  قيمة?: (صف: ت) => string | number;
  قابل_للفرز?: boolean;
  محاذاة?: "start" | "center" | "end";
  /** إخفاء في وضع البطاقات على الموبايل */
  مخفي_موبايل?: boolean;
};

type الخصائص<ت> = {
  الأعمدة: عمود<ت>[];
  البيانات: ت[];
  مفتاح_الصف: (صف: ت) => string | number;
  بحث?: boolean;
  نص_البحث?: string;
  لكل_صفحة?: number;
  جارٍ_التحميل?: boolean;
  خطأ?: string | null;
  رسالة_فراغ?: string;
  إجراءات_الصف?: (صف: ت) => React.ReactNode;
  عند_النقر?: (صف: ت) => void;
};

export function جدول_بيانات<ت>({
  الأعمدة,
  البيانات,
  مفتاح_الصف,
  بحث = true,
  نص_البحث = "ابحث…",
  لكل_صفحة = 20,
  جارٍ_التحميل,
  خطأ,
  رسالة_فراغ = "لا توجد سجلات",
  إجراءات_الصف,
  عند_النقر,
}: الخصائص<ت>) {
  const [استعلام, تعيين_استعلام] = React.useState("");
  const [فرز, تعيين_فرز] = React.useState<{ مفتاح: string; تصاعدي: boolean } | null>(
    null
  );
  const [صفحة, تعيين_صفحة] = React.useState(1);

  const قيمة_عمود = React.useCallback(
    (صف: ت, ع: عمود<ت>): string | number => {
      if (ع.قيمة) return ع.قيمة(صف);
      const v = (صف as Record<string, unknown>)[ع.المفتاح];
      return v == null ? "" : String(v);
    },
    []
  );

  const مُصفّاة = React.useMemo(() => {
    if (!استعلام.trim()) return البيانات;
    const ق = استعلام.trim().toLowerCase();
    return البيانات.filter((صف) =>
      الأعمدة.some((ع) => String(قيمة_عمود(صف, ع)).toLowerCase().includes(ق))
    );
  }, [البيانات, استعلام, الأعمدة, قيمة_عمود]);

  const مرتبة = React.useMemo(() => {
    if (!فرز) return مُصفّاة;
    const ع = الأعمدة.find((c) => c.المفتاح === فرز.مفتاح);
    if (!ع) return مُصفّاة;
    return [...مُصفّاة].sort((أ, ب) => {
      const قأ = قيمة_عمود(أ, ع);
      const قب = قيمة_عمود(ب, ع);
      let ن = 0;
      if (typeof قأ === "number" && typeof قب === "number") ن = قأ - قب;
      else ن = String(قأ).localeCompare(String(قب), "ar");
      return فرز.تصاعدي ? ن : -ن;
    });
  }, [مُصفّاة, فرز, الأعمدة, قيمة_عمود]);

  const إجمالي_الصفحات = Math.max(1, Math.ceil(مرتبة.length / لكل_صفحة));
  const الصفحة_الحالية = Math.min(صفحة, إجمالي_الصفحات);
  const مرئية = مرتبة.slice(
    (الصفحة_الحالية - 1) * لكل_صفحة,
    الصفحة_الحالية * لكل_صفحة
  );

  React.useEffect(() => {
    تعيين_صفحة(1);
  }, [استعلام, فرز]);

  function بدّل_الفرز(مفتاح: string) {
    تعيين_فرز((س) =>
      s_eq(س, مفتاح) ? { مفتاح, تصاعدي: !س!.تصاعدي } : { مفتاح, تصاعدي: true }
    );
  }
  function s_eq(س: { مفتاح: string } | null, م: string) {
    return س?.مفتاح === م;
  }

  return (
    <div className="space-y-3">
      {بحث && (
        <div className="relative max-w-sm">
          <Search className="absolute end-3 top-1/2 size-4 -translate-y-1/2 opacity-50" />
          <الحقل
            value={استعلام}
            onChange={(e) => تعيين_استعلام(e.target.value)}
            placeholder={نص_البحث}
            className="pe-9"
          />
        </div>
      )}

      {/* جدول لسطح المكتب */}
      <div className="hidden overflow-hidden rounded-xl border border-border bg-card md:block">
        <table className="w-full text-sm">
          <thead className="bg-appgray text-muted-foreground">
            <tr>
              {الأعمدة.map((ع) => (
                <th
                  key={ع.المفتاح}
                  className={cn(
                    "px-4 py-3 text-start font-medium",
                    ع.محاذاة === "center" && "text-center",
                    ع.محاذاة === "end" && "text-end"
                  )}
                >
                  {ع.قابل_للفرز ? (
                    <button
                      onClick={() => بدّل_الفرز(ع.المفتاح)}
                      className="inline-flex items-center gap-1 hover:text-foreground"
                    >
                      {ع.العنوان}
                      <ArrowUpDown className="size-3.5 opacity-50" />
                    </button>
                  ) : (
                    ع.العنوان
                  )}
                </th>
              ))}
              {إجراءات_الصف && <th className="px-4 py-3 text-end font-medium">إجراءات</th>}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {جارٍ_التحميل &&
              Array.from({ length: 5 }).map((_, i) => (
                <tr key={i}>
                  {الأعمدة.map((ع) => (
                    <td key={ع.المفتاح} className="px-4 py-3">
                      <هيكل_تحميل />
                    </td>
                  ))}
                  {إجراءات_الصف && <td className="px-4 py-3" />}
                </tr>
              ))}
            {!جارٍ_التحميل &&
              مرئية.map((صف) => (
                <tr
                  key={مفتاح_الصف(صف)}
                  onClick={() => عند_النقر?.(صف)}
                  className={cn(
                    "transition hover:bg-appgray/60",
                    عند_النقر && "cursor-pointer"
                  )}
                >
                  {الأعمدة.map((ع) => (
                    <td
                      key={ع.المفتاح}
                      className={cn(
                        "px-4 py-3",
                        ع.محاذاة === "center" && "text-center",
                        ع.محاذاة === "end" && "text-end"
                      )}
                    >
                      {ع.خلية ? ع.خلية(صف) : String(قيمة_عمود(صف, ع))}
                    </td>
                  ))}
                  {إجراءات_الصف && (
                    <td
                      className="px-4 py-3 text-end"
                      onClick={(e) => e.stopPropagation()}
                    >
                      {إجراءات_الصف(صف)}
                    </td>
                  )}
                </tr>
              ))}
          </tbody>
        </table>
        {!جارٍ_التحميل && !خطأ && مرئية.length === 0 && (
          <div className="p-4">
            <حالة_فارغة العنوان={رسالة_فراغ} />
          </div>
        )}
        {خطأ && (
          <div className="p-6 text-center text-sm text-danger">{خطأ}</div>
        )}
      </div>

      {/* بطاقات للموبايل */}
      <div className="space-y-3 md:hidden">
        {جارٍ_التحميل &&
          Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="card-soft space-y-2 p-4">
              <هيكل_تحميل className="w-1/2" />
              <هيكل_تحميل />
            </div>
          ))}
        {!جارٍ_التحميل &&
          مرئية.map((صف) => (
            <div
              key={مفتاح_الصف(صف)}
              onClick={() => عند_النقر?.(صف)}
              className={cn("card-soft space-y-2 p-4", عند_النقر && "cursor-pointer")}
            >
              {الأعمدة
                .filter((ع) => !ع.مخفي_موبايل)
                .map((ع) => (
                  <div key={ع.المفتاح} className="flex justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{ع.العنوان}</span>
                    <span className="text-end">
                      {ع.خلية ? ع.خلية(صف) : String(قيمة_عمود(صف, ع))}
                    </span>
                  </div>
                ))}
              {إجراءات_الصف && (
                <div
                  className="flex justify-end gap-2 pt-2"
                  onClick={(e) => e.stopPropagation()}
                >
                  {إجراءات_الصف(صف)}
                </div>
              )}
            </div>
          ))}
        {!جارٍ_التحميل && مرئية.length === 0 && !خطأ && (
          <حالة_فارغة العنوان={رسالة_فراغ} />
        )}
      </div>

      {/* ترقيم الصفحات */}
      {!جارٍ_التحميل && مرتبة.length > لكل_صفحة && (
        <div className="flex items-center justify-between text-sm">
          <span className="text-muted-foreground">
            {مرتبة.length} سجل — صفحة {الصفحة_الحالية} من {إجمالي_الصفحات}
          </span>
          <div className="flex gap-1">
            <الزر
              variant="outline"
              size="sm"
              disabled={الصفحة_الحالية <= 1}
              onClick={() => تعيين_صفحة((p) => p - 1)}
            >
              <ChevronRight className="size-4" /> السابق
            </الزر>
            <الزر
              variant="outline"
              size="sm"
              disabled={الصفحة_الحالية >= إجمالي_الصفحات}
              onClick={() => تعيين_صفحة((p) => p + 1)}
            >
              التالي <ChevronLeft className="size-4" />
            </الزر>
          </div>
        </div>
      )}
    </div>
  );
}
