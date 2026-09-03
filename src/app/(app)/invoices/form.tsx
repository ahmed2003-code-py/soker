"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Trash2, Save, RotateCcw, UserX, UserPlus, ArrowLeftRight } from "lucide-react";
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
import { إنشاء_فاتورة_مباشرة, تعديل_فاتورة_مباشرة } from "./direct-actions";
import { اجلب_أصناف_المخزن, type شركة_مخزن } from "@/app/(app)/inventory/actions";
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
  // المخزن (مُتجاهَل والمتغير مقفول): الوارد رقم لط، والصادر اختيار لط
  معرف_اللط?: string;
  رقم_اللط?: string;
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
  معرف_اللط: "",
  رقم_اللط: "",
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
  // في وضع المخزن اللون واللط قوائم اختيار (أزرار) — لهم مراجع مستقلة للتنقل
  لون_قائمة: HTMLButtonElement | null;
  لط: HTMLButtonElement | null;
  الكمية: HTMLInputElement | null;
  الوزن: HTMLInputElement | null;
};
const ترتيب_افتراضي: (keyof مراجع_صف)[] = ["اللون", "شركة", "تصنيف", "الكمية", "الوزن"];
/** مع المخزن: الشركة ← التصنيف ← اللون ← اللط ← الكمية ← الوزن */
const ترتيب_المخزن: (keyof مراجع_صف)[] = ["شركة", "تصنيف", "لون_قائمة", "لط", "الكمية", "الوزن"];

// وضع الإدخال: عميل (بيع) / مورد (شراء أو بيع) / مباشرة (مورد ← عميل في إدخال واحد)
type وضع_الطرف = "CUSTOMER" | "SUPPLIER" | "DIRECT";
type نوع_فاتورة = "SALE" | "PURCHASE" | "SUPPLIER_RETURN" | "DIRECT";

export function نموذج_فاتورة({
  العملاء: عملاء0,
  الموردون: موردون0 = [],
  التصنيفات: تصنيفات0,
  الشركات: شركات0,
  حسابات_الخزنة,
  حسابات_فرعية,
  فاتورة,
  مخزن_مفعّل = false,
}: {
  مخزن_مفعّل?: boolean;
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
    مباشرة?: boolean;              // فاتورة مباشرة (مورد ← عميل) — تُحرَّر بجهتيها معاً
    معرف_المورد?: number | null;   // المورد في الفاتورة المباشرة
    أسعار_المورد?: Record<string, string>; // سعر الشراء لكل تصنيف (الفاتورة المباشرة)
    دفعة_المورد?: { المبلغ: number; معرف_الحساب: number; معرف_حساب_فرعي: number | null } | null;
    معرف_العميل: number | null;
    اسم_الزائر?: string | null;
    مرجع_خارجي?: string | null;
    الهاتف: string | null;
    التاريخ: string;
    ملاحظات: string | null;
    غير_مسعّرة?: boolean;
    دفعة?: { المبلغ: number; معرف_الحساب: number; معرف_حساب_فرعي: number | null } | null;
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

  // نوع الطرف: عميل أو مورد أو مباشرة (الاتنين)
  const أنواع_المورد_نموذج = ["PURCHASE", "SUPPLIER_RETURN"];
  const [نوع_الطرف, تعيين_نوع_الطرف] = React.useState<وضع_الطرف>(
    فاتورة?.مباشرة
      ? "DIRECT"
      : فاتورة && أنواع_المورد_نموذج.includes(فاتورة.نوع_الفاتورة)
      ? "SUPPLIER"
      : "CUSTOMER"
  );
  // المورد في الفاتورة المباشرة (العميل يظل في حالة «عميل»)
  const [مورد_مباشر, تعيين_مورد_مباشر] = React.useState<string>(
    فاتورة?.معرف_المورد ? String(فاتورة.معرف_المورد) : ""
  );
  // الفاتورة المباشرة: سعر شراء لكل تصنيف (سعر العميل في أسعار_تصنيفات)
  const [أسعار_المورد, تعيين_أسعار_المورد] = React.useState<Record<string, string>>(
    فاتورة?.أسعار_المورد ?? {}
  );
  // اتجاه فاتورة المورد: جاية (PURCHASE) أو رايحة (SUPPLIER_RETURN)
  const [اتجاه_المورد, تعيين_اتجاه_المورد] = React.useState<"PURCHASE" | "SUPPLIER_RETURN">(
    فاتورة?.نوع_الفاتورة === "SUPPLIER_RETURN" ? "SUPPLIER_RETURN" : "PURCHASE"
  );
  const [مرجع_خارجي, تعيين_مرجع_خارجي] = React.useState(فاتورة?.مرجع_خارجي ?? "");
  const نوع_الفاتورة_الحالي: نوع_فاتورة =
    نوع_الطرف === "DIRECT" ? "DIRECT" : نوع_الطرف === "SUPPLIER" ? اتجاه_المورد : "SALE";
  const مباشرة = نوع_الطرف === "DIRECT";
  // بيع/مرتجع لكل بند متاح لفواتير البيع (عميل بيع + مورد بيع)
  // الشراء والمباشرة لا يقبلان مرتجعاً هنا
  const يسمح_بمرتجع = نوع_الفاتورة_الحالي !== "PURCHASE" && !مباشرة;

  // وضع العميل الزائر (walk-in)
  const [عميل_زائر, تعيين_عميل_زائر] = React.useState(
    فاتورة ? فاتورة.معرف_العميل === null : false
  );
  // وضع العميل المؤقت (حساب له رصيد متابَع) — عند الإنشاء فقط
  const [عميل_مؤقت, تعيين_عميل_مؤقت] = React.useState(false);
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

  // ── المخزن (كل ده مقفول لحد ما يتفعّل من الإعدادات) ──
  const مخزن = مخزن_مفعّل;
  // وجهة بضاعة فاتورة الشراء: للمخزن أو توريد مباشر (الأخير = تحويل لوضع الفاتورة المباشرة)
  const وارد_للمخزن = مخزن && نوع_الفاتورة_الحالي === "PURCHASE";
  // الصادر (بيع للعميل أو مرتجع لمورد) لازم يختار اللط اللي هيخصم منه
  const يختار_لط = مخزن && (نوع_الفاتورة_الحالي === "SALE" || نوع_الفاتورة_الحالي === "SUPPLIER_RETURN");
  // كتالوج المخزن كامل (شركة ← صنف ← لون ← لطات) في طلب واحد وقت الفتح،
  // فاختيار اللط فوري زي باقي الخانات بلا أي انتظار.
  const [كتالوج_المخزن, تعيين_كتالوج_المخزن] = React.useState<شركة_مخزن[]>([]);
  const [كتالوج_جاهز, تعيين_كتالوج_جاهز] = React.useState(false);
  React.useEffect(() => {
    if (!يختار_لط) return;
    اجلب_أصناف_المخزن()
      .then((r) => { تعيين_كتالوج_المخزن(r); تعيين_كتالوج_جاهز(true); })
      .catch(() => تعيين_كتالوج_جاهز(true));
  }, [يختار_لط]);
  const أصناف_الشركة = (شركة: string) =>
    كتالوج_المخزن.find((ش) => ش.الشركة === شركة)?.الأصناف ?? [];
  const ألوان_الصنف = (شركة: string, تصنيف: string) =>
    أصناف_الشركة(شركة).find((ص) => ص.التصنيف === تصنيف)?.الألوان ?? [];

  /** لطات البند من الكتالوج المحمَّل (بلا أي طلب جديد) */
  const لطات_البند = (ب: بند) =>
    ألوان_الصنف(ب.الشركة, ب.التصنيف).find((ل) => ل.اللون === ب.اللون)?.اللطات ?? [];
  const يحمّل_اللطات = () => !كتالوج_جاهز;
  /** متاح اللط المختار في بند (للتحقق قبل الحفظ) */
  const متاح_اللط = (ب: بند) => لطات_البند(ب).find((ل) => String(ل.id) === ب.معرف_اللط) ?? null;

  // ─── فاتورة غير مسعّرة (تلقائي): بيع لعميل مسجّل وفيه صنف بلا سعر ⇒ بلا أثر مالي حتى تكتمل الأسعار ───
  const أسطر_فعلية_للتسعير = بنود.filter((ب) => ب.اللون.trim() || ب.التصنيف.trim());
  const سيُحفظ_غير_مسعّر =
    ((نوع_الطرف === "CUSTOMER" && !عميل_زائر) || مباشرة) &&
    أسطر_فعلية_للتسعير.length > 0 &&
    أسطر_فعلية_للتسعير.some(
      (ب) =>
        String(ب.السعر ?? "").trim() === "" ||
        (مباشرة && String(أسعار_المورد[ب.التصنيف] ?? "").trim() === "")
    );

  // ─── الدفعة الفورية ───────────────────────────────────────
  // عند التعديل: نحمّل الدفعة الموجودة لتظهر وتُحفظ (بدل فقدانها)
  const دفعة_محمّلة = فاتورة?.دفعة ?? null;
  const [دفعة_مفعلة, تعيين_دفعة_مفعلة] = React.useState(عميل_زائر || !!دفعة_محمّلة);
  const [مبلغ_الدفعة, تعيين_مبلغ_الدفعة] = React.useState(
    دفعة_محمّلة ? String(دفعة_محمّلة.المبلغ) : ""
  );
  const [حساب_الدفعة, تعيين_حساب_الدفعة] = React.useState(
    دفعة_محمّلة ? String(دفعة_محمّلة.معرف_الحساب) : (حسابات_الخزنة[0] ? String(حسابات_الخزنة[0].id) : "")
  );
  const [حساب_فرعي_الدفعة, تعيين_حساب_فرعي_الدفعة] = React.useState(
    دفعة_محمّلة?.معرف_حساب_فرعي ? String(دفعة_محمّلة.معرف_حساب_فرعي) : ""
  );

  // ─── دفعة المورد (الوضع المباشر فقط) — مستقلة عن تحصيل العميل ───
  const دفعة_مورد_محمّلة = فاتورة?.دفعة_المورد ?? null;
  const [دفعة_المورد_مفعلة, تعيين_دفعة_المورد_مفعلة] = React.useState(!!دفعة_مورد_محمّلة);
  const [مبلغ_دفعة_المورد, تعيين_مبلغ_دفعة_المورد] = React.useState(
    دفعة_مورد_محمّلة ? String(دفعة_مورد_محمّلة.المبلغ) : ""
  );
  const [حساب_دفعة_المورد, تعيين_حساب_دفعة_المورد] = React.useState(
    دفعة_مورد_محمّلة ? String(دفعة_مورد_محمّلة.معرف_الحساب) : (حسابات_الخزنة[0] ? String(حسابات_الخزنة[0].id) : "")
  );
  const [حساب_فرعي_دفعة_المورد, تعيين_حساب_فرعي_دفعة_المورد] = React.useState(
    دفعة_مورد_محمّلة?.معرف_حساب_فرعي ? String(دفعة_مورد_محمّلة.معرف_حساب_فرعي) : ""
  );
  const نوع_حساب_دفعة_المورد = حسابات_الخزنة.find((h) => String(h.id) === حساب_دفعة_المورد)?.النوع ?? null;
  const له_فرعية_دفعة_المورد = نوع_حساب_دفعة_المورد !== null && نوع_حساب_دفعة_المورد !== "CASH";
  const خيارات_فرعية_دفعة_المورد =
    له_فرعية_دفعة_المورد && نوع_حساب_دفعة_المورد ? (حسابات_فرعية[نوع_حساب_دفعة_المورد] ?? []) : [];

  const نوع_حساب_الدفعة = حسابات_الخزنة.find((h) => String(h.id) === حساب_الدفعة)?.النوع ?? null;
  const له_فرعية_دفعة = نوع_حساب_الدفعة !== null && نوع_حساب_الدفعة !== "CASH";
  const خيارات_فرعية_الدفعة = له_فرعية_دفعة && نوع_حساب_الدفعة ? (حسابات_فرعية[نوع_حساب_الدفعة] ?? []) : [];

  React.useEffect(() => {
    if (له_فرعية_دفعة && خيارات_فرعية_الدفعة.length === 1 && !حساب_فرعي_الدفعة) {
      تعيين_حساب_فرعي_الدفعة(String(خيارات_فرعية_الدفعة[0].id));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [له_فرعية_دفعة, خيارات_فرعية_الدفعة.length]);

  React.useEffect(() => {
    if (له_فرعية_دفعة_المورد && خيارات_فرعية_دفعة_المورد.length === 1 && !حساب_فرعي_دفعة_المورد) {
      تعيين_حساب_فرعي_دفعة_المورد(String(خيارات_فرعية_دفعة_المورد[0].id));
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [له_فرعية_دفعة_المورد, خيارات_فرعية_دفعة_المورد.length]);

  // ─── refs للتنقل ───────────────────────────────────────────
  const مراجع = React.useRef<مراجع_صف[]>([]);
  // مراجع خانات السعر في ملخص التصنيف (لإكمال التنقل بعد الوزن)
  const مراجع_الأسعار = React.useRef<Record<string, HTMLInputElement | null>>({});
  const تركيز_معلّق = React.useRef<{ صف: number; حقل: keyof مراجع_صف } | null>(null);
  const ترتيب = يختار_لط ? ترتيب_المخزن : ترتيب_افتراضي;

  function صف(i: number): مراجع_صف {
    if (!مراجع.current[i]) {
      مراجع.current[i] = { اللون: null, شركة: null, تصنيف: null, لون_قائمة: null, لط: null, الكمية: null, الوزن: null };
    }
    return مراجع.current[i];
  }

  /**
   * يركّز خانة وقت ما تجهز. خانة اللط بتظهر بعد ما لطاتها تتحمّل من الخادم،
   * فبنفضل نحاول لحد ما تجهز بدل ما التنقل يقف.
   */
  function ركّز_عند_الجاهزية(i: number, حقل: keyof مراجع_صف, محاولات = 30) {
    const عنصر = مراجع.current[i]?.[حقل];
    if (عنصر) {
      تركيز_معلّق.current = null;
      عنصر.focus();
      // القوائم تُفتح بعد ما React يخلّص رسم الصف (وإلا الرسم بيقفلها فوراً)
      if (عنصر instanceof HTMLButtonElement) {
        setTimeout(() => {
          if (document.activeElement === عنصر && عنصر.getAttribute("aria-expanded") !== "true") {
            عنصر.click();
          }
        }, 80);
      }
      return;
    }
    تركيز_معلّق.current = { صف: i, حقل };
    if (محاولات > 0) setTimeout(() => ركّز_عند_الجاهزية(i, حقل, محاولات - 1), 150);
  }

  /** يفتح صفاً جديداً (لو آخر صف مليان) ويركّز على أول خانة فيه */
  function صف_جديد_وركّز() {
    const الأول = (يختار_لط ? "شركة" : "اللون") as keyof مراجع_صف;
    const آخر = بنود.length - 1;
    const فاضي = !بنود[آخر]?.اللون.trim() && !بنود[آخر]?.التصنيف.trim();
    if (فاضي) return ركّز_عند_الجاهزية(آخر, الأول);
    تعيين_بنود((س) => [...س, بند_فارغ()]);
    requestAnimationFrame(() => ركّز_عند_الجاهزية(آخر + 1, الأول));
  }

  function انتقل(i: number, حقل: keyof مراجع_صف) {
    const idx = ترتيب.indexOf(حقل);
    const refs = مراجع.current[i];
    if (!refs) return;
    if (idx < ترتيب.length - 1) {
      ركّز_عند_الجاهزية(i, ترتيب[idx + 1]);
    } else {
      // آخر خانة (الوزن) ⇒ صف جديد — نفس سلوك النظام الحالي بالظبط
      صف_جديد_وركّز();
    }
  }

  // التنقل بالأسهم: أعلى/أسفل بين الصفوف، يمين/يسار بين الأعمدة
  function على_سهم(
    e: React.KeyboardEvent<HTMLElement>,
    i: number,
    حقل: keyof مراجع_صف,
    اتجاه_النص: "rtl" | "ltr" = "rtl"
  ) {
    const idx = ترتيب.indexOf(حقل);
    const el = e.currentTarget;

    if (e.key === "ArrowDown") {
      e.preventDefault();
      if (i < بنود.length - 1) {
        (مراجع.current[i + 1]?.[حقل] as HTMLElement | null)?.focus();
      } else {
        تعيين_بنود((س) => [...س, بند_فارغ()]);
        requestAnimationFrame(() =>
          (مراجع.current[i + 1]?.[حقل] as HTMLElement | null)?.focus()
        );
      }
      return;
    }

    if (e.key === "ArrowUp" && i > 0) {
      e.preventDefault();
      (مراجع.current[i - 1]?.[حقل] as HTMLElement | null)?.focus();
      return;
    }

    // ArrowLeft في جدول RTL = انتقل للعمود التالي (يسار البصري = idx أكبر)
    if (e.key === "ArrowLeft" && idx < ترتيب.length - 1) {
      let عند_الحافة = true;
      if (el instanceof HTMLInputElement) {
        عند_الحافة = اتجاه_النص === "ltr"
          ? el.selectionStart === 0
          : el.selectionStart === el.value.length;
      }
      if (عند_الحافة) {
        e.preventDefault();
        (مراجع.current[i]?.[ترتيب[idx + 1]] as HTMLElement | null)?.focus();
      }
      return;
    }

    // ArrowRight في جدول RTL = انتقل للعمود السابق (يمين البصري = idx أصغر)
    if (e.key === "ArrowRight" && idx > 0) {
      let عند_الحافة = true;
      if (el instanceof HTMLInputElement) {
        عند_الحافة = اتجاه_النص === "ltr"
          ? el.selectionStart === el.value.length
          : el.selectionStart === 0;
      }
      if (عند_الحافة) {
        e.preventDefault();
        (مراجع.current[i]?.[ترتيب[idx - 1]] as HTMLElement | null)?.focus();
      }
      return;
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
    // التسلسل: الشركة ← الصنف ← اللون ← اللط. تغيير أي مستوى بيصفّر اللي تحته.
    if (مفتاح === "الشركة" && يختار_لط) {
      تعيين_بنود((س) =>
        س.map((ب, j) => (j === i ? { ...ب, الشركة: قيمة, التصنيف: "", اللون: "", معرف_اللط: "" } : ب))
      );
      return;
    }
    if (مفتاح === "اللون") {
      تعيين_بنود((س) => س.map((ب, j) => (j === i ? { ...ب, اللون: قيمة, معرف_اللط: "" } : ب)));
      return;
    }
    if (مفتاح === "التصنيف") {
      تعيين_بنود((س) =>
        س.map((ب, j) =>
          j === i ? { ...ب, التصنيف: قيمة, السعر: أسعار_تصنيفات[قيمة] ?? "", معرف_اللط: "" } : ب
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

  function حدّث_سعر_المورد(تصنيف: string, سعر: string) {
    تعيين_أسعار_المورد((prev) => ({ ...prev, [تصنيف]: سعر }));
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
  // الفاتورة المباشرة: إجمالي جهة المورد (بسعر الشراء) والربح = بيع − شراء
  const إجمالي_المورد_النموذج = بنود.reduce(
    (س, ب) => س + ع(أسعار_المورد[ب.التصنيف] ?? "") * ع(ب.الوزن),
    0
  );
  const ربح_المباشرة = الإجمالي_المالي - إجمالي_المورد_النموذج;
  const لها_مرتجعات = يسمح_بمرتجع && إجمالي_المرتجعات_النموذج > 0;

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

  /** بنود الإرسال — مشتركة بين الفاتورة العادية والمباشرة */
  function بنود_للإرسال() {
    return بنود.map((ب) => ({
      نوع_البند: ب.نوع_البند,
      اللون: ب.اللون,
      الشركة: ب.الشركة || null,
      الكمية: ب.الكمية,
      الوزن: ب.الوزن,
      التصنيف: ب.التصنيف,
      السعر: ب.السعر,
      ملاحظات: ب.ملاحظات,
      // المخزن (تُتجاهَل تماماً على الخادم لو المتغير مقفول)
      ...(مخزن
        ? {
            معرف_اللط: ب.معرف_اللط ? Number(ب.معرف_اللط) : null,
            رقم_اللط: ب.رقم_اللط?.trim() || null,
          }
        : {}),
    }));
  }

  /**
   * حفظ الفاتورة المباشرة (مورد ← عميل): إدخال واحد ⇒ فاتورتان مربوطتان
   * (شراء على المورد + بيع على العميل) بنفس البنود ونفس السعر.
   */
  async function احفظ_مباشرة() {
    if (!مورد_مباشر) return إشعار.خطأ("اختر المورد");
    if (!عميل) return إشعار.خطأ(t("inv.f.pick_customer_err"));
    if (مورد_مباشر === عميل) return إشعار.خطأ("المورد والعميل لا يمكن أن يكونا نفس الطرف");
    if (دفعة_مفعلة && له_فرعية_دفعة && !حساب_فرعي_الدفعة) {
      const تسمية = نوع_حساب_الدفعة === "BANK" ? "البنك" : نوع_حساب_الدفعة === "VODAFONE" ? "المحفظة" : "حساب إنستا";
      return إشعار.خطأ(`يرجى اختيار ${تسمية} لتحصيل العميل`);
    }
    if (دفعة_المورد_مفعلة && له_فرعية_دفعة_المورد && !حساب_فرعي_دفعة_المورد) {
      const تسمية = نوع_حساب_دفعة_المورد === "BANK" ? "البنك" : نوع_حساب_دفعة_المورد === "VODAFONE" ? "المحفظة" : "حساب إنستا";
      return إشعار.خطأ(`يرجى اختيار ${تسمية} لدفعة المورد`);
    }
    تعيين_جارٍ(true);
    const رقم_مُحدد = رقم_الفاتورة.trim() ? Number(رقم_الفاتورة.replace(/,/g, "")) : null;
    const payload = {
      معرف_المورد: Number(مورد_مباشر),
      معرف_العميل: Number(عميل),
      مرجع_خارجي: مرجع_خارجي.trim() || null,
      رقم_الفاتورة_المحدد: رقم_مُحدد && رقم_مُحدد > 0 ? رقم_مُحدد : null,
      الهاتف: هاتف,
      التاريخ: تاريخ,
      ملاحظات,
      البنود: بنود_للإرسال().map((ب) => ({ ...ب, سعر_المورد: أسعار_المورد[ب.التصنيف] ?? "" })),
      ...(!سيُحفظ_غير_مسعّر && دفعة_مفعلة && مبلغ_الدفعة && حساب_الدفعة ? {
        دفعة_العميل: {
          المبلغ: مبلغ_الدفعة,
          معرف_الحساب: Number(حساب_الدفعة),
          معرف_حساب_فرعي: حساب_فرعي_الدفعة ? Number(حساب_فرعي_الدفعة) : null,
        },
      } : {}),
      ...(!سيُحفظ_غير_مسعّر && دفعة_المورد_مفعلة && مبلغ_دفعة_المورد && حساب_دفعة_المورد ? {
        دفعة_المورد: {
          المبلغ: مبلغ_دفعة_المورد,
          معرف_الحساب: Number(حساب_دفعة_المورد),
          معرف_حساب_فرعي: حساب_فرعي_دفعة_المورد ? Number(حساب_فرعي_دفعة_المورد) : null,
        },
      } : {}),
    };
    const r = فاتورة
      ? await تعديل_فاتورة_مباشرة(فاتورة.id, payload)
      : await إنشاء_فاتورة_مباشرة(payload);
    تعيين_جارٍ(false);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    if (!فاتورة) localStorage.removeItem(مفتاح_المسودة);
    إشعار.نجاح(r.رسالة!);
    const id = فاتورة ? فاتورة.id : (r.بيانات as { id: number }).id;
    router.push(`/invoices/${id}`);
    router.refresh();
  }

  async function أضف_مورد_مباشر(الاسم: string) {
    const r = await إنشاء_طرف({ الاسم, النوع: "SUPPLIER" });
    if (!r.نجاح || !r.بيانات) return إشعار.خطأ(r.رسالة || "خطأ في إضافة المورد");
    const جديد = { id: r.بيانات.id, name: الاسم, phone: null, balance: 0 };
    تعيين_موردون((س) => [...س, جديد]);
    تعيين_مورد_مباشر(String(جديد.id));
    إشعار.نجاح("تم إضافة المورد");
  }

  /** اختيار العميل: يملأ الهاتف ويجلب آخر أسعاره للتصنيفات الموجودة */
  async function اختر_العميل(v: string) {
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
  }

  async function احفظ() {
    if (مباشرة) return احفظ_مباشرة();
    // ── تحقق المخزن قبل الإرسال (الخادم بيتحقق كمان) ──
    if (يختار_لط) {
      const أسطر = بنود.filter((ب) => ب.اللون.trim() || ب.التصنيف.trim());
      const بلا_لط = أسطر.findIndex((ب) => !ب.معرف_اللط);
      if (بلا_لط >= 0) return إشعار.خطأ(`اختر اللط للبند رقم ${بلا_لط + 1}`);
      const زايد = أسطر.findIndex((ب) => {
        const م = متاح_اللط(ب);
        return !!م && ب.نوع_البند !== "RETURN" && ع(ب.الكمية) > م.الكمية;
      });
      if (زايد >= 0) return إشعار.خطأ(`الكمية أكبر من المتاح في اللط المختار — البند رقم ${زايد + 1}`);
      const زايد_وزن = أسطر.findIndex((ب) => {
        const م = متاح_اللط(ب);
        return !!م && ب.نوع_البند !== "RETURN" && ع(ب.الوزن) > م.الوزن * 1.02;
      });
      if (زايد_وزن >= 0) {
        const م = متاح_اللط(أسطر[زايد_وزن])!;
        return إشعار.خطأ(
          `الوزن أكبر من المتاح في اللط المختار (${م.الوزن.toFixed(2)} كجم) — البند رقم ${زايد_وزن + 1}`
        );
      }
    }
    if (نوع_الطرف === "SUPPLIER" && !عميل) return إشعار.خطأ("اختر المورد");
    if (نوع_الطرف === "CUSTOMER" && !عميل_زائر && !عميل_مؤقت && !عميل) return إشعار.خطأ(t("inv.f.pick_customer_err"));
    if (عميل_زائر && !دفعة_مفعلة) return إشعار.خطأ("العميل الزائر يتطلب تحصيل فوري — فعّل الدفعة");
    if (دفعة_مفعلة && له_فرعية_دفعة && !حساب_فرعي_الدفعة) {
      const تسمية = نوع_حساب_الدفعة === "BANK" ? "البنك" : نوع_حساب_الدفعة === "VODAFONE" ? "المحفظة" : "حساب إنستا";
      return إشعار.خطأ(`يرجى اختيار ${تسمية} للدفعة`);
    }
    تعيين_جارٍ(true);
    const رقم_مُحدد = رقم_الفاتورة.trim() ? Number(رقم_الفاتورة.replace(/,/g, "")) : null;
    const payload = {
      نوع_الفاتورة: نوع_الفاتورة_الحالي,
      ...(نوع_الفاتورة_الحالي === "PURCHASE" ? { وجهة_البضاعة: "WAREHOUSE" as const } : {}),
      مرجع_خارجي: نوع_الفاتورة_الحالي === "PURCHASE" ? (مرجع_خارجي.trim() || null) : null,
      رقم_الفاتورة_المحدد: رقم_مُحدد && رقم_مُحدد > 0 ? رقم_مُحدد : null,
      معرف_العميل: (عميل_زائر || عميل_مؤقت) ? null : (عميل ? Number(عميل) : null),
      اسم_الزائر: (عميل_زائر || عميل_مؤقت) ? (اسم_الزائر.trim() || null) : null,
      عميل_مؤقت: عميل_مؤقت || undefined,
      الهاتف: هاتف,
      التاريخ: تاريخ,
      ملاحظات,
      البنود: بنود_للإرسال(),
      ...(!سيُحفظ_غير_مسعّر && دفعة_مفعلة && مبلغ_الدفعة && حساب_الدفعة ? {
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
            {مباشرة
              ? "فاتورة مباشرة (مورد ← عميل)"
              : نوع_الفاتورة_الحالي === "PURCHASE"
              ? "مورد (شراء)"
              : نوع_الفاتورة_الحالي === "SUPPLIER_RETURN"
              ? "مورد (بيع)"
              : "عميل (بيع)"}
          </span>
        )}

        {/* مفتاح نوع الفاتورة — ثلاثة أوضاع */}
        {!فاتورة && (
          <div className="flex gap-1 rounded-xl border border-border bg-muted/40 p-1 w-fit">
            {([
              { وضع: "CUSTOMER" as const, اتجاه: "SALE" as const,            تسمية: "عميل (بيع)" },
              { وضع: "SUPPLIER" as const, اتجاه: "SUPPLIER_RETURN" as const, تسمية: "مورد (بيع)" },
              { وضع: "SUPPLIER" as const, اتجاه: "PURCHASE" as const,        تسمية: "مورد (شراء)" },
              { وضع: "DIRECT" as const,   اتجاه: "DIRECT" as const,          تسمية: "مباشرة (مورد ← عميل)" },
            ]).map(({ وضع, اتجاه, تسمية }) => {
              const محدد =
                وضع === "CUSTOMER"
                  ? نوع_الطرف === "CUSTOMER"
                  : وضع === "DIRECT"
                  ? نوع_الطرف === "DIRECT"
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
                    if (وضع !== "CUSTOMER") { تعيين_عميل_زائر(false); تعيين_عميل_مؤقت(false); }
                    if (وضع !== "DIRECT") { تعيين_مورد_مباشر(""); تعيين_دفعة_المورد_مفعلة(false); }
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

        {/* شرح الوضع المباشر */}
        {مباشرة && (
          <div className="flex items-start gap-2 rounded-xl border border-primary-blue/30 bg-primary-blue/5 px-4 py-2.5 text-[13px] leading-6 text-primary-blue">
            <ArrowLeftRight className="mt-1 size-4 shrink-0" />
            <span>
              البضاعة رايحة من المورد للعميل على طول: الحفظ بيعمل{" "}
              <span className="font-semibold">فاتورتين مربوطتين</span> — فاتورة شراء على حساب المورد
              (بسعر الشراء) وفاتورة بيع على حساب العميل (بسعر البيع)، والفرق بينهم ربح المعاملة.
              التعديل أو الحذف بيمسّ الجهتين معاً.
            </span>
          </div>
        )}

        {/* وجهة البضاعة — لفواتير الشراء لما المخزن يبقى مفعّل */}
        {وارد_للمخزن && !فاتورة && (
          <div className="flex flex-wrap items-center gap-2 rounded-xl border border-border bg-appgray p-3">
            <span className="text-sm text-muted-foreground">وجهة البضاعة</span>
            <div className="flex overflow-hidden rounded-lg border border-border text-sm">
              <button type="button" className="bg-primary px-4 py-1.5 text-white">إضافة للمخزن</button>
              <button
                type="button"
                className="bg-white px-4 py-1.5 transition-colors hover:bg-muted dark:bg-background"
                onClick={() => {
                  // التوريد المباشر = الفاتورة المباشرة (مورد ← عميل) بلا أثر مخزني
                  تعيين_نوع_الطرف("DIRECT");
                  تعيين_عميل("");
                  تعيين_هاتف("");
                }}
              >
                توريد مباشر للعميل
              </button>
            </div>
            <span className="text-[12px] text-muted-foreground">
              البضاعة هتتسجّل في المخزن بلطاتها، والصرف منها بيبقى من فاتورة البيع.
            </span>
          </div>
        )}

        {/* أوضاع العميل غير المسجّل — للعملاء فقط عند الإنشاء */}
        {نوع_الطرف === "CUSTOMER" && !فاتورة && (
          <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:gap-5">
            <label className="flex cursor-pointer items-center gap-2 w-fit select-none text-sm">
              <input
                type="checkbox"
                checked={عميل_زائر}
                onChange={(e) => {
                  const ف = e.target.checked;
                  تعيين_عميل_زائر(ف);
                  if (ف) {
                    تعيين_عميل_مؤقت(false);
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
            <label className="flex cursor-pointer items-center gap-2 w-fit select-none text-sm">
              <input
                type="checkbox"
                checked={عميل_مؤقت}
                onChange={(e) => {
                  const ف = e.target.checked;
                  تعيين_عميل_مؤقت(ف);
                  if (ف) {
                    تعيين_عميل_زائر(false);
                    تعيين_عميل("");
                    تعيين_هاتف("");
                  }
                }}
                className="size-4 rounded accent-primary"
              />
              <UserPlus className="size-4 text-muted-foreground" />
              <span className="text-muted-foreground">عميل مؤقت (بحساب — يُتابَع رصيده حتى السداد)</span>
            </label>
          </div>
        )}

        <div className="grid gap-4 sm:grid-cols-4">
          {مباشرة ? (
            <>
              {/* رقم فاتورة المورد */}
              <div className="space-y-1.5">
                <العنوان>رقم فاتورة المورد</العنوان>
                <الحقل
                  className="ltr-nums"
                  value={مرجع_خارجي}
                  onChange={(e) => تعيين_مرجع_خارجي(e.target.value)}
                  placeholder="رقم الفاتورة الصادرة من المورد"
                />
              </div>
              {/* رقم فاتورة العميل (تسلسلي) */}
              <div className="space-y-1.5">
                <العنوان>{t("inv.col.number")}</العنوان>
                <الحقل
                  className="ltr-nums"
                  value={رقم_الفاتورة}
                  onChange={(e) => تعيين_رقم_الفاتورة(e.target.value)}
                  placeholder="..."
                />
              </div>
              {/* المورد (البضاعة منه) */}
              <div className="space-y-1.5">
                <العنوان مطلوب>المورد (البضاعة منه)</العنوان>
                <قائمة_اختيار
                  الخيارات={موردون.map((s) => ({ القيمة: String(s.id), التسمية: s.name }))}
                  القيمة={مورد_مباشر}
                  عند_التغيير={تعيين_مورد_مباشر}
                  عند_الإضافة={أضف_مورد_مباشر}
                  تسمية_الإضافة="إضافة مورد"
                  نص_بديل="اختر المورد"
                />
              </div>
              {/* العميل (البضاعة إليه) */}
              <div className="space-y-1.5">
                <العنوان مطلوب>{t("inv.col.customer")} (البضاعة إليه)</العنوان>
                <قائمة_اختيار
                  الخيارات={عملاء.map((c) => ({ القيمة: String(c.id), التسمية: c.name }))}
                  القيمة={عميل}
                  عند_التغيير={اختر_العميل}
                  عند_الإضافة={أضف_عميل}
                  تسمية_الإضافة={t("party.add_customer")}
                  نص_بديل={t("inv.f.pick_customer")}
                />
              </div>
            </>
          ) : (
          <>
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
            <العنوان مطلوب={!عميل_زائر && !عميل_مؤقت}>{نوع_الطرف === "CUSTOMER" ? t("inv.col.customer") : "المورد"}</العنوان>
            {عميل_زائر || عميل_مؤقت ? (
              <الحقل
                autoFocus
                value={اسم_الزائر}
                onChange={(e) => تعيين_اسم_الزائر(e.target.value)}
                placeholder={عميل_مؤقت ? "اسم العميل المؤقت (اختياري — يُولّد تلقائياً)" : "اسم العميل للطباعة (اختياري)"}
              />
            ) : نوع_الطرف === "CUSTOMER" ? (
              <قائمة_اختيار
                الخيارات={عملاء.map((c) => ({ القيمة: String(c.id), التسمية: c.name }))}
                القيمة={عميل}
                عند_التغيير={اختر_العميل}
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
          </>
          )}

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
                {يسمح_بمرتجع && <th className="p-2 w-20"></th>}
                {يختار_لط ? (
                  // ترتيب الإدخال مع المخزن: الشركة ← التصنيف ← اللون
                  <>
                    <th className="p-2 text-start">الشركة</th>
                    <th className="p-2 text-start">{t("inv.f.category")}</th>
                    <th className="p-2 text-start">{t("inv.f.color")}</th>
                  </>
                ) : (
                  <>
                    <th className="p-2 text-start">{t("inv.f.color")}</th>
                    <th className="p-2 text-start">الشركة</th>
                    <th className="p-2 text-start">{t("inv.f.category")}</th>
                  </>
                )}
                {(وارد_للمخزن || يختار_لط) && (
                  <th className="p-2 text-start whitespace-nowrap">
                    اللط {يختار_لط && <span className="text-danger">*</span>}
                  </th>
                )}
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
                  {/* زر نوع البند (بيع/مرتجع) — لفواتير البيع (عميل بيع + مورد بيع) */}
                  {يسمح_بمرتجع && (
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
                  {/* الشركة والتصنيف واللون — الترتيب حسب الوضع */}
                  {(() => {
                    const خلية_الشركة = (
                      <td key="co" className="p-1.5 min-w-36">
                        {يختار_لط ? (
                          <قائمة_اختيار
                            triggerRef={(el) => { صف(i).شركة = el; }}
                            الخيارات={كتالوج_المخزن.map((ش) => ({
                              القيمة: ش.الشركة,
                              التسمية: `${ش.الشركة} — متاح ${ش.الكمية}`,
                            }))}
                            القيمة={ب.الشركة || null}
                            عند_التغيير={(v) => حدّث(i, "الشركة", v)}
                            عند_الاختيار={() => انتقل(i, "شركة")}
                            onKeyDown={(e) => على_سهم(e, i, "شركة")}
                            نص_بديل="اختر الشركة…"
                          />
                        ) : (
                          <قائمة_اختيار
                            triggerRef={(el) => { صف(i).شركة = el; }}
                            الخيارات={شركات.map((x) => ({ القيمة: x, التسمية: x }))}
                            القيمة={ب.الشركة || null}
                            عند_التغيير={(v) => حدّث(i, "الشركة", v)}
                            عند_الإضافة={async (جديد) => {
                              if (!شركات.includes(جديد)) تعيين_شركات((x) => [...x, جديد]);
                              حدّث(i, "الشركة", جديد);
                              await أضف_للقائمة_DB("شركة", جديد);
                            }}
                            عند_الاختيار={() => انتقل(i, "شركة")}
                            عند_التعديل={عدّل_شركة}
                            عند_الحذف={احذف_شركة}
                            تسمية_الإضافة="إضافة شركة"
                            نص_بديل="الشركة"
                            onKeyDown={(e) => على_سهم(e, i, "شركة")}
                          />
                        )}
                      </td>
                    );

                    const خلية_التصنيف = (
                      <td key="cat" className="p-1.5 min-w-36">
                        <قائمة_اختيار
                          triggerRef={(el) => { صف(i).تصنيف = el; }}
                          الخيارات={
                            يختار_لط
                              ? أصناف_الشركة(ب.الشركة).map((ص) => ({
                                  القيمة: ص.التصنيف,
                                  التسمية: `${ص.التصنيف} — متاح ${ص.الكمية}`,
                                }))
                              : تصنيفات.map((c) => ({ القيمة: c, التسمية: c }))
                          }
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
                          {...(يختار_لط
                            ? {}
                            : {
                                عند_الإضافة: async (جديد: string) => {
                                  if (!تصنيفات.includes(جديد)) تعيين_تصنيفات((s) => [...s, جديد]);
                                  حدّث(i, "التصنيف", جديد);
                                  await أضف_للقائمة_DB("تصنيف", جديد);
                                },
                                عند_التعديل: عدّل_تصنيف,
                                عند_الحذف: احذف_تصنيف,
                                تسمية_الإضافة: t("inv.f.new_category"),
                              })}
                          عند_الاختيار={() => انتقل(i, "تصنيف")}
                          نص_بديل={يختار_لط && !ب.الشركة ? "اختر الشركة أولاً" : t("inv.f.category")}
                          onKeyDown={(e) => على_سهم(e, i, "تصنيف")}
                        />
                      </td>
                    );

                    const خلية_اللون = (
                      <td key="col" className="p-1.5 min-w-28">
                        {يختار_لط ? (
                          <قائمة_اختيار
                            triggerRef={(el) => { صف(i).لون_قائمة = el; }}
                            الخيارات={ألوان_الصنف(ب.الشركة, ب.التصنيف).map((ل) => ({
                              القيمة: ل.اللون,
                              التسمية: `${ل.اللون} — متاح ${ل.الكمية}`,
                            }))}
                            القيمة={ب.اللون}
                            عند_التغيير={(v) => {
                              // اللط الأقدم (FIFO) بيتحدد فوراً من الكتالوج — بلا انتظار
                              const لطات = ألوان_الصنف(ب.الشركة, ب.التصنيف).find((ل) => ل.اللون === v)?.اللطات ?? [];
                              تعيين_بنود((س) =>
                                س.map((x, j) =>
                                  j === i ? { ...x, اللون: v, معرف_اللط: لطات[0] ? String(لطات[0].id) : "" } : x
                                )
                              );
                            }}
                            عند_الاختيار={() => انتقل(i, "لون_قائمة")}
                            onKeyDown={(e) => على_سهم(e, i, "لون_قائمة")}
                            نص_بديل={ب.التصنيف ? "اختر اللون…" : "اختر الصنف أولاً"}
                          />
                        ) : (
                          <الحقل
                            ref={(el) => { صف(i).اللون = el; }}
                            value={ب.اللون}
                            onChange={(e) => حدّث(i, "اللون", e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); انتقل(i, "اللون"); return; }
                              على_سهم(e, i, "اللون", "rtl");
                            }}
                            placeholder={t("inv.f.color")}
                          />
                        )}
                      </td>
                    );

                    return يختار_لط
                      ? [خلية_الشركة, خلية_التصنيف, خلية_اللون]
                      : [خلية_اللون, خلية_الشركة, خلية_التصنيف];
                  })()}
                  {/* اللط (المخزن) */}
                  {وارد_للمخزن && (
                    <td className="p-1.5 min-w-32">
                      <الحقل
                        className="ltr-nums"
                        value={ب.رقم_اللط ?? ""}
                        onChange={(e) => حدّث(i, "رقم_اللط", e.target.value)}
                        placeholder="تلقائي"
                        title="رقم اللط — يُولَّد تلقائياً لو سِبته فاضي"
                      />
                    </td>
                  )}
                  {يختار_لط && (
                    <td className="p-1.5 min-w-44">
                      {(() => {
                        const قائمة = لطات_البند(ب);
                        const مختار = متاح_اللط(ب);
                        const مطلوب = ع(ب.الكمية);
                        const زايد = !!مختار && مطلوب > مختار.الكمية;
                        if (!ب.التصنيف.trim() || !ب.اللون.trim()) {
                          return <span className="text-[11px] text-muted-foreground">اختر الصنف واللون أولاً</span>;
                        }
                        if (يحمّل_اللطات()) {
                          return (
                            <span className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                              <span className="size-3 animate-spin rounded-full border-2 border-border border-t-primary" />
                              جارٍ تحميل اللطات…
                            </span>
                          );
                        }
                        if (قائمة.length === 0) {
                          return <span className="text-[11px] text-danger">مفيش رصيد بالمخزن</span>;
                        }
                        return (
                          <div className="space-y-1">
                            <قائمة_اختيار
                              triggerRef={(el) => { صف(i).لط = el; }}
                              الخيارات={قائمة.map((ل, ترتيب_ل) => ({
                                القيمة: String(ل.id),
                                التسمية: `${ل.رقم_اللط} — متاح ${ل.الكمية} / ${ل.الوزن.toFixed(2)} كجم${ترتيب_ل === 0 ? " (الأقدم)" : ""}`,
                              }))}
                              القيمة={ب.معرف_اللط ?? ""}
                              عند_التغيير={(v) => حدّث(i, "معرف_اللط", v)}
                              عند_الاختيار={() => انتقل(i, "لط")}
                              onKeyDown={(e) => على_سهم(e, i, "لط")}
                              نص_بديل="اختر اللط…"
                            />
                            {مختار && (
                              <p className={`text-[11px] ${زايد ? "text-danger font-medium" : "text-muted-foreground"}`}>
                                {زايد
                                  ? `الرصيد غير كافٍ — المتاح ${مختار.الكمية}`
                                  : `المتاح ${مختار.الكمية} شكارة / ${مختار.الوزن.toFixed(2)} كجم`}
                              </p>
                            )}
                          </div>
                        );
                      })()}
                    </td>
                  )}
                  {/* الكمية */}
                  <td className="p-1.5">
                    {(() => {
                      // تنبيه فوري: الكمية المكتوبة أكبر من المتاح في اللط المختار
                      const م = يختار_لط && ب.نوع_البند !== "RETURN" ? متاح_اللط(ب) : null;
                      const زايد = !!م && ع(ب.الكمية) > م.الكمية;
                      return (
                        <>
                          <الحقل
                            ref={(el) => { صف(i).الكمية = el; }}
                            className={`ltr-nums text-end ${زايد ? "border-danger text-danger focus-visible:ring-danger" : ""}`}
                            selectOnFocus
                            value={ب.الكمية}
                            onChange={(e) => حدّث(i, "الكمية", e.target.value)}
                            onKeyDown={(e) => {
                              if (e.key === "Enter") { e.preventDefault(); انتقل(i, "الكمية"); return; }
                              على_سهم(e, i, "الكمية", "ltr");
                            }}
                            placeholder="0"
                          />
                          {زايد && (
                            <p className="mt-0.5 text-[11px] font-medium text-danger">
                              متاح {م!.الكمية} بس
                            </p>
                          )}
                        </>
                      );
                    })()}
                  </td>
                  {/* الوزن */}
                  <td className="p-1.5">
                    {(() => {
                      // تحذير فوري: الوزن أكبر من المتاح في اللط (الوزن تتبعي — نسمح بفرق ≤ 2% للوزن الفعلي)
                      const مو = يختار_لط && ب.نوع_البند !== "RETURN" ? متاح_اللط(ب) : null;
                      const زائد_وزن = !!مو && ع(ب.الوزن) > مو.الوزن;
                      const مرفوض_وزن = !!مو && ع(ب.الوزن) > مو.الوزن * 1.02;
                      return (
                        <>
                    <الحقل
                      ref={(el) => { صف(i).الوزن = el; }}
                      className={`ltr-nums text-end ${زائد_وزن ? (مرفوض_وزن ? "border-danger text-danger focus-visible:ring-danger" : "border-warning text-warning") : ""}`}
                      selectOnFocus
                      value={ب.الوزن}
                      onChange={(e) => حدّث(i, "الوزن", e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") { e.preventDefault(); انتقل(i, "الوزن"); return; }
                        على_سهم(e, i, "الوزن", "ltr");
                      }}
                      placeholder="0.00"
                    />
                          {زائد_وزن && (
                            <p className={`mt-0.5 text-[11px] font-medium ${مرفوض_وزن ? "text-danger" : "text-warning"}`}>
                              متاح {مو!.الوزن.toFixed(2)} كجم بس
                            </p>
                          )}
                        </>
                      );
                    })()}
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
      <div className={`grid gap-4 ${مباشرة ? "" : "lg:grid-cols-2"}`}>
        <div className="card-soft p-5">
          <h3 className="mb-3 font-semibold">{t("inv.f.summary_by_cat")}</h3>
          {تجميع.length === 0 ? (
            <p className="text-sm text-muted-foreground">{t("inv.f.enter_items")}</p>
          ) : (
            <div className={مباشرة ? "overflow-x-auto" : ""}>
            <table className="w-full text-sm">
              <thead className="text-muted-foreground">
                {/* الوضع المباشر: رأس مجموعة لكل جهة عشان يبان السعر بتاع مين */}
                {مباشرة && (
                  <tr className="border-b border-border text-[12px] font-semibold">
                    <th colSpan={3} />
                    <th colSpan={2} className="border-s border-border bg-amber-50/70 p-1.5 text-center text-amber-800 dark:bg-amber-900/15 dark:text-amber-300">
                      المورد (شراء)
                    </th>
                    <th colSpan={2} className="border-s border-border bg-green-50/70 p-1.5 text-center text-green-800 dark:bg-green-900/15 dark:text-green-300">
                      العميل (بيع)
                    </th>
                  </tr>
                )}
                <tr className="border-b border-border">
                  <th className="p-2 text-start">{t("inv.f.category")}</th>
                  <th className="p-2 text-end">{t("inv.f.total_count")}</th>
                  <th className="p-2 text-end">{t("inv.col.total_weight")}</th>
                  {مباشرة && <th className="border-s border-border p-2 text-end whitespace-nowrap">السعر/كجم</th>}
                  {مباشرة && <th className="p-2 text-end whitespace-nowrap">الإجمالي</th>}
                  <th className={`p-2 text-end whitespace-nowrap ${مباشرة ? "border-s border-border" : ""}`}>
                    {مباشرة ? "السعر/كجم" : t("inv.f.price_kg")}
                  </th>
                  <th className="p-2 text-end whitespace-nowrap">{مباشرة ? "الإجمالي" : t("inv.f.subtotal")}</th>
                </tr>
              </thead>
              <tbody>
                {تجميع.map(([ت, ح]) => {
                  const سعر_التصنيف = أسعار_تصنيفات[ت] ?? "";
                  const مبلغ_التصنيف = ع(سعر_التصنيف) * ح.وزن;
                  const سعر_المورد_ت = أسعار_المورد[ت] ?? "";
                  const مبلغ_المورد_ت = ع(سعر_المورد_ت) * ح.وزن;
                  return (
                    <tr key={ت} className="border-b border-border/60">
                      <td className="p-2 font-medium">{ت}</td>
                      <td className="p-2 text-end ltr-nums">{ح.كمية}</td>
                      <td className="p-2 text-end ltr-nums whitespace-nowrap">{ح.وزن.toFixed(2)} {t("inv.kg")}</td>
                      {مباشرة && (
                        <td className="border-s border-border bg-amber-50/40 p-1.5 text-end dark:bg-amber-900/10">
                          <الحقل className="ltr-nums text-end w-24 inline-block" selectOnFocus
                            value={سعر_المورد_ت}
                            onChange={(e) => حدّث_سعر_المورد(ت, e.target.value)}
                            onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); صف_جديد_وركّز(); } }}
                            placeholder="0.00" />
                        </td>
                      )}
                      {مباشرة && (
                        <td className="bg-amber-50/40 p-2 text-end ltr-nums font-medium whitespace-nowrap dark:bg-amber-900/10">
                          {مبلغ_المورد_ت !== 0
                            ? Math.abs(مبلغ_المورد_ت).toLocaleString("en-US", { minimumFractionDigits: 2 })
                            : "—"}
                        </td>
                      )}
                      <td className={`p-1.5 text-end ${مباشرة ? "border-s border-border bg-green-50/40 dark:bg-green-900/10" : ""}`}>
                        <الحقل className="ltr-nums text-end w-24 inline-block" selectOnFocus
                          ref={(el) => { مراجع_الأسعار.current[ت] = el; }}
                          value={سعر_التصنيف}
                          onChange={(e) => حدّث_سعر_تصنيف(ت, e.target.value)}
                          onKeyDown={(e) => { if (e.key === "Enter") { e.preventDefault(); صف_جديد_وركّز(); } }}
                          placeholder="0.00" />
                      </td>
                      <td className={`p-2 text-end ltr-nums font-medium whitespace-nowrap ${مباشرة ? "bg-green-50/40 dark:bg-green-900/10" : ""}`}>
                        {مبلغ_التصنيف !== 0
                          ? Math.abs(مبلغ_التصنيف).toLocaleString("en-US", { minimumFractionDigits: 2 })
                          : "—"}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
            </div>
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
          ) : مباشرة ? (
            <>
              <div className="flex justify-between border-t border-border pt-2">
                <span className="text-muted-foreground">إجمالي المورد (شراء)</span>
                <نص_مبلغ القيمة={إجمالي_المورد_النموذج} />
              </div>
              <div className="flex justify-between">
                <span className="text-muted-foreground">إجمالي العميل (بيع)</span>
                <نص_مبلغ القيمة={الإجمالي_المالي} />
              </div>
              <div className="flex justify-between border-t border-border pt-2 text-lg">
                <span className="font-semibold">الربح</span>
                <نص_مبلغ القيمة={ربح_المباشرة} النوع={ربح_المباشرة < 0 ? "مصروف" : "إيراد"} />
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
            // ── الوضع المباشر: أثر الفاتورة على المورد والعميل معاً ──
            if (مباشرة) {
              const م = موردون.find((x) => String(x.id) === مورد_مباشر);
              const ع_ = عملاء.find((x) => String(x.id) === عميل);
              if (!م && !ع_) return null;
              const دفعة_عميل = دفعة_مفعلة ? (ع(مبلغ_الدفعة) || 0) : 0;
              const دفعة_مورد = دفعة_المورد_مفعلة ? (ع(مبلغ_دفعة_المورد) || 0) : 0;
              const جهة = (
                اسم: string,
                رصيد: number,
                قيمة: number,
                دفعة: number,
                تسمية_الأثر: string
              ) => {
                const بعد = رصيد + قيمة - دفعة;
                return (
                  <div className="space-y-1.5">
                    <div className="flex justify-between font-medium">
                      <span>{اسم}</span>
                      <نص_مبلغ القيمة={Math.abs(رصيد)} النوع={رصيد > 0 ? "مصروف" : "محايد"} />
                    </div>
                    <div className="flex justify-between text-muted-foreground">
                      <span>{تسمية_الأثر}</span>
                      <نص_مبلغ القيمة={قيمة} />
                    </div>
                    {دفعة > 0 && (
                      <div className="flex justify-between text-success">
                        <span>− الدفعة المسجّلة</span>
                        <نص_مبلغ القيمة={دفعة} النوع="إيراد" />
                      </div>
                    )}
                    <div className="flex justify-between border-t border-primary-blue/20 pt-1.5 font-semibold text-primary-blue">
                      <span>الرصيد بعد الفاتورة</span>
                      <نص_مبلغ القيمة={Math.abs(بعد)} النوع={بعد > 0 ? "مصروف" : "محايد"} />
                    </div>
                  </div>
                );
              };
              return (
                <div className="mt-3 grid gap-4 rounded-xl border border-primary-blue/30 bg-primary-blue/5 p-3 text-sm sm:grid-cols-2">
                  {م ? جهة(`المورد: ${م.name}`, م.balance, إجمالي_المورد_النموذج, دفعة_مورد, "+ مستحق للمورد (بسعر الشراء)") : <div />}
                  {ع_ ? جهة(`العميل: ${ع_.name}`, ع_.balance, الإجمالي_المالي, دفعة_عميل, "+ مديونية العميل (بسعر البيع)") : <div />}
                </div>
              );
            }
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

      {/* ── تنبيه تلقائي: فاتورة غير مسعّرة (فيه صنف بلا سعر) ── */}
      {سيُحفظ_غير_مسعّر && (
        <div className="rounded-xl border border-amber-300 bg-amber-50 p-4">
          <p className="text-[13px] leading-6 text-amber-900">
            <span className="font-semibold">فاتورة غير مسعّرة —</span> فيه صنف واحد على الأقل من غير سعر، فهتتحفظ على حساب
            {مباشرة ? " المورد والعميل " : " العميل "}
            بالأصناف والكميات والأوزان <span className="font-semibold">بدون أي أثر مالي</span> ولا يمكن تسجيل دفعة.
            لمّا تكمّل أسعار كل الأصناف (تعديل الفاتورة) يتحسب أثرها على الحساب تلقائياً.
          </p>
        </div>
      )}

      {/* ── تسجيل دفعة ── (تُخفى عند الفاتورة غير المسعّرة) */}
      {!سيُحفظ_غير_مسعّر && (
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
              : مباشرة
              ? "تسجيل تحصيل من العميل مع الفاتورة"
              : نوع_الفاتورة_الحالي === "PURCHASE"
              ? "تسجيل دفع للمورد مع الفاتورة"
              : "تسجيل دفعة مع الفاتورة"}
          </span>
        </label>

        {دفعة_مفعلة && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 border-t border-border pt-3">
            <div className="space-y-1.5">
              <العنوان مطلوب>
                {نوع_الفاتورة_الحالي === "PURCHASE"
                  ? "المبلغ المدفوع للمورد"
                  : مباشرة
                  ? "المبلغ المحصّل من العميل"
                  : "المبلغ المحصّل"}
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
      )}

      {/* ── دفع للمورد (الفاتورة المباشرة) ── */}
      {!سيُحفظ_غير_مسعّر && مباشرة && (
      <div className="card-soft p-4">
        <label className="flex cursor-pointer items-center gap-2.5 select-none">
          <input
            type="checkbox"
            checked={دفعة_المورد_مفعلة}
            onChange={(e) => {
              تعيين_دفعة_المورد_مفعلة(e.target.checked);
              if (e.target.checked && !مبلغ_دفعة_المورد && إجمالي_المورد_النموذج > 0) {
                تعيين_مبلغ_دفعة_المورد(String(إجمالي_المورد_النموذج));
              }
            }}
            className="size-4 rounded accent-primary"
          />
          <Wallet className="size-4 text-danger" />
          <span className="font-medium">تسجيل دفع للمورد مع الفاتورة</span>
        </label>

        {دفعة_المورد_مفعلة && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 border-t border-border pt-3">
            <div className="space-y-1.5">
              <العنوان مطلوب>المبلغ المدفوع للمورد</العنوان>
              <الحقل
                selectOnFocus
                className="ltr-nums"
                value={مبلغ_دفعة_المورد}
                onChange={(e) => تعيين_مبلغ_دفعة_المورد(e.target.value)}
                placeholder="0.00"
              />
            </div>
            <div className="space-y-1.5">
              <العنوان مطلوب>طريقة الدفع / الخزنة</العنوان>
              <قائمة_اختيار
                الخيارات={حسابات_الخزنة.map((h) => ({ القيمة: String(h.id), التسمية: h.التسمية }))}
                القيمة={حساب_دفعة_المورد}
                عند_التغيير={(v) => { تعيين_حساب_دفعة_المورد(v); تعيين_حساب_فرعي_دفعة_المورد(""); }}
                نص_بديل="اختر"
                قابل_للبحث={false}
              />
            </div>
            {له_فرعية_دفعة_المورد && (
              <div className="space-y-1.5 sm:col-span-2">
                <العنوان مطلوب>
                  {نوع_حساب_دفعة_المورد === "BANK" ? "البنك" : نوع_حساب_دفعة_المورد === "VODAFONE" ? "المحفظة" : "حساب إنستا"}
                </العنوان>
                <قائمة_اختيار
                  الخيارات={خيارات_فرعية_دفعة_المورد.map((s) => ({ القيمة: String(s.id), التسمية: s.الاسم }))}
                  القيمة={حساب_فرعي_دفعة_المورد}
                  عند_التغيير={تعيين_حساب_فرعي_دفعة_المورد}
                  نص_بديل="اختر…"
                />
              </div>
            )}
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
