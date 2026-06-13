"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Printer, Pencil, Trash2, ArrowRight } from "lucide-react";
import * as React from "react";
import { الزر } from "@/components/ui/button";
import { حوار_تأكيد } from "@/components/confirm-dialog";
import { سجل_التغييرات } from "@/components/record-history";
import { useإشعار } from "@/components/ui/toast";
import { حذف_فاتورة } from "../actions";

export function شريط_إجراءات_الفاتورة({
  المعرف,
  الرقم,
}: {
  المعرف: number;
  الرقم: number;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const [حذف, تعيين_حذف] = React.useState(false);
  return (
    <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
      <الزر variant="outline" size="sm" onClick={() => router.push("/invoices")}>
        <ArrowRight className="size-4" /> رجوع
      </الزر>
      <div className="flex flex-wrap gap-2">
        <سجل_التغييرات النوع="الفاتورة" المعرف={المعرف} />
        <الزر variant="blue" onClick={() => window.print()}>
          <Printer className="size-4" /> طباعة / PDF
        </الزر>
        <الزر variant="outline" asChild>
          <Link href={`/invoices/${المعرف}/edit`}>
            <Pencil className="size-4" /> تعديل
          </Link>
        </الزر>
        <الزر variant="danger" onClick={() => تعيين_حذف(true)}>
          <Trash2 className="size-4" /> حذف
        </الزر>
      </div>
      <حوار_تأكيد
        مفتوح={حذف}
        عند_التغيير={تعيين_حذف}
        العنوان={`حذف الفاتورة ${String(الرقم).padStart(7, "0")}`}
        الوصف="سيتم عكس قيد العميل المرتبط."
        عند_التأكيد={async () => {
          const r = await حذف_فاتورة(المعرف);
          if (!r.نجاح) return إشعار.خطأ(r.رسالة);
          إشعار.نجاح(r.رسالة!);
          router.push("/invoices");
          router.refresh();
        }}
      />
    </div>
  );
}
