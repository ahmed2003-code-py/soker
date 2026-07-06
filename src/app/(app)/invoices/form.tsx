"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, RotateCcw } from "lucide-react";
import { الزر } from "@/components/ui/button";
import { الحقل, منطقة_نص } from "@/components/ui/input";
import { العنوان } from "@/components/ui/label";
import { قائمة_اختيار } from "@/components/combobox";
import { Wallet } from "lucide-react";
import { منتقي_تاريخ } from "@/components/date-picker";
import { نص_مبلغ } from "@/components/money-text";
import { useإشعار } from "@/components/ui/toast";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";
import {
  إنشاء_فاتورة,
  تعديل_فاتورة,
  احصل_رقم_الفاتورة_التالي,
  عدّل_تصنيف_DB,
  احذف_تصنيف_DB,
  عدّل_شركة_DB,
  احذف_شركة_DB,
  أضف_للقائمة_DB,
  احصل_آخر_أسعار,
} from "./actions";
import { إنشاء_طرف } from "../_parties/actions";

type بند = {
  اللون: string;
  الشركة: string;
  الكمية: string;
  الوزن: string;
  التصنيف: string;
  السعر: string;
  ملاحظات: string;
};
const بند_فارغ = (): بند => ({
  اللون: "",
  الشركة: "",
  الكمية: "",
  الوزن: "",
  التصنيف: "",
  السعر: "",
  ملاحظات: "",
});
const اليوم = () => new Date().toLocaleDateString("en-CA", { timeZone: "Africa/Cairo" });
const ع = (s: string) => Number(s.replace(/,/g, "")) || 0;

const مفتاح_المسودة = "soker_invoice_draft_new";

type مسودة = {
  عميل: string;
  هاتف: string;
  تاريخ: string;
  ملاحظات: string;
  بنود: بند[];
  أسعار_تصنيفات: Record<string, string>;
  رقم_الفاتورة: string;
  وقت_الحفظ: number;
};

// ─── refs للتنقل بـ Enter ───────────────────────────────────
type مراجع_صف = {
  اللون: HTMLInputElement | null;
  شركة: HTMLButtonElement | null;
  تصنيف: HTMLButtonElement | null;
  الكمية: HTMLInputElement | null;
  الوزن: HTMLInputElement | null;
};
const ترتيب: (keyof مراجع_صف)[] = ["اللون", "شركة", "تصنيف", "الكمية", "الوزن"];

export function نموذج_فاتورة({
  العملاء: عملاء0,
  التصنيفات: تصنيفات0,
  الشركات: شركات0,
  حسابات_الخزنة,
  فاتورة,
}: {
  العملاء: { id: number; name: string; phone: string | null; balance: number }[];
  حسابات_الخزنة: { id: number; التسمية: string }[];
  التصنيفات: string[];
  الشركات: string[];
  فاتورة?: {
    id: number;
    الرقم: number;
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
  const [شركات, تعيين_شركات] = React.useState(شركات0);
  const [عميل, تعيين_عميل] = React.useState<string>(
    فاتورة ? String(فاتورة.معرف_العميل) : ""
  );
  const [هاتف, تعيين_هاتف] = React.useState(فاتورة?.الهاتف ?? "");
  const [تاريخ, تعيين_تاريخ] = React.useState(
    فاتورة?.التاريخ?.slice(0, 10) ?? اليوم()
  );
  const [ملاحظات, تعيين_ملاحظات] = React.useState(فاتورة?.ملاحظات ?? "");
  const [بنود, تعيين_بنود] = React.useState<بند[]>(
    فاتورة?.البنود?.length ? فاتورة.البنود : [بند_فارغ()]
  );
  const [رقم_الفاتورة, تعيين_رقم_الفاتورة] = React.useState<string>(
    فاتورة ? String(فاتورة.الرقم) : ""
  );
  const [أسعار_تصنيفات, تعيين_أسعار] = React.useState<Record<string, string>>(() => {
    const م: Record<string, string> = {};
    for (const ب of فاتورة?.البنود ?? []) {
      if (ب.التصنيف && ب.السعر && !م[ب.التصنيف]) م[ب.التصنيف] = ب.السعر;
    }
    return م;
  });
  const [جارٍ, تعيين_جارٍ] = React.useState(false);
  const [مسودة_معلقة, تعيين_مسودة_معلقة] = React.useState(false);

  // ─── الدفعة الفورية ───────────────────────────────────────
  const [دفعة_مفعلة, تعيين_دفعة_مفعلة] = React.useState(false);
  const [مبلغ_الدفعة, تعيين_مبلغ_الدفعة] = React.useState("");
  const [حساب_الدفعة, تعيين_حساب_الدفعة] = React.useState(
    حسابات_الخزنة[0] ? String(حسابات_الخزنة[0].id) : ""
  );
  const [طريقة_الدفع, تعيين_طريقة_الدفع] = React.useState("");

  // ─── refs للتنقل ───────────────────────────────────────────
  const مراجع = React.useRef<مراجع_صف[]>([]);

  function صف(i: number): مراجع_صف {
    if (!مراجع.current[i]) {
      مراجع.current[i] = { اللون: null, شركة: null, تصنيف: null, الكمية: null, الوزن: null };
    }
    return مراجع.current[i];
  }

  function انتقل(i: number, حقل: keyof مراجع_صف) {
    const idx = ترتيب.indexOf(حقل);
    const refs = مراجع.current[i];
    if (!refs) return;
    if (idx < ترتيب.length - 1) {
      const التالي = refs[ترتيب[idx + 1]];
      التالي?.focus();
      // لو الحقل التالي combobox (زر) → افتحه فوراً بدل ما المستخدم يضغط Enter مرة تانية
      if (التالي instanceof HTMLButtonElement) {
        requestAnimationFrame(() => التالي.click());
      }
    } else {
      // آخر حقل في السطر → أضف سطراً جديداً وانتقل إليه
      if (i === بنود.length - 1) {
        تعيين_بنود((س) => [...س, بند_فارغ()]);
        requestAnimationFrame(() => مراجع.current[i + 1]?.اللون?.focus());
      } else {
        مراجع.current[i + 1]?.اللون?.focus();
      }
    }
  }

  // ─── استرداد المسودة ──────────────────────────────────────
  React.useEffect(() => {
    if (فاتورة) return;
    try {
      const محفوظة = localStorage.getItem(مفتاح_المسودة);
      if (محفوظة) {
        const م: مسودة = JSON.parse(محفوظة);
        if (م.عميل) تعيين_عميل(م.عميل);
        if (م.هاتف) تعيين_هاتف(م.هاتف);
        if (م.تاريخ) تعيين_تاريخ(م.تاريخ);
        if (م.ملاحظات) تعيين_ملاحظات(م.ملاحظات);
        if (م.بنود?.length) تعيين_بنود(م.بنود);
        if (م.أسعار_تصنيفات) تعيين_أسعار(م.أسعار_تصنيفات);
        if (م.رقم_الفاتورة) {
          تعيين_رقم_الفاتورة(م.رقم_الفاتورة);
          تعيين_مسودة_معلقة(true);
          return;
        }
      }
    } catch { /* تجاهل */ }
    احصل_رقم_الفاتورة_التالي().then((n) => تعيين_رقم_الفاتورة(String(n)));
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ─── حفظ تلقائي للمسودة ──────────────────────────────────
  const مؤقت = React.useRef<ReturnType<typeof setTimeout> | null>(null);
  React.useEffect(() => {
    if (فاتورة) return;
    if (مؤقت.current) clearTimeout(مؤقت.current);
    مؤقت.current = setTimeout(() => {
      const م: مسودة = { عميل, هاتف, تاريخ, ملاحظات, بنود, أسعار_تصنيفات, رقم_الفاتورة, وقت_الحفظ: Date.now() };
      try { localStorage.setItem(مفتاح_المسودة, JSON.stringify(م)); } catch { /* تجاهل */ }
    }, 800);
    return () => { if (مؤقت.current) clearTimeout(مؤقت.current); };
  }, [عميل, هاتف, تاريخ, ملاحظات, بنود, أسعار_تصنيفات, رقم_الفاتورة, فاتورة]);

  function تجاهل_المسودة() {
    localStorage.removeItem(مفتاح_المسودة);
    تعيين_مسودة_معلقة(false);
    تعيين_عميل(""); تعيين_هاتف(""); تعيين_تاريخ(اليوم());
    تعيين_ملاحظات(""); تعيين_بنود([بند_فارغ()]); تعيين_أسعار({});
    احصل_رقم_الفاتورة_التالي().then((n) => تعيين_رقم_الفاتورة(String(n)));
  }

  // ─── تعديل/حذف التصنيفات (تحفظ في settings — لا تمس الفواتير القديمة) ──
  async function عدّل_تصنيف(قديم: string, جديد: string) {
    // تحديث محلي فوري
    تعيين_تصنيفات((s) => s.map((x) => (x === قديم ? جديد : x)));
    تعيين_بنود((ب) => ب.map((b) => b.التصنيف === قديم ? { ...b, التصنيف: جديد } : b));
    تعيين_أسعار((prev) => {
      const next = { ...prev };
      if (قديم in next) { next[جديد] = next[قديم]; delete next[قديم]; }
      return next;
    });
    const r = await عدّل_تصنيف_DB(قديم, جديد);
    if (!r.نجاح) {
      // تراجع عند الخطأ
      تعيين_تصنيفات((s) => s.map((x) => (x === جديد ? قديم : x)));
      إشعار.خطأ(r.رسالة);
    }
  }

  async function احذف_تصنيف(قيمة: string) {
    const r = await احذف_تصنيف_DB(قيمة);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    تعيين_تصنيفات((s) => s.filter((x) => x !== قيمة));
  }

  // ─── تعديل/حذف الشركات (تحفظ في settings — لا تمس الفواتير القديمة) ──
  async function عدّل_شركة(قديم: string, جديد: string) {
    تعيين_شركات((s) => s.map((x) => (x === قديم ? جديد : x)));
    تعيين_بنود((ب) => ب.map((b) => b.الشركة === قديم ? { ...b, الشركة: جديد } : b));
    const r = await عدّل_شركة_DB(قديم, جديد);
    if (!r.نجاح) {
      تعيين_شركات((s) => s.map((x) => (x === جديد ? قديم : x)));
      إشعار.خطأ(r.رسالة);
    }
  }

  async function احذف_شركة(قيمة: string) {
    const r = await احذف_شركة_DB(قيمة);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    تعيين_شركات((s) => s.filter((x) => x !== قيمة));
  }

  // ─── البنود ───────────────────────────────────────────────
  function حدّث(i: number, مفتاح: keyof بند, قيمة: string) {
    if (مفتاح === "التصنيف") {
      تعيين_بنود((س) =>
        س.map((ب, j) =>
          j === i ? { ...ب, التصنيف: قيمة, السعر: أسعار_تصنيفات[قيمة] ?? "" } : ب
        )
      );
      return;
    }
    تعيين_بنود((س) => س.map((ب, j) => (j === i ? { ...ب, [مفتاح]: قيمة } : ب)));
  }

  function حدّث_سعر_تصنيف(تصنيف: string, سعر: string) {
    تعيين_أسعار((prev) => ({ ...prev, [تصنيف]: سعر }));
    تعيين_بنود((س) => س.map((ب) => (ب.التصنيف === تصنيف ? { ...ب, السعر: سعر } : ب)));
  }

  function أضف_بند() {
    تعيين_بنود((س) => [...س, بند_فارغ()]);
  }

  function احذف_بند(i: number) {
    تعيين_بنود((س) => (س.length > 1 ? س.filter((_, j) => j !== i) : س));
    مراجع.current.splice(i, 1);
  }

  // ─── إجماليات ─────────────────────────────────────────────
  const إجمالي_الكمية = بنود.reduce((س, ب) => س + ع(ب.الكمية), 0);
  const إجمالي_الوزن = بنود.reduce((س, ب) => س + ع(ب.الوزن), 0);
  const الإجمالي_المالي = بنود.reduce((س, ب) => {
    const سعر = ع(أسعار_تصنيفات[ب.التصنيف] ?? ب.السعر);
    return س + سعر * ع(ب.الوزن);
  }, 0);

  const تجميع = React.useMemo(() => {
    const م = new Map<string, { كمية: number; وزن: number }>();
    for (const ب of بنود) {
      if (!ب.التصنيف) continue;
      const ح = م.get(ب.التصنيف) ?? { كمية: 0, وزن: 0 };
      ح.كمية += ع(ب.الكمية); ح.وزن += ع(ب.الوزن);
      م.set(ب.التصنيف, ح);
    }
    return [...م.entries()];
  }, [بنود]);

  async function أضف_عميل(الاسم: string) {
    const r = await إنشاء_طرف({ الاسم, النوع: "CUSTOMER" });
    if (!r.نجاح || !r.بيانات) return إشعار.خطأ(r.رسالة || t("inv.f.customer_add_err"));
    const جديد = { id: r.بيانات.id, name: الاسم, phone: null, balance: 0 };
    تعيين_عملاء((س) => [...س, جديد]);
    تعيين_عميل(String(جديد.id));
    إشعار.نجاح(t("inv.f.customer_added"));
  }

  async function احفظ() {
    if (!عميل) return إشعار.خطأ(t("inv.f.pick_customer_err"));
    تعيين_جارٍ(true);
    const رقم_مُحدد = رقم_الفاتورة.trim() ? Number(رقم_الفاتورة.replace(/,/g, "")) : null;
    const payload = {
      رقم_الفاتورة_المحدد: رقم_مُحدد && رقم_مُحدد > 0 ? رقم_مُحدد : null,
      معرف_العميل: Number(عميل),
      الهاتف: هاتف,
      التاريخ: تاريخ,
      ملاحظات,
      البنود: بنود.map((ب) => ({
        اللون: ب.اللون,
        الشركة: ب.الشركة || null,
        الكمية: ب.الكمية,
        الوزن: ب.الوزن,
        التصنيف: ب.التصنيف,
        السعر: ب.السعر,
        ملاحظات: ب.ملاحظات,
      })),
      // دفعة فورية (فاتورة جديدة فقط)
      ...(!فاتورة && دفعة_مفعلة && مبلغ_الدفعة && حساب_الدفعة ? {
        الدفعة: {
          المبلغ: مبلغ_الدفعة,
          معرف_الحساب: Number(حساب_الدفعة),
          طريقة_الدفع: طريقة_الدفع || null,
        },
      } : {}),
    };
    const r = فاتورة
      ? await تعديل_فاتورة(فاتورة.id, payload)
      : await إنشاء_فاتورة(payload);
    تعيين_جارٍ(false);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    if (!فاتورة) localStorage.removeItem(مفتاح_المسودة);
    إشعار.نجاح(r.رسالة!);
    const id = فاتورة ? فاتورة.id : (r.بيانات as { id: number }).id;
    router.push(`/invoices/${id}`);
    router.refresh();
  }

  // ─── JSX ──────────────────────────────────────────────────
  return (
    <div className="space-y-6">
      {/* بانر المسودة */}
      {مسودة_معلقة && (
        <div className="flex items-center justify-between gap-4 rounded-xl border border-amber-200 bg-amber-50 px-5 py-3 text-sm text-amber-800">
          <div className="flex items-center gap-2">
            <RotateCcw className="size-4 shrink-0" />
            <span>تم استرداد مسودة محفوظة — يمكنك الاستمرار من حيث توقفت.</span>
          </div>
          <الزر size="sm" variant="outline"
            className="border-amber-400 text-amber-700 hover:bg-amber-100"
            onClick={تجاهل_المسودة}>
            تجاهل المسودة
          </الزر>
        </div>
      )}

      {/* الترويسة */}
      <div className="card-soft grid gap-4 p-5 sm:grid-cols-4">
        <div className="space-y-1.5">
          <العنوان>{t("inv.col.number")}</العنوان>
          <الحقل className="ltr-nums" value={رقم_الفاتورة}
            onChange={(e) => تعيين_رقم_الفاتورة(e.target.value)} placeholder="..." />
        </div>
        <div className="space-y-1.5">
          <العنوان مطلوب>{t("inv.col.customer")}</العنوان>
          <قائمة_اختيار
            الخيارات={عملاء.map((c) => ({ القيمة: String(c.id), التسمية: c.name }))}
            القيمة={عميل}
            عند_التغيير={async (v) => {
              تعيين_عميل(v);
              const c = عملاء.find((x) => String(x.id) === v);
              if (c) تعيين_هاتف(c.phone ?? "");
              // جلب آخر أسعار لجميع التصنيفات المختارة حالياً
              const cats = [...new Set(بنود.map((b) => b.التصنيف).filter(Boolean))];
              if (cats.length && v) {
                const أسعار = await احصل_آخر_أسعار(Number(v), cats);
                if (Object.keys(أسعار).length) {
                  تعيين_أسعار((prev) => ({ ...prev, ...أسعار }));
                  تعيين_بنود((س) =>
                    س.map((ب) => (أسعار[ب.التصنيف] ? { ...ب, السعر: أسعار[ب.التصنيف] } : ب))
                  );
                }
              }
            }}
            عند_الإضافة={أضف_عميل}
            تسمية_الإضافة={t("party.add_customer")}
            نص_بديل={t("inv.f.pick_customer")}
          />
        </div>
        <div className="space-y-1.5">
          <العنوان>{t("party.col.phone")}</العنوان>
          <الحقل className="ltr-nums" value={هاتف}
            onChange={(e) => تعيين_هاتف(e.target.value)} />
        </div>
        <div className="space-y-1.5">
          <العنوان مطلوب>{t("common.date")}</العنوان>
          <منتقي_تاريخ القيمة={تاريخ} عند_التغيير={تعيين_تاريخ} />
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
                <th className="p-2 text-start">الشركة</th>
                <th className="p-2 text-start">{t("inv.f.category")}</th>
                <th className="p-2 text-end">{t("inv.f.qty_count")}</th>
                <th className="p-2 text-end">{t("inv.f.weight_kg")}</th>
                <th className="p-2 text-end">{t("inv.f.subtotal")}</th>
                <th className="p-2"></th>
              </tr>
            </thead>
            <tbody>
              {بنود.map((ب, i) => (
                <tr key={i} className="border-b border-border/60">
                  {/* اللون */}
                  <td className="p-1.5 min-w-28">
                    <الحقل
                      ref={(el) => { صف(i).اللون = el; }}
                      value={ب.اللون}
                      onChange={(e) => حدّث(i, "اللون", e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); انتقل(i, "اللون"); } }}
                      placeholder={t("inv.f.color")}
                    />
                  </td>
                  {/* الشركة */}
                  <td className="p-1.5 min-w-36">
                    <قائمة_اختيار
                      triggerRef={(el) => { صف(i).شركة = el; }}
                      الخيارات={شركات.map((s) => ({ القيمة: s, التسمية: s }))}
                      القيمة={ب.الشركة || null}
                      عند_التغيير={(v) => حدّث(i, "الشركة", v)}
                      عند_الإضافة={async (جديد) => {
                        if (!شركات.includes(جديد)) تعيين_شركات((s) => [...s, جديد]);
                        حدّث(i, "الشركة", جديد);
                        await أضف_للقائمة_DB("شركة", جديد);
                      }}
                      عند_الاختيار={() => انتقل(i, "شركة")}
                      عند_التعديل={عدّل_شركة}
                      عند_الحذف={احذف_شركة}
                      تسمية_الإضافة="إضافة شركة"
                      نص_بديل="الشركة"
                    />
                  </td>
                  {/* التصنيف */}
                  <td className="p-1.5 min-w-36">
                    <قائمة_اختيار
                      triggerRef={(el) => { صف(i).تصنيف = el; }}
                      الخيارات={تصنيفات.map((c) => ({ القيمة: c, التسمية: c }))}
                      القيمة={ب.التصنيف}
                      عند_التغيير={async (v) => {
                        حدّث(i, "التصنيف", v);
                        // جلب آخر سعر للعميل والتصنيف — فقط إذا لم يكن هناك سعر محدد بعد
                        if (عميل && v && !أسعار_تصنيفات[v]) {
                          const أسعار = await احصل_آخر_أسعار(Number(عميل), [v]);
                          if (أسعار[v]) {
                            تعيين_أسعار((prev) => ({ ...prev, [v]: أسعار[v] }));
                            تعيين_بنود((س) =>
                              س.map((ب2, j) => (j === i ? { ...ب2, السعر: أسعار[v] } : ب2))
                            );
                          }
                        }
                      }}
                      عند_الإضافة={async (جديد) => {
                        if (!تصنيفات.includes(جديد)) تعيين_تصنيفات((s) => [...s, جديد]);
                        حدّث(i, "التصنيف", جديد);
                        await أضف_للقائمة_DB("تصنيف", جديد);
                      }}
                      عند_الاختيار={() => انتقل(i, "تصنيف")}
                      عند_التعديل={عدّل_تصنيف}
                      عند_الحذف={احذف_تصنيف}
                      تسمية_الإضافة={t("inv.f.new_category")}
                      نص_بديل={t("inv.f.category")}
                    />
                  </td>
                  {/* الكمية */}
                  <td className="p-1.5">
                    <الحقل
                      ref={(el) => { صف(i).الكمية = el; }}
                      className="ltr-nums text-end"
                      selectOnFocus
                      value={ب.الكمية}
                      onChange={(e) => حدّث(i, "الكمية", e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); انتقل(i, "الكمية"); } }}
                      placeholder="0"
                    />
                  </td>
                  {/* الوزن */}
                  <td className="p-1.5">
                    <الحقل
                      ref={(el) => { صف(i).الوزن = el; }}
                      className="ltr-nums text-end"
                      selectOnFocus
                      value={ب.الوزن}
                      onChange={(e) => حدّث(i, "الوزن", e.target.value)}
                      onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); انتقل(i, "الوزن"); } }}
                      placeholder="0.00"
                    />
                  </td>
                  {/* المجموع */}
                  <td className="p-1.5 text-end ltr-nums tabular-nums text-muted-foreground text-sm">
                    {(() => {
                      const سعر = ع(أسعار_تصنيفات[ب.التصنيف] ?? ب.السعر);
                      return سعر > 0
                        ? (سعر * ع(ب.الوزن)).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })
                        : "—";
                    })()}
                  </td>
                  {/* حذف */}
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
                  <th className="p-2 text-end">{t("inv.f.price_kg")}</th>
                  <th className="p-2 text-end">{t("inv.f.subtotal")}</th>
                </tr>
              </thead>
              <tbody>
                {تجميع.map(([ت, ح]) => {
                  const سعر_التصنيف = أسعار_تصنيفات[ت] ?? "";
                  const مبلغ_التصنيف = ع(سعر_التصنيف) * ح.وزن;
                  return (
                    <tr key={ت} className="border-b border-border/60">
                      <td className="p-2 font-medium">{ت}</td>
                      <td className="p-2 text-end ltr-nums">{ح.كمية}</td>
                      <td className="p-2 text-end ltr-nums">{ح.وزن.toFixed(2)} {t("inv.kg")}</td>
                      <td className="p-1.5">
                        <الحقل className="ltr-nums text-end w-24" selectOnFocus
                          value={سعر_التصنيف}
                          onChange={(e) => حدّث_سعر_تصنيف(ت, e.target.value)}
                          placeholder="0.00" />
                      </td>
                      <td className="p-2 text-end ltr-nums font-medium">
                        {مبلغ_التصنيف > 0
                          ? مبلغ_التصنيف.toLocaleString("en-US", { minimumFractionDigits: 2 })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
        <div className="card-soft space-y-2 p-5">
          <h3 className="mb-3 font-semibold">{t("inv.f.totals")}</h3>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("inv.f.total_count")}</span>
            <span className="ltr-nums font-medium">{إجمالي_الكمية}</span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted-foreground">{t("inv.col.total_weight")}</span>
            <span className="ltr-nums font-medium">{إجمالي_الوزن.toFixed(2)} {t("inv.kg")}</span>
          </div>
          <div className="flex justify-between border-t border-border pt-2 text-lg">
            <span className="font-semibold">{t("inv.f.financial_total")}</span>
            <نص_مبلغ القيمة={الإجمالي_المالي} />
          </div>

          {/* رصيد العميل بعد الفاتورة */}
          {(() => {
            const العميل_المحدد = عملاء.find((c) => String(c.id) === عميل);
            if (!العميل_المحدد || الإجمالي_المالي === 0) return null;
            const الرصيد_الحالي = العميل_المحدد.balance;
            const الرصيد_الجديد = الرصيد_الحالي + الإجمالي_المالي;
            return (
              <div className="mt-3 rounded-xl border border-primary-blue/30 bg-primary-blue/5 p-3 text-sm space-y-1.5">
                <div className="flex justify-between text-muted-foreground">
                  <span>رصيد العميل الحالي</span>
                  <نص_مبلغ القيمة={Math.abs(الرصيد_الحالي)} النوع={الرصيد_الحالي > 0 ? "مصروف" : "محايد"} />
                </div>
                <div className="flex justify-between text-muted-foreground">
                  <span>+ هذه الفاتورة</span>
                  <نص_مبلغ القيمة={الإجمالي_المالي} />
                </div>
                <div className="flex justify-between border-t border-primary-blue/20 pt-1.5 font-semibold text-primary-blue">
                  <span>الرصيد بعد الفاتورة</span>
                  <نص_مبلغ القيمة={Math.abs(الرصيد_الجديد)} النوع={الرصيد_الجديد > 0 ? "مصروف" : "محايد"} />
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      <div className="space-y-1.5">
        <العنوان>{t("party.f.notes")}</العنوان>
        <منطقة_نص value={ملاحظات} onChange={(e) => تعيين_ملاحظات(e.target.value)} />
      </div>

      {/* ── دفعة فورية — فاتورة جديدة فقط ── */}
      {!فاتورة && (
        <div className="card-soft p-4">
          <label className="flex cursor-pointer items-center gap-2.5 select-none">
            <input
              type="checkbox"
              checked={دفعة_مفعلة}
              onChange={(e) => {
                تعيين_دفعة_مفعلة(e.target.checked);
                if (e.target.checked && !مبلغ_الدفعة && الإجمالي_المالي > 0) {
                  تعيين_مبلغ_الدفعة(String(الإجمالي_المالي));
                }
              }}
              className="size-4 rounded accent-primary"
            />
            <Wallet className="size-4 text-success" />
            <span className="font-medium">تسجيل دفعة مع الفاتورة</span>
          </label>

          {دفعة_مفعلة && (
            <div className="mt-3 grid gap-3 sm:grid-cols-3 border-t border-border pt-3">
              <div className="space-y-1.5">
                <العنوان مطلوب>المبلغ المدفوع</العنوان>
                <الحقل
                  selectOnFocus
                  className="ltr-nums"
                  value={مبلغ_الدفعة}
                  onChange={(e) => تعيين_مبلغ_الدفعة(e.target.value)}
                  placeholder="0.00"
                />
              </div>
              <div className="space-y-1.5">
                <العنوان مطلوب>حساب الخزنة</العنوان>
                <قائمة_اختيار
                  الخيارات={حسابات_الخزنة.map((h) => ({ القيمة: String(h.id), التسمية: h.التسمية }))}
                  القيمة={حساب_الدفعة}
                  عند_التغيير={تعيين_حساب_الدفعة}
                  نص_بديل="اختر الحساب"
                  قابل_للبحث={false}
                />
              </div>
              <div className="space-y-1.5">
                <العنوان>طريقة الدفع</العنوان>
                <الحقل
                  value={طريقة_الدفع}
                  onChange={(e) => تعيين_طريقة_الدفع(e.target.value)}
                  placeholder="نقدي / تحويل / شيك…"
                />
              </div>
            </div>
          )}
        </div>
      )}

      <div className="flex justify-end gap-2">
        <الزر variant="outline" onClick={() => router.back()}>{t("common.cancel")}</الزر>
        <الزر variant="success" onClick={احفظ} disabled={جارٍ}>
          <Save className="size-4" />{" "}
          {جارٍ ? t("common.saving") : t("inv.f.save")}
        </الزر>
      </div>
    </div>
  );
}
