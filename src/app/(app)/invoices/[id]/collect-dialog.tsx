"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { CheckCheck, Plus, Trash2, Wallet } from "lucide-react";
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
const مفتاح_جديد = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;

/**
 * تحصيل فاتورة زائر معلّقة (وسيلة واحدة أو موزّعة حتى 4) — الخزنة تسجّل المبلغ المكتوب دائماً:
 *  - «تحصيل»: أي مبلغ؛ الأقل يسيب الفاتورة معلّقة بالباقي، والأكبر زيادته تدخل الخزنة.
 *  - «إنهاء الفاتورة» (بعد تأكيد يوضّح الفرق): نفس التحصيل + قفل الفاتورة؛ النقص مسامحة.
 * مفتاح عملية لكل فتح للحوار: الضغط المكرر لا يسجّل التحصيل مرتين (الخادم يتحقق).
 */
export function زر_تحصيل_فاتورة({
  المعرف,
  المتبقي,
  المحصّل_سابقاً = "0",
  حسابات_الخزنة,
  حسابات_فرعية,
}: {
  المعرف: number;
  المتبقي: string; // نص Decimal من الخادم — يُرسل كما هو بلا تقريب
  المحصّل_سابقاً?: string;
  حسابات_الخزنة: { id: number; النوع: TreasuryAccountType; التسمية: string }[];
  حسابات_فرعية: خريطة_حسابات_فرعية;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const [مفتوح, تعيين_مفتوح] = React.useState(false);
  const [تأكيد_الإنهاء, تعيين_تأكيد_الإنهاء] = React.useState(false);
  const [جارٍ, تعيين_جارٍ] = React.useState(false);
  const [تاريخ, تعيين_تاريخ] = React.useState(اليوم());
  const [ملاحظات, تعيين_ملاحظات] = React.useState("");
  const مفتاح_العملية = React.useRef(مفتاح_جديد());
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
    مفتاح_العملية.current = مفتاح_جديد();
    تعيين_تأكيد_الإنهاء(false);
    تعيين_تاريخ(اليوم());
    تعيين_ملاحظات("");
    تعيين_بنود([بند_جديد(المتبقي)]);
    تعيين_مفتوح(true);
  }
  const حدّث = (معرف: number, تعديل: Partial<بند>) =>
    تعيين_بنود((س) => س.map((ب) => (ب.معرف_محلي === معرف ? { ...ب, ...تعديل } : ب)));
  const نوع_حساب = (معرف: string) => حسابات_الخزنة.find((h) => String(h.id) === معرف)?.النوع ?? null;
  // الصف الفاضي يُتجاهل (الإنهاء يجوز بدون تحصيل جديد لو فيه تحصيل سابق)
  const بنود_فعلية = بنود.filter((ب) => ب.مبلغ.trim() !== "");
  const الإجمالي = بنود_فعلية.reduce((س, ب) => س + ع(ب.مبلغ), 0);
  // الفرق = المكتوب − المتبقي: موجب = زيادة تدخل الخزنة، سالب = باقي (أو مسامحة عند الإنهاء)
  const الفرق = الإجمالي - ع(المتبقي);

  /** يتحقق من البنود؛ يُرجع رسالة الخطأ أو null */
  function تحقق(للإنهاء: boolean): string | null {
    for (const ب of بنود_فعلية) {
      if (!(ع(ب.مبلغ) > 0)) return "مبلغ كل وسيلة دفع يجب أن يكون أكبر من صفر";
      if (!ب.حساب) return "اختر حساب الخزنة";
      const نوع = نوع_حساب(ب.حساب);
      if (نوع && نوع !== "CASH" && (حسابات_فرعية[نوع]?.length ?? 0) > 0 && !ب.حساب_فرعي) {
        return `اختر ${نوع === "BANK" ? "البنك" : نوع === "VODAFONE" ? "المحفظة" : "حساب إنستا"}`;
      }
    }
    if (للإنهاء) {
      if (الإجمالي <= 0 && ع(المحصّل_سابقاً) <= 0) return "لا يمكن إنهاء فاتورة بدون أي تحصيل — لو البيعة اتلغت احذف الفاتورة";
    } else if (بنود_فعلية.length === 0) {
      return "اكتب المبلغ المحصّل";
    }
    return null;
  }

  async function أرسل(إنهاء: boolean) {
    تعيين_جارٍ(true);
    const r = await حصّل_فاتورة_معلقة(المعرف, {
      التاريخ: تاريخ,
      ملاحظات: ملاحظات.trim() || null,
      إنهاء,
      مفتاح_العملية: مفتاح_العملية.current,
      بنود: بنود_فعلية.map((ب) => ({
        المبلغ: ب.مبلغ,
        معرف_الحساب: Number(ب.حساب),
        معرف_حساب_فرعي: ب.حساب_فرعي ? Number(ب.حساب_فرعي) : null,
      })),
    });
    تعيين_جارٍ(false);
    if (!r.نجاح) {
      تعيين_تأكيد_الإنهاء(false);
      return إشعار.خطأ(r.رسالة);
    }
    إشعار.نجاح(r.رسالة!);
    تعيين_مفتوح(false);
    router.refresh();
  }

  function حصّل() {
    const خطأ = تحقق(false);
    if (خطأ) return إشعار.خطأ(خطأ);
    void أرسل(false);
  }
  function اطلب_الإنهاء() {
    const خطأ = تحقق(true);
    if (خطأ) return إشعار.خطأ(خطأ);
    تعيين_تأكيد_الإنهاء(true);
  }

  return (
    <>
      <الزر variant="success" size="sm" onClick={افتح}>
        <Wallet className="size-4" /> تحصيل
      </الزر>
      <الحوار open={مفتوح} onOpenChange={(o) => !جارٍ && تعيين_مفتوح(o)}>
        <محتوى_الحوار>
          <رأس_الحوار>
            <عنوان_الحوار>تحصيل فاتورة معلّقة</عنوان_الحوار>
            <وصف_الحوار>
              المتبقي على الفاتورة: <نص_مبلغ القيمة={المتبقي} />
            </وصف_الحوار>
          </رأس_الحوار>

          {!تأكيد_الإنهاء ? (
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
                      {i === 0 && <العنوان className="mb-0">المبلغ المحصّل</العنوان>}
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
                  <نص_مبلغ القيمة={الإجمالي} />
                </div>
              </div>

              {الفرق > 0.0001 && (
                <p className="rounded-lg border border-primary-blue/30 bg-primary-blue/5 px-3 py-2 text-[13px] text-primary-blue">
                  المبلغ أكبر من المتبقي بـ <نص_مبلغ القيمة={الفرق} /> — المبلغ كله هيدخل الخزنة. اتأكد إن الرقم صح.
                </p>
              )}
              {الفرق < -0.0001 && (
                <p className="rounded-lg border border-amber-300 bg-amber-50 px-3 py-2 text-[13px] text-amber-900">
                  هيفضل متبقي <نص_مبلغ القيمة={-الفرق} /> والفاتورة معلّقة — أو دوس «إنهاء الفاتورة» لو هتسامح فيه.
                </p>
              )}

              <div className="space-y-1.5">
                <العنوان>ملاحظات (اختياري)</العنوان>
                <الحقل value={ملاحظات} onChange={(e) => تعيين_ملاحظات(e.target.value)} />
              </div>
            </div>
          ) : (
            /* ── تأكيد الإنهاء: يوضّح الفرق بالموجب أو بالسالب ── */
            <div className="space-y-3 rounded-xl border border-warning/40 bg-warning-soft/40 p-4 text-sm">
              <p className="text-base font-semibold">متأكد إنك عايز تنهي الفاتورة؟</p>
              <div className="space-y-1.5">
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المتبقي على الفاتورة</span>
                  <نص_مبلغ القيمة={المتبقي} />
                </div>
                <div className="flex justify-between">
                  <span className="text-muted-foreground">المبلغ اللي هيدخل الخزنة</span>
                  <نص_مبلغ القيمة={الإجمالي} النوع="إيراد" />
                </div>
                <div className="flex justify-between border-t border-border pt-1.5 font-semibold">
                  <span>الفرق</span>
                  <span className="ltr-nums" dir="ltr">
                    {الفرق > 0.0001 ? "+" : الفرق < -0.0001 ? "−" : ""}
                    <نص_مبلغ
                      القيمة={Math.abs(الفرق)}
                      النوع={الفرق > 0.0001 ? "إيراد" : الفرق < -0.0001 ? "مصروف" : "محايد"}
                    />
                  </span>
                </div>
              </div>
              <p className="text-[13px]">
                {الفرق < -0.0001
                  ? "الفرق ده هيتسجّل مسامحة (مش هيدخل الخزنة)، والفاتورة هتتقفل ومش هيتحصّل عليها تاني."
                  : الفرق > 0.0001
                    ? "الزيادة دي هتدخل الخزنة مع المبلغ، والفاتورة هتتقفل."
                    : "مفيش فرق — الفاتورة هتتقفل مدفوعة."}
              </p>
            </div>
          )}

          <تذييل_الحوار>
            {!تأكيد_الإنهاء ? (
              <>
                <الزر variant="success" onClick={حصّل} disabled={جارٍ}>
                  <Wallet className="size-4" /> {جارٍ ? "جارٍ الحفظ…" : "تحصيل"}
                </الزر>
                <الزر variant="outline" onClick={اطلب_الإنهاء} disabled={جارٍ}>
                  <CheckCheck className="size-4" /> إنهاء الفاتورة
                </الزر>
                <الزر variant="ghost" onClick={() => تعيين_مفتوح(false)} disabled={جارٍ}>إلغاء</الزر>
              </>
            ) : (
              <>
                <الزر variant="danger" onClick={() => void أرسل(true)} disabled={جارٍ}>
                  {جارٍ ? "جارٍ الحفظ…" : "أيوه، إنهاء الفاتورة"}
                </الزر>
                <الزر variant="outline" onClick={() => تعيين_تأكيد_الإنهاء(false)} disabled={جارٍ}>رجوع</الزر>
              </>
            )}
          </تذييل_الحوار>
        </محتوى_الحوار>
      </الحوار>
    </>
  );
}
