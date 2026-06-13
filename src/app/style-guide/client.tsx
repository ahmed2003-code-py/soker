"use client";
import * as React from "react";
import {
  Wallet,
  Users,
  FileText,
  Receipt,
  TrendingUp,
} from "lucide-react";
import { الزر } from "@/components/ui/button";
import { الحقل, منطقة_نص } from "@/components/ui/input";
import { العنوان } from "@/components/ui/label";
import {
  البطاقة,
  رأس_البطاقة,
  عنوان_البطاقة,
  محتوى_البطاقة,
} from "@/components/ui/card";
import { الشارة } from "@/components/ui/badge";
import { هيكل_تحميل } from "@/components/ui/skeleton";
import {
  التبويبات,
  قائمة_التبويبات,
  زر_تبويب,
  محتوى_تبويب,
} from "@/components/ui/tabs";
import {
  الحوار,
  زر_الحوار,
  محتوى_الحوار,
  رأس_الحوار,
  عنوان_الحوار,
  وصف_الحوار,
  تذييل_الحوار,
} from "@/components/ui/dialog";
import { ترويسة_الصفحة } from "@/components/page-header";
import { بطاقة_مؤشر } from "@/components/kpi-card";
import { نص_مبلغ } from "@/components/money-text";
import { نص_تاريخ } from "@/components/date-text";
import { شارة_حالة } from "@/components/status-badge";
import { حالة_فارغة } from "@/components/empty-state";
import { قائمة_اختيار } from "@/components/combobox";
import { جدول_بيانات, type عمود } from "@/components/data-table";
import { حوار_تأكيد } from "@/components/confirm-dialog";
import { useإشعار } from "@/components/ui/toast";

type عميل_تجريبي = {
  id: number;
  الاسم: string;
  الهاتف: string;
  الرصيد: number;
  الحالة: string;
};

const عملاء: عميل_تجريبي[] = [
  { id: 1, الاسم: "أحمد سكر", الهاتف: "01000000001", الرصيد: 135000, الحالة: "نشط" },
  { id: 2, الاسم: "شركة النسيج الحديثة", الهاتف: "01000000002", الرصيد: 0, الحالة: "نشط" },
  { id: 3, الاسم: "مؤسسة الغزل الذهبي", الهاتف: "01000000003", الرصيد: -2500, الحالة: "متوقف" },
];

export function دليل_الأنماط() {
  const إشعار = useإشعار();
  const [طريقة_الدفع, تعيين_طريقة] = React.useState<string>("بنك");
  const [تأكيد, تعيين_تأكيد] = React.useState(false);

  const أعمدة: عمود<عميل_تجريبي>[] = [
    { المفتاح: "الاسم", العنوان: "الاسم", قابل_للفرز: true },
    { المفتاح: "الهاتف", العنوان: "الهاتف", مخفي_موبايل: true },
    {
      المفتاح: "الرصيد",
      العنوان: "الرصيد",
      قابل_للفرز: true,
      قيمة: (ص) => ص.الرصيد,
      خلية: (ص) => (
        <نص_مبلغ القيمة={ص.الرصيد} النوع={ص.الرصيد >= 0 ? "محايد" : "مصروف"} />
      ),
      محاذاة: "end",
    },
    {
      المفتاح: "الحالة",
      العنوان: "الحالة",
      خلية: (ص) => <شارة_حالة الحالة={ص.الحالة} />,
    },
  ];

  return (
    <div className="mx-auto max-w-5xl space-y-10 p-4 sm:p-8">
      <ترويسة_الصفحة
        العنوان="دليل الأنماط"
        الوصف="جميع العناصر الأساسية للنظام بتصميم أبيض و RTL"
        إجراء={<الزر>زر أساسي</الزر>}
      />

      {/* المؤشرات */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">بطاقات المؤشرات (KPI)</h2>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          <بطاقة_مؤشر
            العنوان="إجمالي الخزنة"
            القيمة={<نص_مبلغ القيمة={1250475} />}
            أيقونة={<Wallet className="size-5" />}
            لون="navy"
          />
          <بطاقة_مؤشر
            العنوان="مديونية العملاء"
            القيمة={<نص_مبلغ القيمة={845000} />}
            أيقونة={<Users className="size-5" />}
            لون="danger"
          />
          <بطاقة_مؤشر
            العنوان="فواتير اليوم"
            القيمة="12"
            أيقونة={<FileText className="size-5" />}
            لون="success"
          />
          <بطاقة_مؤشر
            العنوان="شيكات تستحق قريباً"
            القيمة="3"
            أيقونة={<Receipt className="size-5" />}
            لون="warning"
          />
        </div>
      </section>

      {/* الأزرار والشارات */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">الأزرار والشارات</h2>
        <البطاقة>
          <محتوى_البطاقة className="flex flex-wrap gap-3 pt-5">
            <الزر>أساسي</الزر>
            <الزر variant="blue">أزرق</الزر>
            <الزر variant="success">حفظ</الزر>
            <الزر variant="danger">حذف</الزر>
            <الزر variant="outline">إطار</الزر>
            <الزر variant="ghost">شفاف</الزر>
            <الشارة variant="navy">عميل</الشارة>
            <الشارة variant="success">محصّل</الشارة>
            <الشارة variant="danger">مرتجع</الشارة>
            <الشارة variant="warning">منتظر</الشارة>
          </محتوى_البطاقة>
        </البطاقة>
      </section>

      {/* النماذج */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">عناصر الإدخال</h2>
        <البطاقة>
          <محتوى_البطاقة className="grid gap-4 pt-5 sm:grid-cols-2">
            <div className="space-y-1.5">
              <العنوان مطلوب>الاسم</العنوان>
              <الحقل placeholder="اسم العميل" autoFocus />
            </div>
            <div className="space-y-1.5">
              <العنوان>المبلغ</العنوان>
              <الحقل placeholder="0.00" selectOnFocus defaultValue="185000" />
            </div>
            <div className="space-y-1.5">
              <العنوان>طريقة الدفع (قائمة اختيار)</العنوان>
              <قائمة_اختيار
                الخيارات={[
                  { القيمة: "نقدي", التسمية: "نقدي" },
                  { القيمة: "إنستا باي", التسمية: "إنستا باي" },
                  { القيمة: "بنك", التسمية: "بنك" },
                  { القيمة: "فودافون كاش", التسمية: "فودافون كاش" },
                ]}
                القيمة={طريقة_الدفع}
                عند_التغيير={تعيين_طريقة}
              />
            </div>
            <div className="space-y-1.5 sm:col-span-2">
              <العنوان>ملاحظات</العنوان>
              <منطقة_نص placeholder="أي ملاحظات إضافية…" />
            </div>
          </محتوى_البطاقة>
        </البطاقة>
      </section>

      {/* المبالغ والتواريخ */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">المبالغ والتواريخ</h2>
        <البطاقة>
          <محتوى_البطاقة className="flex flex-wrap items-center gap-6 pt-5">
            <نص_مبلغ القيمة={1250475.5} />
            <نص_مبلغ القيمة={50000} النوع="إيراد" />
            <نص_مبلغ القيمة={12000} النوع="مصروف" />
            <نص_تاريخ القيمة={new Date()} />
            <نص_تاريخ القيمة={new Date()} مع_الوقت />
          </محتوى_البطاقة>
        </البطاقة>
      </section>

      {/* الحوارات والإشعارات */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">الحوارات والإشعارات</h2>
        <البطاقة>
          <محتوى_البطاقة className="flex flex-wrap gap-3 pt-5">
            <الحوار>
              <زر_الحوار asChild>
                <الزر variant="blue">فتح حوار</الزر>
              </زر_الحوار>
              <محتوى_الحوار>
                <رأس_الحوار>
                  <عنوان_الحوار>نموذج إضافة</عنوان_الحوار>
                  <وصف_الحوار>هكذا يظهر نموذج الإضافة بكل الحقول.</وصف_الحوار>
                </رأس_الحوار>
                <div className="space-y-1.5">
                  <العنوان مطلوب>الاسم</العنوان>
                  <الحقل autoFocus placeholder="اكتب الاسم" />
                </div>
                <تذييل_الحوار>
                  <الزر variant="success">حفظ</الزر>
                </تذييل_الحوار>
              </محتوى_الحوار>
            </الحوار>

            <الزر onClick={() => إشعار.نجاح("تم الحفظ", "تمت العملية بنجاح")}>
              إشعار نجاح
            </الزر>
            <الزر
              variant="danger"
              onClick={() => إشعار.خطأ("حدث خطأ", "تعذّر إتمام العملية")}
            >
              إشعار خطأ
            </الزر>
            <الزر variant="outline" onClick={() => تعيين_تأكيد(true)}>
              حوار تأكيد الحذف
            </الزر>
            <حوار_تأكيد
              مفتوح={تأكيد}
              عند_التغيير={تعيين_تأكيد}
              العنوان="حذف العميل"
              الوصف="سيتم حذف العميل نهائياً. هل تريد المتابعة؟"
              عند_التأكيد={() => إشعار.نجاح("تم الحذف")}
            />
          </محتوى_البطاقة>
        </البطاقة>
      </section>

      {/* التبويبات */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">التبويبات</h2>
        <التبويبات defaultValue="شهر1">
          <قائمة_التبويبات>
            <زر_تبويب value="شهر1">يونيو 2026</زر_تبويب>
            <زر_تبويب value="شهر2">يوليو 2026</زر_تبويب>
            <زر_تبويب value="شهر3">أغسطس 2026</زر_تبويب>
          </قائمة_التبويبات>
          <محتوى_تبويب value="شهر1">شيكات يونيو…</محتوى_تبويب>
          <محتوى_تبويب value="شهر2">شيكات يوليو…</محتوى_تبويب>
          <محتوى_تبويب value="شهر3">شيكات أغسطس…</محتوى_تبويب>
        </التبويبات>
      </section>

      {/* جدول البيانات */}
      <section className="space-y-3">
        <h2 className="text-lg font-semibold">جدول البيانات (بحث/فرز/ترقيم + بطاقات موبايل)</h2>
        <جدول_بيانات
          الأعمدة={أعمدة}
          البيانات={عملاء}
          مفتاح_الصف={(ص) => ص.id}
          إجراءات_الصف={(ص) => (
            <الزر size="sm" variant="outline" onClick={() => إشعار.نجاح("فتح", ص.الاسم)}>
              عرض
            </الزر>
          )}
        />
      </section>

      {/* حالات إضافية */}
      <section className="grid gap-4 sm:grid-cols-2">
        <البطاقة>
          <رأس_البطاقة>
            <عنوان_البطاقة>حالة التحميل</عنوان_البطاقة>
          </رأس_البطاقة>
          <محتوى_البطاقة className="space-y-2">
            <هيكل_تحميل className="w-1/2" />
            <هيكل_تحميل />
            <هيكل_تحميل className="w-3/4" />
          </محتوى_البطاقة>
        </البطاقة>
        <البطاقة>
          <محتوى_البطاقة className="pt-5">
            <حالة_فارغة
              العنوان="لا توجد فواتير بعد"
              الوصف="ابدأ بإضافة أول فاتورة"
              إجراء={<الزر size="sm">إضافة فاتورة</الزر>}
            />
          </محتوى_البطاقة>
        </البطاقة>
      </section>

      <div className="flex items-center gap-2 pt-6 text-sm text-muted-foreground">
        <TrendingUp className="size-4" />
        تم بناء جميع العناصر — جاهزة لإعادة الاستخدام في كل الوحدات.
      </div>
    </div>
  );
}
