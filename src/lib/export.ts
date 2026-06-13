"use client";
import * as XLSX from "xlsx";

export type عمود_تصدير = {
  المفتاح: string;
  العنوان: string;
  /** تنسيق رقمي (مبالغ بمنزلتين عشريتين، فاصل آلاف) */
  مبلغ?: boolean;
};

/** أداة تصدير Excel موحّدة — تستخدمها كل التقارير + قابلة للاستدعاء من أي قائمة */
export function تصدير_إكسل({
  اسم_الملف,
  اسم_الورقة = "تقرير",
  العنوان_العلوي,
  الأعمدة,
  الصفوف,
  صف_الإجمالي,
  وقت_التصدير = true,
}: {
  اسم_الملف: string;
  اسم_الورقة?: string;
  العنوان_العلوي?: string;
  الأعمدة: عمود_تصدير[];
  الصفوف: Record<string, unknown>[];
  /** صف إجمالي أخير (الأعمدة الفارغة تظهر فارغة) */
  صف_الإجمالي?: Record<string, unknown>;
  وقت_التصدير?: boolean;
}) {
  const aoa: (string | number)[][] = [];
  if (العنوان_العلوي) aoa.push([العنوان_العلوي]);
  if (وقت_التصدير) {
    const الآن = new Date();
    const ت = `${String(الآن.getDate()).padStart(2, "0")}/${String(الآن.getMonth() + 1).padStart(2, "0")}/${الآن.getFullYear()} ${String(الآن.getHours()).padStart(2, "0")}:${String(الآن.getMinutes()).padStart(2, "0")}`;
    aoa.push([`تاريخ التصدير: ${ت}`]);
  }
  if (aoa.length) aoa.push([]);

  // العناوين
  aoa.push(الأعمدة.map((ع) => ع.العنوان));

  // البيانات
  for (const r of الصفوف) {
    aoa.push(
      الأعمدة.map((ع) => {
        const v = r[ع.المفتاح];
        if (v == null) return "";
        if (typeof v === "number") return v;
        return String(v);
      })
    );
  }

  // صف الإجمالي
  if (صف_الإجمالي) {
    aoa.push(
      الأعمدة.map((ع) => {
        const v = صف_الإجمالي[ع.المفتاح];
        if (v == null) return "";
        if (typeof v === "number") return v;
        return String(v);
      })
    );
  }

  const ورقة = XLSX.utils.aoa_to_sheet(aoa);

  // RTL
  if (!ورقة["!views"]) ورقة["!views"] = [];
  ورقة["!views"][0] = { RTL: true };

  // عرض أعمدة افتراضي
  ورقة["!cols"] = الأعمدة.map((ع) => ({ wch: Math.max(ع.العنوان.length + 4, ع.مبلغ ? 16 : 14) }));

  // تنسيق المبالغ كأرقام بمنزلتين عشريتين
  const رأس_البيانات = (العنوان_العلوي ? 1 : 0) + (وقت_التصدير ? 1 : 0) + (العنوان_العلوي || وقت_التصدير ? 1 : 0); // فارغ
  const بداية_بيانات = رأس_البيانات + 1; // بعد صف العناوين
  for (let i = 0; i < الصفوف.length + (صف_الإجمالي ? 1 : 0); i++) {
    for (let j = 0; j < الأعمدة.length; j++) {
      if (!الأعمدة[j].مبلغ) continue;
      const عنوان = XLSX.utils.encode_cell({ r: بداية_بيانات + i, c: j });
      const خلية = ورقة[عنوان];
      if (خلية && typeof خلية.v === "number") خلية.z = "#,##0.00";
    }
  }

  const مصنف = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(مصنف, ورقة, اسم_الورقة);
  XLSX.writeFile(مصنف, `${اسم_الملف}.xlsx`);
}
