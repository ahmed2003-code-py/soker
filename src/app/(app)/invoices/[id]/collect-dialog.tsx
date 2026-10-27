"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Wallet } from "lucide-react";
import type { TreasuryAccountType } from "@prisma/client";
import { الزر } from "@/components/ui/button";
import { الحقل } from "@/components/ui/input";
import { العنوان } from "@/components/ui/label";
import { قائمة_اختيار } from "@/components/combobox";
import { منتقي_تاريخ } from "@/components/date-picker";
import { نص_مبلغ } from "@/components/money-text";
import { useإشعار } from "@/components/ui/toast";
import { الحوار, محتوى_الحوار, رأس_الحوار, عنوان_الحوار, وصف_الحوار, تذييل_الحوار } from "@/components/ui/dialog";
import type { خريطة_حسابات_فرعية } from "@/app/(app)/treasury/sub-account-actions";
import { حصّل_فاتورة_معلقة } from "../actions";

type بند = { معرف_محلي: number; حساب: string; حساب_فرعي: string; مبلغ: string };
const ع = (s: string) => Number(s.replace(/,/g, "")) || 0;
const اليوم = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });

/**
 * تحصيل فاتورة زائر معلّقة: المبلغ = المتبقي بالكامل، على وسيلة واحدة أو موزّعاً حتى 4 وسائل.
 * الخادم يعيد التحقق من المتبقي داخل معاملة مقفولة (لا تحصيل مكرر ولا زيادة).
 */
export function زر_تحصيل_فاتورة({
  المعرف,
  المتبقي,
  حسابات_الخزنة,
  حسابات_فرعية,
}: {
  المعرف: number;
  المتبقي: string; // نص Decimal من الخادم — يُرسل كما هو بلا تقريب
  حسابات_الخزنة: { id: number; النوع: TreasuryAccountType; التسمية: string }[];
  حسابات_فرعية: خريطة_حسابات_فرعية;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const [مفتوح, تعيين_مفتوح] = React.useState(false);
  const [جارٍ, تعيين_جارٍ] = React.useState(false);
  const [تاريخ, تعيين_تاريخ] = React.useState(اليوم());
  const [ملاحظات, تعيين_ملاحظات] = React.useState("");
  const عداد = React.useRef(0);
  const بند_جديد = React.useCallback(
    (مبلغ = ""): بند => ({
      معرف_محلي: ++عداد.current,
      حساب: حسابات_الخزنة[0] ? String(حسابات_الخزنة[0].id) : "",
      حساب_فرعي: "",
      مبلغ,
    }),
    [حسابات_الخزنة]
  );
  const [بنود, تعيين_بنود] = React.useState<بند[]>(() => [بند_جديد(المتبقي)]);

  function افتح() {
    تعيين_تاريخ(اليوم());
    تعيين_ملاحظات("");
    تعيين_بنود([بند_جديد(المتبقي)]);
    تعيين_مفتوح(true);
  }
  const حدّث = (معرف: number, تعديل: Partial<بند>) =>
    تعيين_بنود((س) => س.map((ب) => (ب.معرف_محلي === معرف ? { ...ب, ...تعديل } : ب)));
  const نوع_حساب = (معرف: string) => حسابات_الخزنة.find((h) => String(h.id) === معرف)?.النوع ?? null;
  const الإجمالي = بنود.reduce((س, ب) => س + ع(ب.مبلغ), 0);
  const الفرق = ع(المتبقي) - الإجمالي;

  async function احفظ() {
    for (const ب of بنود) {
      if (!(ع(ب.مبلغ) > 0)) return إشعار.خطأ("مبلغ كل وسيلة دفع يجب أن يكون أكبر من صفر");
      if (!ب.حساب) return إشعار.خطأ("اختر حساب الخزنة");
      const نوع = نوع_حساب(ب.حساب);
      if (نوع && نوع !== "CASH" && (حسابات_فرعية[نوع]?.length ?? 0) > 0 && !ب.حساب_فرعي) {
        return إشعار.خطأ(`اختر ${نوع === "BANK" ? "البنك" : نوع === "VODAFONE" ? "المحفظة" : "حساب إنستا"}`);
      }
    }
    if (Math.abs(الفرق) > 0.0001) return إشعار.خطأ("إجمالي التحصيل يجب أن يساوي المتبقي على الفاتورة");
    تعيين_جارٍ(true);
    const r = await حصّل_فاتورة_معلقة(المعرف, {
      التاريخ: تاريخ,
      ملاحظات: ملاحظات.trim() || null,
      بنود: بنود.map((ب) => ({
        المبلغ: ب.مبلغ,
        معرف_الحساب: Number(ب.حساب),
        معرف_حساب_فرعي: ب.حساب_فرعي ? Number(ب.حساب_فرعي) : null,
      })),
    });
    تعيين_جارٍ(false);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    إشعار.نجاح(r.رسالة!);
    تعيين_مفتوح(false);
    router.refresh();
  }

  return (
    <>
      <الزر variant="success" size="sm" onClick={افتح}>
        <Wallet className="size-4" /> تحصيل المتبقي
      </الزر>
      <الحوار open={مفتوح} onOpenChange={(o) => !جارٍ && تعيين_مفتوح(o)}>
        <محتوى_الحوار>
          <رأس_الحوار>
            <عنوان_الحوار>تحصيل فاتورة معلّقة</عنوان_الحوار>
            <وصف_الحوار>
              المتبقي على الفاتورة: <نص_مبلغ القيمة={المتبقي} />
            </وصف_الحوار>
          </رأس_الحوار>

          <div className="space-y-3">
            <div className="space-y-1.5">
              <العنوان مطلوب>تاريخ التحصيل</العنوان>
              <منتقي_تاريخ القيمة={تاريخ} عند_التغيير={تعيين_تاريخ} />
            </div>

            {بنود.map((ب, i) => {
              const نوع = نوع_حساب(ب.حساب);
              const خيارات_فرعية = نوع && نوع !== "CASH" ? (حسابات_فرعية[نوع] ?? []) : [];
              return (
                <div key={ب.معرف_محلي} className="flex flex-wrap items-end gap-2 rounded-lg border border-border p-2">
                  <div className="min-w-[110px] flex-1 space-y-1">
                    {i === 0 && <العنوان مطلوب className="mb-0">المبلغ</العنوان>}
                    <الحقل
                      autoFocus={i === 0}
                      selectOnFocus
                      className="ltr-nums"
                      value={ب.مبلغ}
                      onChange={(e) => حدّث(ب.معرف_محلي, { مبلغ: e.target.value })}
                      placeholder="0.00"
                    />
                  </div>
                  <div className="min-w-[130px] flex-1 space-y-1">
                    {i === 0 && <العنوان مطلوب className="mb-0">طريقة الدفع / الخزنة</العنوان>}
                    <قائمة_اختيار
                      الخيارات={حسابات_الخزنة.map((h) => ({ القيمة: String(h.id), التسمية: h.التسمية }))}
                      القيمة={ب.حساب}
                      عند_التغيير={(v) => حدّث(ب.معرف_محلي, { حساب: v, حساب_فرعي: "" })}
                      نص_بديل="اختر"
                      قابل_للبحث={false}
                    />
                  </div>
                  {خيارات_فرعية.length > 0 && (
                    <div className="min-w-[120px] flex-1 space-y-1">
                      {i === 0 && (
                        <العنوان مطلوب className="mb-0">
                          {نوع === "BANK" ? "البنك" : نوع === "VODAFONE" ? "المحفظة" : "حساب إنستا"}
                        </العنوان>
                      )}
                      <قائمة_اختيار
                        الخيارات={خيارات_فرعية.map((s) => ({ القيمة: String(s.id), التسمية: s.الاسم }))}
                        القيمة={ب.حساب_فرعي}
                        عند_التغيير={(v) => حدّث(ب.معرف_محلي, { حساب_فرعي: v })}
                        نص_بديل="اختر…"
                      />
                    </div>
                  )}
                  {بنود.length > 1 && (
                    <الزر
                      type="button"
                      size="sm"
                      variant="ghost"
                      onClick={() => تعيين_بنود((س) => س.filter((x) => x.معرف_محلي !== ب.معرف_محلي))}
                      title="حذف وسيلة الدفع"
                    >
                      <Trash2 className="size-4 text-danger" />
                    </الزر>
                  )}
                </div>
              );
            })}

            <div className="flex items-center justify-between">
              {بنود.length < Math.min(4, حسابات_الخزنة.length || 1) ? (
                <الزر type="button" size="sm" variant="outline" onClick={() => تعيين_بنود((س) => [...س, بند_جديد()])}>
                  <Plus className="size-4" /> وسيلة دفع أخرى
                </الزر>
              ) : <span />}
              <div className="flex items-center gap-1.5 text-sm">
                <span className="text-muted-foreground">الإجمالي:</span>
                <نص_مبلغ القيمة={الإجمالي} النوع={Math.abs(الفرق) > 0.0001 ? "مصروف" : "إيراد"} />
              </div>
            </div>

            <div className="space-y-1.5">
              <العنوان>ملاحظات (اختياري)</العنوان>
              <الحقل value={ملاحظات} onChange={(e) => تعيين_ملاحظات(e.target.value)} />
            </div>
          </div>

          <تذييل_الحوار>
            <الزر variant="success" onClick={احفظ} disabled={جارٍ}>
              {جارٍ ? "جارٍ الحفظ…" : "تأكيد التحصيل"}
            </الزر>
            <الزر variant="outline" onClick={() => تعيين_مفتوح(false)} disabled={جارٍ}>إلغاء</الزر>
          </تذييل_الحوار>
        </محتوى_الحوار>
      </الحوار>
    </>
  );
}
