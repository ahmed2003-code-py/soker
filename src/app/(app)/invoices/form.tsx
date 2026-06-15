"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save } from "lucide-react";
import { الزر } from "@/components/ui/button";
import { الحقل, منطقة_نص } from "@/components/ui/input";
import { العنوان } from "@/components/ui/label";
import { قائمة_اختيار } from "@/components/combobox";
import { نص_مبلغ } from "@/components/money-text";
import { useإشعار } from "@/components/ui/toast";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";
import { إنشاء_فاتورة, تعديل_فاتورة } from "./actions";
import { إنشاء_طرف } from "../_parties/actions";

type بند = {
  اللون: string;
  الكمية: string;
  الوزن: string;
  التصنيف: string;
  السعر: string;
  ملاحظات: string;
};
const بند_فارغ = (): بند => ({ اللون: "", الكمية: "", الوزن: "", التصنيف: "", السعر: "", ملاحظات: "" });
const اليوم = () => new Date().toISOString().slice(0, 10);
const ع = (s: string) => Number(s.replace(/,/g, "")) || 0;

export function نموذج_فاتورة({
  العملاء: عملاء0,
  التصنيفات: تصنيفات0,
  فاتورة,
}: {
  العملاء: { id: number; name: string; phone: string | null }[];
  التصنيفات: string[];
  فاتورة?: {
    id: number;
    معرف_العميل: number;
    الهاتف: string | null;
    التاريخ: string;
    ملاحظات: string | null;
    البنود: بند[];
  };
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t } = استخدام_اللغة();
  const [عملاء, تعيين_عملاء] = React.useState(عملاء0);
  const [تصنيفات, تعيين_تصنيفات] = React.useState(تصنيفات0);
  const [عميل, تعيين_عميل] = React.useState<string>(
    فاتورة ? String(فاتورة.معرف_العميل) : ""
  );
  const [هاتف, تعيين_هاتف] = React.useState(فاتورة?.الهاتف ?? "");
  const [تاريخ, تعيين_تاريخ] = React.useState(فاتورة?.التاريخ?.slice(0, 10) ?? اليوم());
  const [ملاحظات, تعيين_ملاحظات] = React.useState(فاتورة?.ملاحظات ?? "");
  const [بنود, تعيين_بنود] = React.useState<بند[]>(فاتورة?.البنود?.length ? فاتورة.البنود : [بند_فارغ()]);
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  function حدّث(i: number, مفتاح: keyof بند, قيمة: string) {
    تعيين_بنود((س) => س.map((ب, j) => (j === i ? { ...ب, [مفتاح]: قيمة } : ب)));
  }
  function أضف_بند() {
    تعيين_بنود((س) => [...س, بند_فارغ()]);
  }
  function احذف_بند(i: number) {
    تعيين_بنود((س) => (س.length > 1 ? س.filter((_, j) => j !== i) : س));
  }

  // إجماليات حيّة
  const إجمالي_الكمية = بنود.reduce((س, ب) => س + ع(ب.الكمية), 0);
  const إجمالي_الوزن = بنود.reduce((س, ب) => س + ع(ب.الوزن), 0);
  const الإجمالي_المالي = بنود.reduce((س, ب) => س + ع(ب.السعر) * ع(ب.الوزن), 0);

  // تجميع حسب التصنيف
  const تجميع = React.useMemo(() => {
    const م = new Map<string, { كمية: number; وزن: number }>();
    for (const ب of بنود) {
      if (!ب.التصنيف) continue;
      const ح = م.get(ب.التصنيف) ?? { كمية: 0, وزن: 0 };
      ح.كمية += ع(ب.الكمية);
      ح.وزن += ع(ب.الوزن);
      م.set(ب.التصنيف, ح);
    }
    return [...م.entries()];
  }, [بنود]);

  async function أضف_عميل(الاسم: string) {
    const r = await إنشاء_طرف({ الاسم, النوع: "CUSTOMER" });
    if (!r.نجاح || !r.بيانات) return إشعار.خطأ(r.رسالة || t("inv.f.customer_add_err"));
    const جديد = { id: r.بيانات.id, name: الاسم, phone: null };
    تعيين_عملاء((س) => [...س, جديد]);
    تعيين_عميل(String(جديد.id));
    إشعار.نجاح(t("inv.f.customer_added"));
  }

  async function احفظ() {
    if (!عميل) return إشعار.خطأ(t("inv.f.pick_customer_err"));
    تعيين_جارٍ(true);
    const payload = {
      معرف_العميل: Number(عميل),
      الهاتف: هاتف,
      التاريخ: تاريخ,
      ملاحظات,
      البنود: بنود.map((ب) => ({
        اللون: ب.اللون,
        الكمية: ب.الكمية,
        الوزن: ب.الوزن,
        التصنيف: ب.التصنيف,
        السعر: ب.السعر,
        ملاحظات: ب.ملاحظات,
      })),
    };
    const r = فاتورة ? await تعديل_فاتورة(فاتورة.id, payload) : await إنشاء_فاتورة(payload);
    تعيين_جارٍ(false);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    إشعار.نجاح(r.رسالة!);
    const id = فاتورة ? فاتورة.id : (r.بيانات as { id: number }).id;
    router.push(`/invoices/${id}`);
    router.refresh();
  }

  return (
    <div className="space-y-6">
      {/* الترويسة */}
      <div className="card-soft grid gap-4 p-5 sm:grid-cols-3">
        <div className="space-y-1.5">
          <العنوان مطلوب>{t("inv.col.customer")}</العنوان>
          <قائمة_اختيار
            الخيارات={عملاء.map((c) => ({ القيمة: String(c.id), التسمية: c.name }))}
            القيمة={عميل}
            عند_التغيير={(v) => {
              تعيين_عميل(v);
              const c = عملاء.find((x) => String(x.id) === v);
              if (c?.phone && !هاتف) تعيين_هاتف(c.phone);
            }}
            عند_الإضافة={أضف_عميل}
            تسمية_الإضافة={t("party.add_customer")}
            نص_بديل={t("inv.f.pick_customer")}
          />
        </div>
        <div className="space-y-1.5">
          <العنوان>{t("party.col.phone")}</العنوان>
          <الحقل className="ltr-nums" value={هاتف} onChange={(e) => تعيين_هاتف(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <العنوان مطلوب>{t("common.date")}</العنوان>
          <الحقل type="date" value={تاريخ} onChange={(e) => تعيين_تاريخ(e.target.value)} />
        </div>
      </div>

      {/* البنود */}
      <div className="card-soft p-5">
        <div className="mb-3 flex items-center justify-between">
          <h2 className="text-lg font-semibold">{t("inv.f.items")}</h2>
          <الزر size="sm" variant="outline" onClick={أضف_بند}>
            <Plus className="size-4" /> {t("inv.f.add_item")}
          </الزر>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="text-muted-foreground">
              <tr className="border-b border-border">
                <th className="p-2 text-start">{t("inv.f.color")}</th>
                <th className="p-2 text-start">{t("inv.f.category")}</th>
                <th className="p-2 text-end">{t("inv.f.qty_count")}</th>
                <th className="p-2 text-end">{t("inv.f.weight_kg")}</th>
                <th className="p-2 text-end">{t("inv.f.price_kg")}</th>
                <th className="p-2 text-end">{t("inv.f.subtotal")}</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {بنود.map((ب, i) => (
                <tr key={i} className="border-b border-border/60">
                  <td className="p-1.5 min-w-32">
                    <الحقل value={ب.اللون} onChange={(e) => حدّث(i, "اللون", e.target.value)} placeholder={t("inv.f.color")} />
                  </td>
                  <td className="p-1.5 min-w-40">
                    <قائمة_اختيار
                      الخيارات={تصنيفات.map((c) => ({ القيمة: c, التسمية: c }))}
                      القيمة={ب.التصنيف}
                      عند_التغيير={(v) => حدّث(i, "التصنيف", v)}
                      عند_الإضافة={(جديد) => {
                        if (!تصنيفات.includes(جديد)) تعيين_تصنيفات((s) => [...s, جديد]);
                        حدّث(i, "التصنيف", جديد);
                      }}
                      تسمية_الإضافة={t("inv.f.new_category")}
                      نص_بديل={t("inv.f.category")}
                    />
                  </td>
                  <td className="p-1.5">
                    <الحقل
                      className="ltr-nums text-end"
                      selectOnFocus
                      value={ب.الكمية}
                      onChange={(e) => حدّث(i, "الكمية", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && i === بنود.length - 1) أضف_بند();
                      }}
                      placeholder="0"
                    />
                  </td>
                  <td className="p-1.5">
                    <الحقل
                      className="ltr-nums text-end"
                      selectOnFocus
                      value={ب.الوزن}
                      onChange={(e) => حدّث(i, "الوزن", e.target.value)}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="p-1.5">
                    <الحقل
                      className="ltr-nums text-end"
                      selectOnFocus
                      value={ب.السعر}
                      onChange={(e) => حدّث(i, "السعر", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" && i === بنود.length - 1) أضف_بند();
                      }}
                      placeholder="0.00"
                    />
                  </td>
                  <td className="p-1.5 text-end ltr-nums tabular-nums">
                    {(ع(ب.السعر) * ع(ب.الوزن)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                  </td>
                  <td className="p-1.5 text-center">
                    {بنود.length > 1 && (
                      <الزر size="icon" variant="ghost" onClick={() => احذف_بند(i)} title="حذف البند">
                        <Trash2 className="size-4 text-danger" />
                      </الزر>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* ملخص التجميع + الإجماليات */}
      <div className="grid gap-4 lg:grid-cols-2">
        <div className="card-soft p-5">
          <h3 className="mb-3 font-semibold">{t("inv.f.summary_by_cat")}</h3>
          {تجميع.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("inv.f.enter_items")}</p>
          ) : (
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                <tr className="border-b border-border">
                  <th className="p-2 text-start">{t("inv.f.category")}</th>
                  <th className="p-2 text-end">{t("inv.f.total_count")}</th>
                  <th className="p-2 text-end">{t("inv.col.total_weight")}</th>
                </tr>
              </thead>
              <tbody>
                {تجميع.map(([ت, ح]) => (
                  <tr key={ت} className="border-b border-border/60">
                    <td className="p-2">{ت}</td>
                    <td className="p-2 text-end ltr-nums">{ح.كمية}</td>
                    <td className="p-2 text-end ltr-nums">{ح.وزن.toFixed(2)} {t("inv.kg")}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
        <div className="card-soft space-y-2 p-5">
          <h3 className="mb-3 font-semibold">{t("inv.f.totals")}</h3>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("inv.f.total_count")}</span><span className="ltr-nums font-medium">{إجمالي_الكمية}</span></div>
          <div className="flex justify-between"><span className="text-muted-foreground">{t("inv.col.total_weight")}</span><span className="ltr-nums font-medium">{إجمالي_الوزن.toFixed(2)} {t("inv.kg")}</span></div>
          <div className="flex justify-between border-t border-border pt-2 text-lg"><span className="font-semibold">{t("inv.f.financial_total")}</span><نص_مبلغ القيمة={الإجمالي_المالي} /></div>
        </div>
      </div>

      <div className="space-y-1.5">
        <العنوان>{t("party.f.notes")}</العنوان>
        <منطقة_نص value={ملاحظات} onChange={(e) => تعيين_ملاحظات(e.target.value)} />
      </div>

      <div className="flex justify-end gap-2">
        <الزر variant="outline" onClick={() => router.back()}>{t("common.cancel")}</الزر>
        <الزر variant="success" onClick={احفظ} disabled={جارٍ}>
          <Save className="size-4" /> {جارٍ ? t("common.saving") : t("inv.f.save")}
        </الزر>
      </div>
    </div>
  );
}
