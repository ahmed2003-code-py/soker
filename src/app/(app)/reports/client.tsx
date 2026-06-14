"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Printer, FileSpreadsheet, Search } from "lucide-react";
import { الزر } from "@/components/ui/button";
import { الحقل } from "@/components/ui/input";
import { العنوان } from "@/components/ui/label";
import { قائمة_اختيار, type خيار } from "@/components/combobox";
import { نص_مبلغ } from "@/components/money-text";
import { نص_تاريخ } from "@/components/date-text";
import { حالة_فارغة } from "@/components/empty-state";
import { شارة_حالة } from "@/components/status-badge";
import { العملة } from "@/lib/money";
import { تنسيق_تاريخ } from "@/lib/date";
import { تصدير_إكسل, type عمود_تصدير } from "@/lib/export";
import { قائمة_التقارير, type نوع_تقرير } from "@/lib/reports";

type قيم_الفلاتر = {
  من: string;
  إلى: string;
  طرف: string;
  حساب: string;
};

type الخصائص = {
  النوع: نوع_تقرير | "";
  القيم: قيم_الفلاتر;
  العملاء: { id: number; name: string }[];
  الموردون: { id: number; name: string }[];
  حسابات_الخزنة: { id: number; التسمية: string }[];
  البيانات: unknown;
};

// أي تقارير تحتاج طرفاً؟
function يحتاج_طرف(ن: نوع_تقرير | ""): "CUSTOMER" | "SUPPLIER" | null {
  if (ن === "كشف_عميل") return "CUSTOMER";
  if (ن === "كشف_مورد") return "SUPPLIER";
  return null;
}
function يحتاج_حساب(ن: نوع_تقرير | ""): boolean {
  return ن === "خزنة_إيرادات" || ن === "خزنة_مصروفات";
}
function يحتاج_تاريخ(ن: نوع_تقرير | ""): boolean {
  return ن !== "أرصدة_الخزنة" && ن !== "شيكات_متأخرة";
}
function يقبل_فلتر_عميل(ن: نوع_تقرير | ""): boolean {
  return ن === "فواتير_يومية" || ن === "فواتير_شهرية";
}

export function شاشة_التقارير(props: الخصائص) {
  const { النوع, القيم, العملاء, الموردون, حسابات_الخزنة, البيانات } = props;
  const router = useRouter();
  const [نوع, تعيين_نوع] = React.useState<نوع_تقرير | "">(النوع);
  const [من, تعيين_من] = React.useState(القيم.من);
  const [إلى, تعيين_إلى] = React.useState(القيم.إلى);
  const [طرف, تعيين_طرف] = React.useState(القيم.طرف);
  const [حساب, تعيين_حساب] = React.useState(القيم.حساب);

  // إعادة الضبط عند تغيير النوع
  React.useEffect(() => {
    تعيين_نوع(النوع);
    تعيين_من(القيم.من);
    تعيين_إلى(القيم.إلى);
    تعيين_طرف(القيم.طرف);
    تعيين_حساب(القيم.حساب);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [النوع, القيم.من, القيم.إلى, القيم.طرف, القيم.حساب]);

  function غيّر_نوع(ن: نوع_تقرير | "") {
    تعيين_نوع(ن);
    // أعد التعيين بنوع جديد بدون فلاتر
    const p = new URLSearchParams();
    if (ن) p.set("نوع", ن);
    router.push(`/reports?${p.toString()}`);
  }

  function طبّق() {
    const p = new URLSearchParams();
    if (نوع) p.set("نوع", نوع);
    if (من) p.set("من", من);
    if (إلى) p.set("إلى", إلى);
    if (طرف) p.set("طرف", طرف);
    if (حساب) p.set("حساب", حساب);
    router.push(`/reports?${p.toString()}`);
  }

  function امسح() {
    تعيين_من("");
    تعيين_إلى("");
    تعيين_طرف("");
    تعيين_حساب("");
    const p = new URLSearchParams();
    if (نوع) p.set("نوع", نوع);
    router.push(`/reports?${p.toString()}`);
  }

  const مجموعات = React.useMemo(() => {
    const م = new Map<string, typeof قائمة_التقارير>();
    for (const ت of قائمة_التقارير) {
      const ل = م.get(ت.المجموعة) ?? ([] as typeof قائمة_التقارير);
      ل.push(ت);
      م.set(ت.المجموعة, ل);
    }
    return [...م.entries()];
  }, []);

  const يحتاج_ط = يحتاج_طرف(نوع);
  const أطراف_فلتر: { id: number; name: string }[] = يحتاج_ط === "SUPPLIER" ? الموردون : العملاء;
  const يقبل_عميل = يقبل_فلتر_عميل(نوع);
  const فلاتر_ناقصة = يحتاج_ط ? !طرف : false;

  return (
    <div className="space-y-5">
      {/* اختيار التقرير */}
      <div className="card-soft p-4 no-print">
        <العنوان>اختر التقرير</العنوان>
        <div className="mt-3 space-y-4">
          {مجموعات.map(([م, ت]) => (
            <div key={م}>
              <p className="mb-2 text-xs font-semibold text-muted-foreground">{م}</p>
              <div className="flex flex-wrap gap-2">
                {ت.map((x) => {
                  const مختار = نوع === x.القيمة;
                  return (
                    <button
                      key={x.القيمة}
                      onClick={() => غيّر_نوع(x.القيمة)}
                      className={`rounded-xl border px-3 py-1.5 text-sm transition ${
                        مختار
                          ? "border-primary bg-primary text-primary-foreground shadow-soft"
                          : "border-border bg-card hover:bg-appgray"
                      }`}
                    >
                      {x.التسمية}
                    </button>
                  );
                })}
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* الفلاتر */}
      {نوع && (
        <div className="card-soft no-print grid gap-3 p-4 sm:grid-cols-2 lg:grid-cols-5">
          {يحتاج_ط && (
            <div className="space-y-1.5 lg:col-span-2">
              <العنوان مطلوب>{يحتاج_ط === "SUPPLIER" ? "المورد" : "العميل"}</العنوان>
              <قائمة_اختيار
                الخيارات={أطراف_فلتر.map((p) => ({ القيمة: String(p.id), التسمية: p.name }))}
                القيمة={طرف}
                عند_التغيير={تعيين_طرف}
                نص_بديل="اختر…"
              />
            </div>
          )}
          {يحتاج_حساب(نوع) && (
            <div className="space-y-1.5">
              <العنوان>الحساب</العنوان>
              <قائمة_اختيار
                الخيارات={[
                  { القيمة: "", التسمية: "كل الحسابات" },
                  ...حسابات_الخزنة.map((h) => ({ القيمة: String(h.id), التسمية: h.التسمية })),
                ]}
                القيمة={حساب}
                عند_التغيير={تعيين_حساب}
                قابل_للبحث={false}
              />
            </div>
          )}
          {يقبل_عميل && (
            <div className="space-y-1.5 lg:col-span-2">
              <العنوان>العميل (اختياري)</العنوان>
              <قائمة_اختيار
                الخيارات={[
                  { القيمة: "", التسمية: "كل العملاء" },
                  ...العملاء.map((p) => ({ القيمة: String(p.id), التسمية: p.name })),
                ]}
                القيمة={طرف}
                عند_التغيير={تعيين_طرف}
              />
            </div>
          )}
          {يحتاج_تاريخ(نوع) && (
            <>
              <div className="space-y-1.5">
                <العنوان>من تاريخ</العنوان>
                <الحقل type="date" value={من} onChange={(e) => تعيين_من(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <العنوان>إلى تاريخ</العنوان>
                <الحقل type="date" value={إلى} onChange={(e) => تعيين_إلى(e.target.value)} />
              </div>
            </>
          )}
          <div className="flex items-end gap-2">
            <الزر onClick={طبّق} disabled={فلاتر_ناقصة}>
              <Search className="size-4" /> عرض
            </الزر>
            <الزر variant="outline" onClick={امسح}>
              مسح
            </الزر>
          </div>
        </div>
      )}

      {!نوع && <حالة_فارغة العنوان="اختر تقريراً للعرض" />}

      {/* النتيجة */}
      {نوع && البيانات != null && (
        <نتيجة_التقرير النوع={نوع} البيانات={البيانات} الفلاتر={{ من, إلى }} />
      )}
      {نوع && البيانات == null && يحتاج_طرف(نوع) && !طرف && (
        <حالة_فارغة
          العنوان="فلتر مطلوب"
          الوصف={`اختر ${يحتاج_طرف(نوع) === "SUPPLIER" ? "المورد" : "العميل"} لعرض التقرير.`}
        />
      )}
    </div>
  );
}

// ============================================================
// أزرار التصدير (طباعة/PDF + Excel)
// ============================================================
function أزرار_التصدير({
  العنوان,
  عند_التصدير,
}: {
  العنوان: string;
  عند_التصدير: () => void;
}) {
  return (
    <div className="no-print flex flex-wrap items-center justify-between gap-2">
      <p className="text-base font-semibold text-foreground">{العنوان}</p>
      <div className="flex gap-2">
        <الزر variant="outline" onClick={() => window.print()}>
          <Printer className="size-4" /> طباعة / PDF
        </الزر>
        <الزر variant="success" onClick={عند_التصدير}>
          <FileSpreadsheet className="size-4" /> تصدير Excel
        </الزر>
      </div>
    </div>
  );
}

// ============================================================
// عرض النتيجة بحسب النوع
// ============================================================
function نتيجة_التقرير({
  النوع,
  البيانات,
  الفلاتر,
}: {
  النوع: نوع_تقرير;
  البيانات: unknown;
  الفلاتر: { من: string; إلى: string };
}) {
  const فترة =
    الفلاتر.من && الفلاتر.إلى
      ? `الفترة: ${تنسيق_تاريخ(الفلاتر.من)} — ${تنسيق_تاريخ(الفلاتر.إلى)}`
      : الفلاتر.من
        ? `من ${تنسيق_تاريخ(الفلاتر.من)}`
        : الفلاتر.إلى
          ? `حتى ${تنسيق_تاريخ(الفلاتر.إلى)}`
          : "كل الفترات";

  if (النوع === "كشف_عميل" || النوع === "كشف_مورد") {
    return <كشف_حساب البيانات={البيانات as KashfData} فترة={فترة} />;
  }
  if (النوع === "خزنة_إيرادات" || النوع === "خزنة_مصروفات") {
    return (
      <خزنة_حركات
        البيانات={البيانات as TxnListData}
        فترة={فترة}
        إيراد={النوع === "خزنة_إيرادات"}
      />
    );
  }
  if (النوع === "أرصدة_الخزنة") {
    return <أرصدة_الخزنة البيانات={البيانات as BalancesData} />;
  }
  if (النوع === "فواتير_يومية") {
    return <فواتير_يومية البيانات={البيانات as InvoicesDaily} فترة={فترة} />;
  }
  if (النوع === "فواتير_شهرية") {
    return <فواتير_شهرية البيانات={البيانات as MonthlyData} فترة={فترة} />;
  }
  if (النوع === "فواتير_حسب_العميل") {
    return <فواتير_حسب_العميل البيانات={البيانات as PerCustomer} فترة={فترة} />;
  }
  if (النوع === "شيكات_مستحقة") {
    return <شيكات_مستحقة البيانات={البيانات as ChequesList} فترة={فترة} />;
  }
  if (النوع === "شيكات_متأخرة") {
    return <شيكات_مستحقة البيانات={البيانات as ChequesList} فترة="المتأخرة" متأخرة />;
  }
  if (النوع === "شيكات_شهرية") {
    return <شيكات_شهرية البيانات={البيانات as MonthlyData} فترة={فترة} />;
  }
  return null;
}

// ============================================================
// أنواع البيانات
// ============================================================
type KashfData = {
  الطرف: { id: number; الاسم: string; النوع: "CUSTOMER" | "SUPPLIER"; الهاتف: string };
  رصيد_افتتاحي: number;
  الصفوف: {
    التاريخ: string;
    رقم_المستند: string;
    البيان: string;
    التصنيف: string;
    مدين: number;
    دائن: number;
    الرصيد: number;
  }[];
  مجموع_مدين: number;
  مجموع_دائن: number;
  الرصيد_الختامي: number;
  إجمالي_الفواتير: number;
  إجمالي_المدفوعات: number;
};

type TxnListData = {
  الصفوف: {
    التاريخ: string;
    الحساب: string;
    البيان: string;
    الطرف: string;
    طريقة_الدفع: string;
    المبلغ: number;
  }[];
  الإجمالي: number;
};

type BalancesData = {
  الصفوف: {
    الحساب: string;
    الرصيد: number;
    الحد_الأدنى: number;
    تحت_الحد: boolean;
  }[];
  الإجمالي: number;
};

type InvoicesDaily = {
  الصفوف: {
    التاريخ: string;
    الرقم: number;
    العميل: string;
    إجمالي_الكمية: number;
    إجمالي_الوزن: number;
    الإجمالي: number;
  }[];
  الإجمالي_العام: number;
};

type MonthlyData = {
  الصفوف: { الشهر: string; عدد: number; الإجمالي: number }[];
  الإجمالي_العام?: number;
  الإجمالي?: number;
};

type PerCustomer = {
  الصفوف: { العميل: string; عدد: number; الإجمالي: number }[];
  الإجمالي_العام: number;
};

type ChequesList = {
  الصفوف: {
    تاريخ_الاستحقاق: string;
    اسم_المدين: string;
    المستفيد: string;
    اسم_البنك: string;
    رقم_الشيك: string;
    المبلغ: number;
    متأخر?: boolean;
  }[];
  الإجمالي: number;
};

// ============================================================
// 1) كشف حساب طرف
// ============================================================
function كشف_حساب({ البيانات, فترة }: { البيانات: KashfData | null; فترة: string }) {
  if (!البيانات) return <حالة_فارغة العنوان="لم يُعثر على الطرف" />;
  const ك = البيانات;
  const نوع_طرف = ك.الطرف.النوع === "CUSTOMER" ? "عميل" : "مورد";
  const تسمية_رصيد = ك.الطرف.النوع === "CUSTOMER" ? "المديونية الحالية" : "المستحق للمورد";

  const أعمدة: عمود_تصدير[] = [
    { المفتاح: "التاريخ", العنوان: "التاريخ" },
    { المفتاح: "رقم_المستند", العنوان: "رقم المستند" },
    { المفتاح: "البيان", العنوان: "البيان" },
    { المفتاح: "التصنيف", العنوان: "التصنيف" },
    { المفتاح: "مدين", العنوان: "مدين", مبلغ: true },
    { المفتاح: "دائن", العنوان: "دائن", مبلغ: true },
    { المفتاح: "الرصيد", العنوان: "الرصيد", مبلغ: true },
  ];

  function تصدير() {
    تصدير_إكسل({
      اسم_الملف: `كشف_حساب_${ك.الطرف.الاسم}`,
      العنوان_العلوي: `كشف حساب ${نوع_طرف}: ${ك.الطرف.الاسم} — ${فترة}`,
      الأعمدة: أعمدة,
      الصفوف: [
        ...(ك.رصيد_افتتاحي
          ? [{ التاريخ: "", رقم_المستند: "", البيان: "رصيد افتتاحي", التصنيف: "", مدين: 0, دائن: 0, الرصيد: ك.رصيد_افتتاحي }]
          : []),
        ...ك.الصفوف.map((r) => ({ ...r, التاريخ: تنسيق_تاريخ(r.التاريخ) })),
      ],
      صف_الإجمالي: {
        التاريخ: "",
        رقم_المستند: "",
        البيان: "الإجمالي",
        التصنيف: "",
        مدين: ك.مجموع_مدين,
        دائن: ك.مجموع_دائن,
        الرصيد: ك.الرصيد_الختامي,
      },
    });
  }

  return (
    <div className="space-y-3">
      <أزرار_التصدير العنوان={`كشف حساب ${نوع_طرف}: ${ك.الطرف.الاسم}`} عند_التصدير={تصدير} />

      <div className="card-soft p-5 print:border-none print:p-2 print:shadow-none">
        <div className="mb-4 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-3">
          <div>
            <h2 className="text-lg font-bold">{`كشف حساب ${نوع_طرف}`}</h2>
            <p className="text-sm text-muted-foreground">{ك.الطرف.الاسم}{ك.الطرف.الهاتف ? ` — ${ك.الطرف.الهاتف}` : ""}</p>
          </div>
          <p className="text-sm text-muted-foreground">{فترة}</p>
        </div>

        <div className="mb-4 grid gap-3 sm:grid-cols-3">
          <مؤشر_صغير العنوان={ك.الطرف.النوع === "CUSTOMER" ? "إجمالي الفواتير" : "إجمالي المشتريات"} قيمة={ك.إجمالي_الفواتير} />
          <مؤشر_صغير العنوان={ك.الطرف.النوع === "CUSTOMER" ? "إجمالي المدفوعات" : "إجمالي مدفوعاتنا"} قيمة={ك.إجمالي_المدفوعات} />
          <مؤشر_صغير العنوان={تسمية_رصيد} قيمة={ك.الرصيد_الختامي} لون_موجب />
        </div>

        <جدول_بسيط
          الأعمدة={[
            { العنوان: "التاريخ" },
            { العنوان: "رقم المستند" },
            { العنوان: "البيان" },
            { العنوان: "التصنيف" },
            { العنوان: "مدين", رقم: true },
            { العنوان: "دائن", رقم: true },
            { العنوان: "الرصيد", رقم: true },
          ]}
        >
          {ك.رصيد_افتتاحي !== 0 && (
            <tr className="bg-appgray/60">
              <td className="px-3 py-2" colSpan={4}>رصيد افتتاحي</td>
              <td className="px-3 py-2 text-end" />
              <td className="px-3 py-2 text-end" />
              <td className="px-3 py-2 text-end"><نص_مبلغ القيمة={ك.رصيد_افتتاحي} مع_العملة={false} /></td>
            </tr>
          )}
          {ك.الصفوف.map((r, i) => (
            <tr key={i} className="border-t border-border">
              <td className="px-3 py-2"><نص_تاريخ القيمة={r.التاريخ} /></td>
              <td className="px-3 py-2 ltr-nums">{r.رقم_المستند || "—"}</td>
              <td className="px-3 py-2">{r.البيان}</td>
              <td className="px-3 py-2">{r.التصنيف || "—"}</td>
              <td className="px-3 py-2 text-end">
                {r.مدين ? <نص_مبلغ القيمة={r.مدين} مع_العملة={false} /> : "—"}
              </td>
              <td className="px-3 py-2 text-end">
                {r.دائن ? <نص_مبلغ القيمة={r.دائن} مع_العملة={false} /> : "—"}
              </td>
              <td className="px-3 py-2 text-end"><نص_مبلغ القيمة={r.الرصيد} مع_العملة={false} /></td>
            </tr>
          ))}
          <tr className="border-t-2 border-border bg-appgray/60 font-semibold">
            <td className="px-3 py-2" colSpan={4}>الإجمالي</td>
            <td className="px-3 py-2 text-end"><نص_مبلغ القيمة={ك.مجموع_مدين} مع_العملة={false} /></td>
            <td className="px-3 py-2 text-end"><نص_مبلغ القيمة={ك.مجموع_دائن} مع_العملة={false} /></td>
            <td className="px-3 py-2 text-end"><نص_مبلغ القيمة={ك.الرصيد_الختامي} مع_العملة={false} /></td>
          </tr>
        </جدول_بسيط>

        <p className="mt-3 text-xs text-muted-foreground">العملة: {العملة}</p>
      </div>
    </div>
  );
}

// ============================================================
// 2) خزنة — حركات (إيراد/مصروف)
// ============================================================
function خزنة_حركات({
  البيانات,
  فترة,
  إيراد,
}: {
  البيانات: TxnListData;
  فترة: string;
  إيراد: boolean;
}) {
  const اسم = إيراد ? "إيرادات الخزنة" : "مصروفات الخزنة";
  const أعمدة: عمود_تصدير[] = [
    { المفتاح: "التاريخ", العنوان: "التاريخ" },
    { المفتاح: "الحساب", العنوان: "الحساب" },
    { المفتاح: "البيان", العنوان: "البيان" },
    { المفتاح: "الطرف", العنوان: "الطرف" },
    { المفتاح: "طريقة_الدفع", العنوان: "طريقة الدفع" },
    { المفتاح: "المبلغ", العنوان: "المبلغ", مبلغ: true },
  ];

  function تصدير() {
    تصدير_إكسل({
      اسم_الملف: اسم,
      العنوان_العلوي: `${اسم} — ${فترة}`,
      الأعمدة: أعمدة,
      الصفوف: البيانات.الصفوف.map((r) => ({ ...r, التاريخ: تنسيق_تاريخ(r.التاريخ) })),
      صف_الإجمالي: { التاريخ: "", الحساب: "", البيان: "الإجمالي", الطرف: "", طريقة_الدفع: "", المبلغ: البيانات.الإجمالي },
    });
  }

  return (
    <div className="space-y-3">
      <أزرار_التصدير العنوان={اسم} عند_التصدير={تصدير} />
      <div className="card-soft p-5 print:border-none print:p-2 print:shadow-none">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2 border-b border-border pb-2">
          <h2 className="text-lg font-bold">{اسم}</h2>
          <p className="text-sm text-muted-foreground">{فترة}</p>
        </div>
        <جدول_بسيط
          الأعمدة={[
            { العنوان: "التاريخ" },
            { العنوان: "الحساب" },
            { العنوان: "البيان" },
            { العنوان: "الطرف" },
            { العنوان: "طريقة الدفع" },
            { العنوان: "المبلغ", رقم: true },
          ]}
        >
          {البيانات.الصفوف.map((r, i) => (
            <tr key={i} className="border-t border-border">
              <td className="px-3 py-2"><نص_تاريخ القيمة={r.التاريخ} /></td>
              <td className="px-3 py-2">{r.الحساب}</td>
              <td className="px-3 py-2">{r.البيان}</td>
              <td className="px-3 py-2">{r.الطرف || "—"}</td>
              <td className="px-3 py-2">{r.طريقة_الدفع || "—"}</td>
              <td className="px-3 py-2 text-end">
                <نص_مبلغ القيمة={r.المبلغ} النوع={إيراد ? "إيراد" : "مصروف"} مع_العملة={false} />
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-border bg-appgray/60 font-semibold">
            <td className="px-3 py-2" colSpan={5}>الإجمالي</td>
            <td className="px-3 py-2 text-end"><نص_مبلغ القيمة={البيانات.الإجمالي} مع_العملة={false} /></td>
          </tr>
        </جدول_بسيط>
        {البيانات.الصفوف.length === 0 && <p className="mt-3 text-center text-sm text-muted-foreground">لا توجد حركات في النطاق المحدد.</p>}
      </div>
    </div>
  );
}

// ============================================================
// 3) أرصدة الخزنة
// ============================================================
function أرصدة_الخزنة({ البيانات }: { البيانات: BalancesData }) {
  const أعمدة: عمود_تصدير[] = [
    { المفتاح: "الحساب", العنوان: "الحساب" },
    { المفتاح: "الرصيد", العنوان: "الرصيد", مبلغ: true },
    { المفتاح: "الحد_الأدنى", العنوان: "الحد الأدنى", مبلغ: true },
    { المفتاح: "الحالة", العنوان: "الحالة" },
  ];
  function تصدير() {
    تصدير_إكسل({
      اسم_الملف: "أرصدة_الخزنة",
      العنوان_العلوي: "أرصدة الخزنة",
      الأعمدة: أعمدة,
      الصفوف: البيانات.الصفوف.map((r) => ({
        الحساب: r.الحساب,
        الرصيد: r.الرصيد,
        الحد_الأدنى: r.الحد_الأدنى,
        الحالة: r.تحت_الحد ? "تحت الحد" : "سليم",
      })),
      صف_الإجمالي: { الحساب: "الإجمالي", الرصيد: البيانات.الإجمالي, الحد_الأدنى: "", الحالة: "" },
    });
  }
  return (
    <div className="space-y-3">
      <أزرار_التصدير العنوان="أرصدة الخزنة" عند_التصدير={تصدير} />
      <div className="card-soft p-5 print:border-none print:p-2 print:shadow-none">
        <جدول_بسيط
          الأعمدة={[
            { العنوان: "الحساب" },
            { العنوان: "الرصيد", رقم: true },
            { العنوان: "الحد الأدنى", رقم: true },
            { العنوان: "الحالة" },
          ]}
        >
          {البيانات.الصفوف.map((r, i) => (
            <tr key={i} className="border-t border-border">
              <td className="px-3 py-2">{r.الحساب}</td>
              <td className="px-3 py-2 text-end"><نص_مبلغ القيمة={r.الرصيد} مع_العملة={false} /></td>
              <td className="px-3 py-2 text-end"><نص_مبلغ القيمة={r.الحد_الأدنى} مع_العملة={false} /></td>
              <td className="px-3 py-2">
                <شارة_حالة الحالة={r.تحت_الحد ? "متأخر" : "نشط"} متغيّر={r.تحت_الحد ? "danger" : "success"} />
              </td>
            </tr>
          ))}
          <tr className="border-t-2 border-border bg-appgray/60 font-semibold">
            <td className="px-3 py-2">الإجمالي</td>
            <td className="px-3 py-2 text-end"><نص_مبلغ القيمة={البيانات.الإجمالي} مع_العملة={false} /></td>
            <td className="px-3 py-2 text-end">—</td>
            <td className="px-3 py-2">—</td>
          </tr>
        </جدول_بسيط>
      </div>
    </div>
  );
}

// ============================================================
// 4) الفواتير اليومية
// ============================================================
function فواتير_يومية({ البيانات, فترة }: { البيانات: InvoicesDaily; فترة: string }) {
  const أعمدة: عمود_تصدير[] = [
    { المفتاح: "التاريخ", العنوان: "التاريخ" },
    { المفتاح: "الرقم", العنوان: "رقم الفاتورة" },
    { المفتاح: "العميل", العنوان: "العميل" },
    { المفتاح: "إجمالي_الكمية", العنوان: "الكمية", مبلغ: true },
    { المفتاح: "إجمالي_الوزن", العنوان: "الوزن (كجم)", مبلغ: true },
    { المفتاح: "الإجمالي", العنوان: "الإجمالي", مبلغ: true },
  ];
  function تصدير() {
    تصدير_إكسل({
      اسم_الملف: "الفواتير_اليومية",
      العنوان_العلوي: `الفواتير اليومية — ${فترة}`,
      الأعمدة: أعمدة,
      الصفوف: البيانات.الصفوف.map((r) => ({ ...r, التاريخ: تنسيق_تاريخ(r.التاريخ) })),
      صف_الإجمالي: {
        التاريخ: "",
        الرقم: "",
        العميل: "الإجمالي",
        إجمالي_الكمية: "",
        إجمالي_الوزن: "",
        الإجمالي: البيانات.الإجمالي_العام,
      },
    });
  }
  return (
    <div className="space-y-3">
      <أزرار_التصدير العنوان="الفواتير اليومية" عند_التصدير={تصدير} />
      <div className="card-soft p-5 print:border-none print:p-2 print:shadow-none">
        <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-lg font-bold">الفواتير اليومية</h2>
          <p className="text-sm text-muted-foreground">{فترة}</p>
        </div>
        <جدول_بسيط
          الأعمدة={[
            { العنوان: "التاريخ" },
            { العنوان: "رقم الفاتورة" },
            { العنوان: "العميل" },
            { العنوان: "الكمية", رقم: true },
            { العنوان: "الوزن (كجم)", رقم: true },
            { العنوان: "الإجمالي", رقم: true },
          ]}
        >
          {البيانات.الصفوف.map((r, i) => (
            <tr key={i} className="border-t border-border">
              <td className="px-3 py-2"><نص_تاريخ القيمة={r.التاريخ} /></td>
              <td className="px-3 py-2 ltr-nums">#{String(r.الرقم).padStart(4, "0")}</td>
              <td className="px-3 py-2">{r.العميل}</td>
              <td className="px-3 py-2 text-end ltr-nums tabular-nums">{r.إجمالي_الكمية}</td>
              <td className="px-3 py-2 text-end ltr-nums tabular-nums">{r.إجمالي_الوزن}</td>
              <td className="px-3 py-2 text-end"><نص_مبلغ القيمة={r.الإجمالي} مع_العملة={false} /></td>
            </tr>
          ))}
          <tr className="border-t-2 border-border bg-appgray/60 font-semibold">
            <td className="px-3 py-2" colSpan={5}>الإجمالي العام</td>
            <td className="px-3 py-2 text-end"><نص_مبلغ القيمة={البيانات.الإجمالي_العام} مع_العملة={false} /></td>
          </tr>
        </جدول_بسيط>
      </div>
    </div>
  );
}

// ============================================================
// 5) الفواتير الشهرية / 8) الشيكات الشهرية
// ============================================================
function فواتير_شهرية({ البيانات, فترة }: { البيانات: MonthlyData; فترة: string }) {
  return <تقرير_شهري العنوان="الفواتير الشهرية" البيانات={البيانات} فترة={فترة} />;
}
function شيكات_شهرية({ البيانات, فترة }: { البيانات: MonthlyData; فترة: string }) {
  return <تقرير_شهري العنوان="الشيكات حسب الشهر" البيانات={البيانات} فترة={فترة} />;
}

function تقرير_شهري({
  العنوان: عنوان,
  البيانات,
  فترة,
}: {
  العنوان: string;
  البيانات: MonthlyData;
  فترة: string;
}) {
  const الإجمالي = البيانات.الإجمالي_العام ?? البيانات.الإجمالي ?? 0;
  const أعمدة: عمود_تصدير[] = [
    { المفتاح: "الشهر", العنوان: "الشهر" },
    { المفتاح: "عدد", العنوان: "العدد" },
    { المفتاح: "الإجمالي", العنوان: "الإجمالي", مبلغ: true },
  ];
  function تصدير() {
    تصدير_إكسل({
      اسم_الملف: عنوان.replace(/ /g, "_"),
      العنوان_العلوي: `${عنوان} — ${فترة}`,
      الأعمدة: أعمدة,
      الصفوف: البيانات.الصفوف,
      صف_الإجمالي: { الشهر: "الإجمالي العام", عدد: "", الإجمالي: الإجمالي },
    });
  }
  return (
    <div className="space-y-3">
      <أزرار_التصدير العنوان={عنوان} عند_التصدير={تصدير} />
      <div className="card-soft p-5 print:border-none print:p-2 print:shadow-none">
        <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-lg font-bold">{عنوان}</h2>
          <p className="text-sm text-muted-foreground">{فترة}</p>
        </div>
        <جدول_بسيط
          الأعمدة={[
            { العنوان: "الشهر" },
            { العنوان: "العدد", رقم: true },
            { العنوان: "الإجمالي", رقم: true },
          ]}
        >
          {البيانات.الصفوف.map((r, i) => (
            <tr key={i} className="border-t border-border">
              <td className="px-3 py-2">{r.الشهر}</td>
              <td className="px-3 py-2 text-end ltr-nums">{r.عدد}</td>
              <td className="px-3 py-2 text-end"><نص_مبلغ القيمة={r.الإجمالي} مع_العملة={false} /></td>
            </tr>
          ))}
          <tr className="border-t-2 border-border bg-appgray/60 font-semibold">
            <td className="px-3 py-2" colSpan={2}>الإجمالي العام</td>
            <td className="px-3 py-2 text-end"><نص_مبلغ القيمة={الإجمالي} مع_العملة={false} /></td>
          </tr>
        </جدول_بسيط>
      </div>
    </div>
  );
}

// ============================================================
// 6) الفواتير حسب العميل
// ============================================================
function فواتير_حسب_العميل({ البيانات, فترة }: { البيانات: PerCustomer; فترة: string }) {
  const أعمدة: عمود_تصدير[] = [
    { المفتاح: "العميل", العنوان: "العميل" },
    { المفتاح: "عدد", العنوان: "عدد الفواتير" },
    { المفتاح: "الإجمالي", العنوان: "الإجمالي", مبلغ: true },
  ];
  function تصدير() {
    تصدير_إكسل({
      اسم_الملف: "الفواتير_حسب_العميل",
      العنوان_العلوي: `الفواتير حسب العميل — ${فترة}`,
      الأعمدة: أعمدة,
      الصفوف: البيانات.الصفوف,
      صف_الإجمالي: { العميل: "الإجمالي العام", عدد: "", الإجمالي: البيانات.الإجمالي_العام },
    });
  }
  return (
    <div className="space-y-3">
      <أزرار_التصدير العنوان="الفواتير حسب العميل" عند_التصدير={تصدير} />
      <div className="card-soft p-5 print:border-none print:p-2 print:shadow-none">
        <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-lg font-bold">الفواتير حسب العميل</h2>
          <p className="text-sm text-muted-foreground">{فترة}</p>
        </div>
        <جدول_بسيط
          الأعمدة={[
            { العنوان: "العميل" },
            { العنوان: "عدد الفواتير", رقم: true },
            { العنوان: "الإجمالي", رقم: true },
          ]}
        >
          {البيانات.الصفوف.map((r, i) => (
            <tr key={i} className="border-t border-border">
              <td className="px-3 py-2">{r.العميل}</td>
              <td className="px-3 py-2 text-end ltr-nums">{r.عدد}</td>
              <td className="px-3 py-2 text-end"><نص_مبلغ القيمة={r.الإجمالي} مع_العملة={false} /></td>
            </tr>
          ))}
          <tr className="border-t-2 border-border bg-appgray/60 font-semibold">
            <td className="px-3 py-2" colSpan={2}>الإجمالي العام</td>
            <td className="px-3 py-2 text-end"><نص_مبلغ القيمة={البيانات.الإجمالي_العام} مع_العملة={false} /></td>
          </tr>
        </جدول_بسيط>
      </div>
    </div>
  );
}

// ============================================================
// 7) الشيكات المستحقة/المتأخرة
// ============================================================
function شيكات_مستحقة({
  البيانات,
  فترة,
  متأخرة,
}: {
  البيانات: ChequesList;
  فترة: string;
  متأخرة?: boolean;
}) {
  const اسم = متأخرة ? "الشيكات المتأخرة" : "الشيكات المستحقة";
  const أعمدة: عمود_تصدير[] = [
    { المفتاح: "تاريخ_الاستحقاق", العنوان: "تاريخ الاستحقاق" },
    { المفتاح: "اسم_المدين", العنوان: "اسم المدين" },
    { المفتاح: "المستفيد", العنوان: "المستفيد" },
    { المفتاح: "اسم_البنك", العنوان: "اسم البنك" },
    { المفتاح: "رقم_الشيك", العنوان: "رقم الشيك" },
    { المفتاح: "المبلغ", العنوان: "المبلغ", مبلغ: true },
  ];
  function تصدير() {
    تصدير_إكسل({
      اسم_الملف: اسم.replace(/ /g, "_"),
      العنوان_العلوي: `${اسم} — ${فترة}`,
      الأعمدة: أعمدة,
      الصفوف: البيانات.الصفوف.map((r) => ({ ...r, تاريخ_الاستحقاق: تنسيق_تاريخ(r.تاريخ_الاستحقاق) })),
      صف_الإجمالي: {
        تاريخ_الاستحقاق: "",
        اسم_المدين: "",
        المستفيد: "",
        اسم_البنك: "",
        رقم_الشيك: "الإجمالي",
        المبلغ: البيانات.الإجمالي,
      },
    });
  }
  return (
    <div className="space-y-3">
      <أزرار_التصدير العنوان={اسم} عند_التصدير={تصدير} />
      <div className="card-soft p-5 print:border-none print:p-2 print:shadow-none">
        <div className="mb-3 flex items-center justify-between border-b border-border pb-2">
          <h2 className="text-lg font-bold">{اسم}</h2>
          <p className="text-sm text-muted-foreground">{فترة}</p>
        </div>
        <جدول_بسيط
          الأعمدة={[
            { العنوان: "تاريخ الاستحقاق" },
            { العنوان: "اسم المدين" },
            { العنوان: "المستفيد" },
            { العنوان: "اسم البنك" },
            { العنوان: "رقم الشيك" },
            { العنوان: "المبلغ", رقم: true },
          ]}
        >
          {البيانات.الصفوف.map((r, i) => (
            <tr key={i} className={`border-t border-border ${r.متأخر ? "bg-danger-soft/30" : ""}`}>
              <td className="px-3 py-2">
                <نص_تاريخ القيمة={r.تاريخ_الاستحقاق} />
                {r.متأخر && <span className="ms-1"><شارة_حالة الحالة="متأخر" /></span>}
              </td>
              <td className="px-3 py-2">{r.اسم_المدين}</td>
              <td className="px-3 py-2">{r.المستفيد || "—"}</td>
              <td className="px-3 py-2">{r.اسم_البنك || "—"}</td>
              <td className="px-3 py-2 ltr-nums">{r.رقم_الشيك || "—"}</td>
              <td className="px-3 py-2 text-end"><نص_مبلغ القيمة={r.المبلغ} مع_العملة={false} /></td>
            </tr>
          ))}
          <tr className="border-t-2 border-border bg-appgray/60 font-semibold">
            <td className="px-3 py-2" colSpan={5}>الإجمالي</td>
            <td className="px-3 py-2 text-end"><نص_مبلغ القيمة={البيانات.الإجمالي} مع_العملة={false} /></td>
          </tr>
        </جدول_بسيط>
        {البيانات.الصفوف.length === 0 && (
          <p className="mt-3 text-center text-sm text-muted-foreground">لا توجد شيكات مطابقة.</p>
        )}
      </div>
    </div>
  );
}

// ============================================================
// مكوّنات صغيرة
// ============================================================
function مؤشر_صغير({
  العنوان: ع,
  قيمة,
  لون_موجب,
}: {
  العنوان: string;
  قيمة: number;
  لون_موجب?: boolean;
}) {
  return (
    <div className="rounded-xl border border-border bg-appgray/40 p-3">
      <p className="text-xs text-muted-foreground">{ع}</p>
      <div className={`mt-1 text-lg font-bold ${لون_موجب && قيمة > 0 ? "text-danger" : "text-foreground"}`}>
        <نص_مبلغ القيمة={قيمة} />
      </div>
    </div>
  );
}

function جدول_بسيط({
  الأعمدة: أعمدة,
  children,
}: {
  الأعمدة: { العنوان: string; رقم?: boolean }[];
  children: React.ReactNode;
}) {
  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead className="bg-appgray text-muted-foreground">
          <tr>
            {أعمدة.map((ع, i) => (
              <th key={i} className={`px-3 py-2 text-start font-medium ${ع.رقم ? "text-end" : ""}`}>
                {ع.العنوان}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>{children}</tbody>
      </table>
    </div>
  );
}
