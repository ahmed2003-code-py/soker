"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, RotateCcw, UserX } from "lucide-react";
import { الزر } from "@/components/ui/button";
import { الحقل, منطقة_نص } from "@/components/ui/input";
import { العنوان } from "@/components/ui/label";
import { قائمة_اختيار } from "@/components/combobox";
import { Wallet } from "lucide-react";
import type { TreasuryAccountType } from "@prisma/client";
import type { خريطة_حسابات_فرعية } from "@/app/(app)/treasury/sub-account-actions";
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
  نوع_البند: "SALE" | "RETURN";
  اللون: string;
  الشركة: string;
  الكمية: string;
  الوزن: string;
  التصنيف: string;
  السعر: string;
  ملاحظات: string;
};
const بند_فارغ = (): بند => ({
  نوع_البند: "SALE",
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
  عميل_زائر: boolean;
  اسم_الزائر: string;
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
  الموردون: موردون0 = [],
  التصنيفات: تصنيفات0,
  الشركات: شركات0,
  حسابات_الخزنة,
  حسابات_فرعية,
  فاتورة,
}: {
  العملاء: { id: number; name: string; phone: string | null; balance: number }[];
  الموردون?: { id: number; name: string; phone: string | null; balance: number }[];
  حسابات_الخزنة: { id: number; النوع: TreasuryAccountType; التسمية: string }[];
  حسابات_فرعية: خريطة_حسابات_فرعية;
  التصنيفات: string[];
  الشركات: string[];
  فاتورة?: {
    id: number;
    الرقم: number | null;
    نوع_الفاتورة: "SALE" | "PURCHASE" | "SUPPLIER_RETURN";
    معرف_العميل: number | null;
    اسم_الزائر?: string | null;
    مرجع_خارجي?: string | null;
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
  const [موردون, تعيين_موردون] = React.useState(موردون0);
  const [تصنيفات, تعيين_تصنيفات] = React.useState(تصنيفات0);
  const [شركات, تعيين_شركات] = React.useState(شركات0);

  // نوع الطرف: عميل أو مورد
  const أنواع_المورد_نموذج = ["PURCHASE", "SUPPLIER_RETURN"];
  const [نوع_الطرف, تعيين_نوع_الطرف] = React.useState<"CUSTOMER" | "SUPPLIER">(
    فاتورة && أنواع_المورد_نموذج.includes(فاتورة.نوع_الفاتورة) ? "SUPPLIER" : "CUSTOMER"
  );
  // اتجاه فاتورة المورد: جاية (PURCHASE) أو رايحة (SUPPLIER_RETURN)
  const [اتجاه_المورد, تعيين_اتجاه_المورد] = React.useState<"PURCHASE" | "SUPPLIER_RETURN">(
    فاتورة?.نوع_الفاتورة === "SUPPLIER_RETURN" ? "SUPPLIER_RETURN" : "PURCHASE"
  );
  const [مرجع_خارجي, تعيين_مرجع_خارجي] = React.useState(فاتورة?.مرجع_خارجي ?? "");
  const نوع_الفاتورة_الحالي: "SALE" | "PURCHASE" | "SUPPLIER_RETURN" =
    نوع_الطرف === "SUPPLIER" ? اتجاه_المورد : "SALE";

  // وضع العميل الزائر (walk-in)
  const [عميل_زائر, تعيين_عميل_زائر] = React.useState(
    فاتورة ? فاتورة.معرف_العميل === null : false
  );
  const [اسم_الزائر, تعيين_اسم_الزائر] = React.useState(فاتورة?.اسم_الزائر ?? "");

  const [عميل, تعيين_عميل] = React.useState<string>(
    فاتورة && فاتورة.معرف_العميل ? String(فاتورة.معرف_العميل) : ""
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
    فاتورة?.الرقم != null ? String(فاتورة.الرقم) : ""
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
  const [دفعة_مفعلة, تعيين_دفعة_مفعلة] = React.useState(عميل_زائر); // إجبارية للزائر
  const [مبلغ_الدفعة, تعيين_مبلغ_الدفعة] = React.useState("");
  const [حساب_الدفعة, تعيين_حساب_الدفعة] = React.useState(
    حسابات_الخزنة[0] ? String(حسابات_الخزنة[0].id) : ""
  );
  const [حساب_فرعي_الدفعة, تعيين_حساب_فرعي_الدفعة] = React.useState("");

  const نوع_حساب_الدفعة = حسابات_الخزنة.find((h) => String(h.id) === حساب_الدفعة)?.النوع ?? null;
  const له_فرعية_دفعة = نوع_حساب_الدفعة !== null && نوع_حساب_الدفعة !== "CASH";
  const خيارات_فرعية_الدفعة = له_فرعية_دفعة && نوع_حساب_الدفعة ? (حسابات_فرعية[نوع_حساب_الدفعة] ?? []) : [];

  React.useEffect(() => {
    if (له_فرعية_دفعة && خيارات_فرعية_الدفعة.length === 1 && !حساب_فرعي_الدفعة) {
      تعيين_حساب_فرعي_الدفعة(String(خيارات_فرعية_الدفعة[0].id));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [له_فرعية_دفعة, خيارات_فرعية_الدفعة.length]);

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
      if (التالي instanceof HTMLButtonElement) {
        requestAnimationFrame(() => التالي.click());
      }
    } else {
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
        if (م.عميل_زائر) { تعيين_عميل_زائر(true); تعيين_دفعة_مفعلة(true); }
        if (م.اسم_الزائر) تعيين_اسم_الزائر(م.اسم_الزائر);
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
      const م: مسودة = { عميل, عميل_زائر, اسم_الزائر, هاتف, تاريخ, ملاحظات, بنود, أسعار_تصنيفات, رقم_الفاتورة, وقت_الحفظ: Date.now() };
      try { localStorage.setItem(مفتاح_المسودة, JSON.stringify(م)); } catch { /* تجاهل */ }
    }, 800);
    return () => { if (مؤقت.current) clearTimeout(مؤقت.current); };
  }, [عميل, عميل_زائر, اسم_الزائر, هاتف, تاريخ, ملاحظات, بنود, أسعار_تصنيفات, رقم_الفاتورة, فاتورة]);

  function تجاهل_المسودة() {
    localStorage.removeItem(مفتاح_المسودة);
    تعيين_مسودة_معلقة(false);
    تعيين_عميل(""); تعيين_عميل_زائر(false); تعيين_اسم_الزائر("");
    تعيين_هاتف(""); تعيين_تاريخ(اليوم());
    تعيين_ملاحظات(""); تعيين_بنود([بند_فارغ()]); تعيين_أسعار({});
    احصل_رقم_الفاتورة_التالي().then((n) => تعيين_رقم_الفاتورة(String(n)));
  }

  // ─── تعديل/حذف التصنيفات ─────────────────────────────────
  async function عدّل_تصنيف(قديم: string, جديد: string) {
    تعيين_تصنيفات((s) => s.map((x) => (x === قديم ? جديد : x)));
    تعيين_بنود((ب) => ب.map((b) => b.التصنيف === قديم ? { ...b, التصنيف: جديد } : b));
    تعيين_أسعار((prev) => {
      const next = { ...prev };
      if (قديم in next) { next[جديد] = next[قديم]; delete next[قديم]; }
      return next;
    });
    const r = await عدّل_تصنيف_DB(قديم, جديد);
    if (!r.نجاح) {
      تعيين_تصنيفات((s) => s.map((x) => (x === جديد ? قديم : x)));
      إشعار.خطأ(r.رسالة);
    }
  }

  async function احذف_تصنيف(قيمة: string) {
    const r = await احذف_تصنيف_DB(قيمة);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    تعيين_تصنيفات((s) => s.filter((x) => x !== قيمة));
  }

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
  function حدّث(i: number, مفتاح: keyof Omit<بند, "نوع_البند">, قيمة: string) {
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

  function بدّل_نوع_البند(i: number) {
    تعيين_بنود((س) =>
      س.map((ب, j) =>
        j === i ? { ...ب, نوع_البند: ب.نوع_البند === "RETURN" ? "SALE" : "RETURN" } : ب
      )
    );
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
  const إجمالي_المبيعات_النموذج = بنود.reduce((س, ب) => {
    if (ب.نوع_البند === "RETURN") return س;
    const سعر = ع(أسعار_تصنيفات[ب.التصنيف] ?? ب.السعر);
    return س + سعر * ع(ب.الوزن);
  }, 0);
  const إجمالي_المرتجعات_النموذج = بنود.reduce((س, ب) => {
    if (ب.نوع_البند !== "RETURN") return س;
    const سعر = ع(أسعار_تصنيفات[ب.التصنيف] ?? ب.السعر);
    return س + سعر * ع(ب.الوزن);
  }, 0);
  const الإجمالي_المالي = إجمالي_المبيعات_النموذج - إجمالي_المرتجعات_النموذج; // قد يكون سالباً
  const لها_مرتجعات = نوع_الطرف === "CUSTOMER" && إجمالي_المرتجعات_النموذج > 0;

  const تجميع = React.useMemo(() => {
    const م = new Map<string, { كمية: number; وزن: number }>();
    for (const ب of بنود) {
      if (!ب.التصنيف) continue;
      const ح = م.get(ب.التصنيف) ?? { كمية: 0, وزن: 0 };
      const إشارة = ب.نوع_البند === "RETURN" ? -1 : 1;
      ح.كمية += ع(ب.الكمية) * إشارة;
      ح.وزن += ع(ب.الوزن) * إشارة;
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

  async function أضف_مورد(الاسم: string) {
    const r = await إنشاء_طرف({ الاسم, النوع: "SUPPLIER" });
    if (!r.نجاح || !r.بيانات) return إشعار.خطأ(r.رسالة || "خطأ في إضافة المورد");
    const جديد = { id: r.بيانات.id, name: الاسم, phone: null, balance: 0 };
    تعيين_موردون((س) => [...س, جديد]);
    تعيين_عميل(String(جديد.id));
    إشعار.نجاح("تم إضافة المورد");
  }

  async function احفظ() {
    if (نوع_الطرف === "SUPPLIER" && !عميل) return إشعار.خطأ("اختر المورد");
    if (نوع_الطرف === "CUSTOMER" && !عميل_زائر && !عميل) return إشعار.خطأ(t("inv.f.pick_customer_err"));
    if (عميل_زائر && !دفعة_مفعلة) return إشعار.خطأ("العميل الزائر يتطلب تحصيل فوري — فعّل الدفعة");
    if (دفعة_مفعلة && له_فرعية_دفعة && !حساب_فرعي_الدفعة) {
      const تسمية = نوع_حساب_الدفعة === "BANK" ? "البنك" : نوع_حساب_الدفعة === "VODAFONE" ? "المحفظة" : "حساب إنستا";
      return إشعار.خطأ(`يرجى اختيار ${تسمية} للدفعة`);
    }
    تعيين_جارٍ(true);
    const رقم_مُحدد = رقم_الفاتورة.trim() ? Number(رقم_الفاتورة.replace(/,/g, "")) : null;
    const payload = {
      نوع_الفاتورة: نوع_الفاتورة_الحالي,
      مرجع_خارجي: نوع_الفاتورة_الحالي === "PURCHASE" ? (مرجع_خارجي.trim() || null) : null,
      رقم_الفاتورة_المحدد: رقم_مُحدد && رقم_مُحدد > 0 ? رقم_مُحدد : null,
      معرف_العميل: عميل_زائر ? null : (عميل ? Number(عميل) : null),
      اسم_الزائر: عميل_زائر ? (اسم_الزائر.trim() || null) : null,
      الهاتف: هاتف,
      التاريخ: تاريخ,
      ملاحظات,
      البنود: بنود.map((ب) => ({
        نوع_البند: ب.نوع_البند,
        اللون: ب.اللون,
        الشركة: ب.الشركة || null,
        الكمية: ب.الكمية,
        الوزن: ب.الوزن,
        التصنيف: ب.التصنيف,
        السعر: ب.السعر,
        ملاحظات: ب.ملاحظات,
      })),
      ...(دفعة_مفعلة && مبلغ_الدفعة && حساب_الدفعة ? {
        الدفعة: {
          المبلغ: مبلغ_الدفعة,
          معرف_الحساب: Number(حساب_الدفعة),
          معرف_حساب_فرعي: حساب_فرعي_الدفعة ? Number(حساب_فرعي_الدفعة) : null,
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
      <div className="card-soft p-5 space-y-4">
        {/* بادج نوع الفاتورة في وضع التعديل */}
        {فاتورة && (
          <span className="inline-block rounded-lg border border-border bg-muted/40 px-3 py-1 text-sm font-medium text-muted-foreground">
            {نوع_الفاتورة_الحالي === "PURCHASE"
              ? "شراء من مورد"
              : نوع_الفاتورة_الحالي === "SUPPLIER_RETURN"
              ? "مورد رايح (مرتجع)"
              : "عميل (بيع)"}
          </span>
        )}

        {/* مفتاح نوع الفاتورة — ثلاثة أوضاع */}
        {!فاتورة && (
          <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1 w-fit">
            {([
              { وضع: "CUSTOMER" as const, اتجاه: "SALE" as const,            تسمية: "عميل (بيع)" },
              { وضع: "SUPPLIER" as const, اتجاه: "SUPPLIER_RETURN" as const, تسمية: "مورد رايح (مرتجع)" },
              { وضع: "SUPPLIER" as const, اتجاه: "PURCHASE" as const,        تسمية: "شراء من مورد" },
            ]).map(({ وضع, اتجاه, تسمية }) => {
              const محدد =
                وضع === "CUSTOMER"
                  ? نوع_الطرف === "CUSTOMER"
                  : نوع_الطرف === "SUPPLIER" && اتجاه_المورد === اتجاه;
              return (
                <button
                  key={اتجاه}
                  type="button"
                  onClick={() => {
                    تعيين_نوع_الطرف(وضع);
                    if (وضع === "SUPPLIER") تعيين_اتجاه_المورد(اتجاه as "PURCHASE" | "SUPPLIER_RETURN");
                    تعيين_عميل("");
                    تعيين_هاتف("");
                    if (وضع === "SUPPLIER") تعيين_عميل_زائر(false);
                  }}
                  className={`rounded-lg px-4 py-1.5 text-sm font-medium transition-all ${
                    محدد
                      ? "bg-white shadow text-foreground dark:bg-background"
                      : "text-muted-foreground hover:text-foreground"
                  }`}
                >
                  {تسمية}
                </button>
              );
            })}
          </div>
        )}

        {/* زر عميل زائر — للعملاء فقط */}
        {نوع_الطرف === "CUSTOMER" && !فاتورة && (
          <label className="flex cursor-pointer items-center gap-2 w-fit select-none text-sm">
            <input
              type="checkbox"
              checked={عميل_زائر}
              onChange={(e) => {
                const ف = e.target.checked;
                تعيين_عميل_زائر(ف);
                if (ف) {
                  تعيين_عميل("");
                  تعيين_هاتف("");
                  تعيين_دفعة_مفعلة(true);
                }
              }}
              className="size-4 rounded accent-primary"
            />
            <UserX className="size-4 text-muted-foreground" />
            <span className="text-muted-foreground">عميل زائر (بيع نقدي مباشر — بلا حساب)</span>
          </label>
        )}

        <div className="grid gap-4 sm:grid-cols-4">
          {/* رقم الفاتورة */}
          <div className="space-y-1.5">
            {نوع_الطرف === "SUPPLIER" && اتجاه_المورد === "PURCHASE" ? (
              <>
                <العنوان>رقم فاتورة المورد</العنوان>
                <الحقل
                  className="ltr-nums"
                  value={مرجع_خارجي}
                  onChange={(e) => تعيين_مرجع_خارجي(e.target.value)}
                  placeholder="رقم الفاتورة الصادرة من المورد"
                />
              </>
            ) : (
              <>
                <العنوان>{t("inv.col.number")}</العنوان>
                <الحقل className="ltr-nums" value={رقم_الفاتورة}
                  onChange={(e) => تعيين_رقم_الفاتورة(e.target.value)} placeholder="..." />
              </>
            )}
          </div>

          {/* اختيار الطرف */}
          <div className="space-y-1.5">
            <العنوان مطلوب={!عميل_زائر}>{نوع_الطرف === "CUSTOMER" ? t("inv.col.customer") : "المورد"}</العنوان>
            {عميل_زائر ? (
              <الحقل
                autoFocus
                value={اسم_الزائر}
                onChange={(e) => تعيين_اسم_الزائر(e.target.value)}
                placeholder="اسم العميل للطباعة (اختياري)"
              />
            ) : نوع_الطرف === "CUSTOMER" ? (
              <قائمة_اختيار
                الخيارات={عملاء.map((c) => ({ القيمة: String(c.id), التسمية: c.name }))}
                القيمة={عميل}
                عند_التغيير={async (v) => {
                  تعيين_عميل(v);
                  const c = عملاء.find((x) => String(x.id) === v);
                  if (c) تعيين_هاتف(c.phone ?? "");
                  const cats = [...new Set(بنود.map((b) => b.التصنيف).filter(Boolean))];
                  if (cats.length && v) {
                    const أسعار = await احصل_آخر_أسعار(Number(v), cats);
                    if (Object.keys(أسعار).length) {
                      تعيين_أسعار((prev) => ({ ...prev, ...أسعار }));
                      تعيين_بنود((س) => س.map((ب) => (أسعار[ب.التصنيف] ? { ...ب, السعر: أسعار[ب.التصنيف] } : ب)));
                    }
                  }
                }}
                عند_الإضافة={أضف_عميل}
                تسمية_الإضافة={t("party.add_customer")}
                نص_بديل={t("inv.f.pick_customer")}
              />
            ) : (
              <قائمة_اختيار
                الخيارات={موردون.map((s) => ({ القيمة: String(s.id), التسمية: s.name }))}
                القيمة={عميل}
                عند_التغيير={(v) => {
                  تعيين_عميل(v);
                  const s = موردون.find((x) => String(x.id) === v);
                  if (s) تعيين_هاتف(s.phone ?? "");
                }}
                عند_الإضافة={أضف_مورد}
                تسمية_الإضافة="إضافة مورد"
                نص_بديل="اختر المورد"
              />
            )}
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
                {نوع_الطرف === "CUSTOMER" && <th className="p-2 w-20"></th>}
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
                <tr
                  key={i}
                  className={`border-b border-border/60 ${
                    ب.نوع_البند === "RETURN" ? "bg-amber-50/40 dark:bg-amber-900/10" : ""
                  }`}
                >
                  {/* زر نوع البند (بيع/مرتجع) — للعملاء فقط */}
                  {نوع_الطرف === "CUSTOMER" && (
                    <td className="p-1.5">
                      <button
                        type="button"
                        title={ب.نوع_البند === "RETURN" ? "مرتجع — اضغط للتبديل" : "بيع — اضغط للتبديل"}
                        onClick={() => بدّل_نوع_البند(i)}
                        className={`rounded px-2 py-0.5 text-xs font-medium border transition-colors ${
                          ب.نوع_البند === "RETURN"
                            ? "bg-amber-100 text-amber-700 border-amber-300 dark:bg-amber-900/40 dark:text-amber-300 dark:border-amber-700"
                            : "bg-muted/50 text-muted-foreground border-border hover:border-primary/40"
                        }`}
                      >
                        {ب.نوع_البند === "RETURN" ? "مرتجع" : "بيع"}
                      </button>
                    </td>
                  )}
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
                  <td className={`p-1.5 text-end ltr-nums tabular-nums text-sm ${ب.نوع_البند === "RETURN" ? "text-amber-700" : "text-muted-foreground"}`}>
                    {(() => {
                      const سعر = ع(أسعار_تصنيفات[ب.التصنيف] ?? ب.السعر);
                      const قيمة = سعر > 0 ? (سعر * ع(ب.الوزن)) : 0;
                      if (قيمة === 0) return "—";
                      const نص = قيمة.toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 });
                      return ب.نوع_البند === "RETURN" ? `(${نص})` : نص;
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
                        {مبلغ_التصنيف !== 0
                          ? Math.abs(مبلغ_التصنيف).toLocaleString("en-US", { minimumFractionDigits: 2 })
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

          {لها_مرتجعات ? (
            <>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">إجمالي المبيعات</span>
                <span className="ltr-nums font-medium">
                  {إجمالي_المبيعات_النموذج.toLocaleString("en-US", { minimumFractionDigits: 2 })}
                </span>
              </div>
              <div className="flex justify-between text-amber-700 dark:text-amber-400">
                <span>إجمالي المرتجعات</span>
                <span className="ltr-nums font-medium">
                  ({إجمالي_المرتجعات_النموذج.toLocaleString("en-US", { minimumFractionDigits: 2 })})
                </span>
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-lg">
                <span className="font-semibold">صافي الفاتورة</span>
                <نص_مبلغ القيمة={الإجمالي_المالي} />
              </div>
            </>
          ) : (
            <div className="flex justify-between border-t border-border pt-2 text-lg">
              <span className="font-semibold">{t("inv.f.financial_total")}</span>
              <نص_مبلغ القيمة={الإجمالي_المالي} />
            </div>
          )}

          {/* رصيد الطرف بعد الفاتورة */}
          {(() => {
            if (عميل_زائر) return null; // لا يوجد رصيد للزائر
            const قائمة = نوع_الطرف === "CUSTOMER" ? عملاء : موردون;
            const العميل_المحدد = قائمة.find((c) => String(c.id) === عميل);
            if (!العميل_المحدد) return null;
            const الرصيد_الحالي = العميل_المحدد.balance;
            const مبلغ_دفعة_فعلي = دفعة_مفعلة ? (ع(مبلغ_الدفعة) || 0) : 0;
            let الرصيد_الجديد: number;
            if (نوع_الطرف === "CUSTOMER") {
              // مبيعات ترفع الرصيد، مرتجعات تخفضه
              الرصيد_الجديد = الرصيد_الحالي + إجمالي_المبيعات_النموذج - إجمالي_المرتجعات_النموذج - مبلغ_دفعة_فعلي;
            } else {
              // PURCHASE ترفع المستحق، SUPPLIER_RETURN تخفضه
              const يقلل = نوع_الفاتورة_الحالي === "SUPPLIER_RETURN";
              الرصيد_الجديد = الرصيد_الحالي + (يقلل ? -الإجمالي_المالي : الإجمالي_المالي) - مبلغ_دفعة_فعلي;
            }
            const تسمية_رصيد = نوع_الطرف === "CUSTOMER" ? "رصيد العميل الحالي" : "رصيد المورد الحالي";
            return (
              <div className="mt-3 rounded-xl border border-primary-blue/30 bg-primary-blue/5 p-3 text-sm space-y-1.5">
                <div className="flex justify-between text-muted-foreground">
                  <span>{تسمية_رصيد}</span>
                  <نص_مبلغ القيمة={Math.abs(الرصيد_الحالي)} النوع={الرصيد_الحالي > 0 ? "مصروف" : "محايد"} />
                </div>
                {لها_مرتجعات ? (
                  <>
                    <div className="flex justify-between text-muted-foreground">
                      <span>+ مبيعات</span>
                      <نص_مبلغ القيمة={إجمالي_المبيعات_النموذج} />
                    </div>
                    <div className="flex justify-between text-amber-700 dark:text-amber-400">
                      <span>− مرتجعات</span>
                      <نص_مبلغ القيمة={إجمالي_المرتجعات_النموذج} النوع="إيراد" />
                    </div>
                  </>
                ) : (
                  <div className="flex justify-between text-muted-foreground">
                    <span>
                      {نوع_الفاتورة_الحالي === "PURCHASE" ? "+ فاتورة من المورد" :
                       نوع_الفاتورة_الحالي === "SUPPLIER_RETURN" ? "− مرتجع إلى المورد" :
                       "+ هذه الفاتورة"}
                    </span>
                    <نص_مبلغ القيمة={الإجمالي_المالي} />
                  </div>
                )}
                {مبلغ_دفعة_فعلي > 0 && (
                  <div className="flex justify-between text-success">
                    <span>− الدفعة المسجّلة</span>
                    <نص_مبلغ القيمة={مبلغ_دفعة_فعلي} النوع="إيراد" />
                  </div>
                )}
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

      {/* ── تسجيل دفعة ── */}
      <div className="card-soft p-4">
        <label className="flex cursor-pointer items-center gap-2.5 select-none">
          <input
            type="checkbox"
            checked={دفعة_مفعلة}
            disabled={عميل_زائر} // إجبارية للزائر
            onChange={(e) => {
              if (عميل_زائر) return;
              تعيين_دفعة_مفعلة(e.target.checked);
              if (e.target.checked && !مبلغ_الدفعة && الإجمالي_المالي > 0) {
                تعيين_مبلغ_الدفعة(String(الإجمالي_المالي));
              }
            }}
            className="size-4 rounded accent-primary"
          />
          <Wallet className="size-4 text-success" />
          <span className="font-medium">
            {عميل_زائر
              ? "تحصيل نقدي فوري (مطلوب)"
              : نوع_الفاتورة_الحالي === "PURCHASE"
              ? "تسجيل دفع للمورد مع الفاتورة"
              : "تسجيل دفعة مع الفاتورة"}
          </span>
        </label>

        {دفعة_مفعلة && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 border-t border-border pt-3">
            <div className="space-y-1.5">
              <العنوان مطلوب>
                {نوع_الفاتورة_الحالي === "PURCHASE" ? "المبلغ المدفوع للمورد" : "المبلغ المحصّل"}
              </العنوان>
              <الحقل
                selectOnFocus
                className="ltr-nums"
                value={مبلغ_الدفعة}
                onChange={(e) => تعيين_مبلغ_الدفعة(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <العنوان مطلوب>طريقة الدفع / الخزنة</العنوان>
              <قائمة_اختيار
                الخيارات={حسابات_الخزنة.map((h) => ({ القيمة: String(h.id), التسمية: h.التسمية }))}
                القيمة={حساب_الدفعة}
                عند_التغيير={(v) => { تعيين_حساب_الدفعة(v); تعيين_حساب_فرعي_الدفعة(""); }}
                نص_بديل="اختر"
                قابل_للبحث={false}
              />
            </div>
            {له_فرعية_دفعة && (
              <div className="space-y-1.5 sm:col-span-2">
                <العنوان مطلوب>
                  {نوع_حساب_الدفعة === "BANK" ? "البنك" : نوع_حساب_الدفعة === "VODAFONE" ? "المحفظة" : "حساب إنستا"}
                </العنوان>
                <قائمة_اختيار
                  الخيارات={خيارات_فرعية_الدفعة.map((s) => ({ القيمة: String(s.id), التسمية: s.الاسم }))}
                  القيمة={حساب_فرعي_الدفعة}
                  عند_التغيير={تعيين_حساب_فرعي_الدفعة}
                  نص_بديل="اختر…"
                />
              </div>
            )}
          </div>
        )}
      </div>

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
