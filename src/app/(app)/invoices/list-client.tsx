"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Eye, Pencil, Trash2 } from "lucide-react";
import { الزر } from "@/components/ui/button";
import { جدول_بيانات, type عمود } from "@/components/data-table";
import { نص_مبلغ } from "@/components/money-text";
import { نص_تاريخ } from "@/components/date-text";
import { حوار_تأكيد } from "@/components/confirm-dialog";
import { سجل_التغييرات } from "@/components/record-history";
import { useإشعار } from "@/components/ui/toast";
import { حذف_فاتورة } from "./actions";

type صف = {
  id: number;
  الرقم: number;
  العميل: string;
  التاريخ: string;
  الإجمالي: number;
  إجمالي_الوزن: number;
};

const رقم_مصفّر = (n: number) => String(n).padStart(7, "0");

export function قائمة_الفواتير({ البيانات }: { البيانات: صف[] }) {
  const router = useRouter();
  const إشعار = useإشعار();
  const [حذف, تعيين_حذف] = React.useState<صف | null>(null);

  const أعمدة: عمود<صف>[] = [
    {
      المفتاح: "الرقم",
      العنوان: "رقم الفاتورة",
      قابل_للفرز: true,
      قيمة: (ص) => ص.الرقم,
      خلية: (ص) => <span className="ltr-nums font-medium">{رقم_مصفّر(ص.الرقم)}</span>,
    },
    { المفتاح: "العميل", العنوان: "العميل", قابل_للفرز: true },
    {
      المفتاح: "التاريخ",
      العنوان: "التاريخ",
      خلية: (ص) => <نص_تاريخ القيمة={ص.التاريخ} />,
      قيمة: (ص) => ص.التاريخ,
      قابل_للفرز: true,
    },
    {
      المفتاح: "إجمالي_الوزن",
      العنوان: "إجمالي الوزن",
      محاذاة: "end",
      خلية: (ص) => <span className="ltr-nums">{ص.إجمالي_الوزن} كجم</span>,
      مخفي_موبايل: true,
    },
    {
      المفتاح: "الإجمالي",
      العنوان: "الإجمالي",
      محاذاة: "end",
      قابل_للفرز: true,
      قيمة: (ص) => ص.الإجمالي,
      خلية: (ص) => <نص_مبلغ القيمة={ص.الإجمالي} />,
    },
  ];

  return (
    <>
      <جدول_بيانات
        الأعمدة={أعمدة}
        البيانات={البيانات}
        مفتاح_الصف={(ص) => ص.id}
        نص_البحث="ابحث برقم الفاتورة أو العميل…"
        عند_النقر={(ص) => router.push(`/invoices/${ص.id}`)}
        رسالة_فراغ="لا توجد فواتير بعد"
        إجراءات_الصف={(ص) => (
          <div className="flex justify-end gap-1">
            <الزر size="sm" variant="ghost" onClick={() => router.push(`/invoices/${ص.id}`)}>
              <Eye className="size-4" />
            </الزر>
            <الزر size="sm" variant="ghost" onClick={() => router.push(`/invoices/${ص.id}/edit`)}>
              <Pencil className="size-4" />
            </الزر>
            <سجل_التغييرات النوع="الفاتورة" المعرف={ص.id} تسمية="" />
            <الزر size="sm" variant="ghost" onClick={() => تعيين_حذف(ص)}>
              <Trash2 className="size-4 text-danger" />
            </الزر>
          </div>
        )}
      />
      {حذف && (
        <حوار_تأكيد
          مفتوح
          عند_التغيير={(o) => !o && تعيين_حذف(null)}
          العنوان={`حذف الفاتورة ${رقم_مصفّر(حذف.الرقم)}`}
          الوصف="سيتم عكس قيد العميل المرتبط بهذه الفاتورة."
          عند_التأكيد={async () => {
            const r = await حذف_فاتورة(حذف.id);
            r.نجاح ? إشعار.نجاح(r.رسالة!) : إشعار.خطأ(r.رسالة);
            if (r.نجاح) router.refresh();
          }}
        />
      )}
    </>
  );
}
