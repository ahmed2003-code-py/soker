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
import { استخدام_اللغة } from "@/components/providers/i18n-provider";
import { حذف_فاتورة } from "./actions";

type صف = {
  id: number;
  الرقم: number | null;
  المرجع: string | null;
  النوع: "SALE" | "PURCHASE" | "SUPPLIER_RETURN";
  الطرف: string;
  التاريخ: string;
  الإجمالي: number;
  إجمالي_الوزن: number;
};

const رقم_مصفّر = (n: number) => String(n).padStart(7, "0");

function جدول_فواتير({
  البيانات,
  عنوان_الطرف,
  عنوان_الرقم,
  منقوص_الرقم,
}: {
  البيانات: صف[];
  عنوان_الطرف: string;
  عنوان_الرقم: string;
  منقوص_الرقم?: boolean; // عرض externalRef بدل الرقم التسلسلي
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t } = استخدام_اللغة();
  const [حذف, تعيين_حذف] = React.useState<صف | null>(null);

  const أعمدة: عمود<صف>[] = [
    {
      المفتاح: "الرقم",
      العنوان: عنوان_الرقم,
      قابل_للفرز: true,
      قيمة: (ص) => ص.الرقم ?? ص.المرجع ?? "",
      خلية: (ص) =>
        منقوص_الرقم ? (
          <span className="ltr-nums font-medium">{ص.المرجع ?? "—"}</span>
        ) : (
          <span className="ltr-nums font-medium">
            {ص.الرقم ? رقم_مصفّر(ص.الرقم) : "—"}
          </span>
        ),
    },
    { المفتاح: "الطرف", العنوان: عنوان_الطرف, قابل_للفرز: true },
    {
      المفتاح: "التاريخ",
      العنوان: t("inv.col.date"),
      خلية: (ص) => <نص_تاريخ القيمة={ص.التاريخ} />,
      قيمة: (ص) => ص.التاريخ,
      قابل_للفرز: true,
    },
    {
      المفتاح: "إجمالي_الوزن",
      العنوان: t("inv.col.total_weight"),
      محاذاة: "end",
      خلية: (ص) => <span className="ltr-nums">{ص.إجمالي_الوزن} {t("inv.kg")}</span>,
      مخفي_موبايل: true,
    },
    {
      المفتاح: "الإجمالي",
      العنوان: t("inv.col.total"),
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
        نص_البحث={t("inv.search")}
        عند_النقر={(ص) => router.push(`/invoices/${ص.id}`)}
        رسالة_فراغ={t("inv.empty")}
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
          العنوان={
            حذف.النوع === "PURCHASE"
              ? `حذف فاتورة شراء — ${حذف.المرجع ?? "—"}`
              : `حذف فاتورة ${حذف.الرقم ? رقم_مصفّر(حذف.الرقم) : "—"}`
          }
          الوصف={t("inv.delete_desc")}
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

export function قائمة_الفواتير({ البيانات }: { البيانات: صف[] }) {
  const [التاب, تعيين_التاب] = React.useState<"customers" | "purchases">("customers");

  const فواتير_العملاء = البيانات.filter((f) => f.النوع !== "PURCHASE");
  const فواتير_الشراء = البيانات.filter((f) => f.النوع === "PURCHASE");

  return (
    <div>
      {/* تابات */}
      <div className="flex gap-1 border-b mb-4">
        {(
          [
            { مفتاح: "customers", تسمية: "فواتير العملاء والموردين", عدد: فواتير_العملاء.length },
            { مفتاح: "purchases", تسمية: "فواتير الشراء (الجاية)", عدد: فواتير_الشراء.length },
          ] as const
        ).map((تاب) => (
          <button
            key={تاب.مفتاح}
            onClick={() => تعيين_التاب(تاب.مفتاح)}
            className={`px-4 py-2 text-sm font-medium border-b-2 transition-colors ${
              التاب === تاب.مفتاح
                ? "border-primary text-primary"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            {تاب.تسمية}
            <span className="mr-1.5 text-xs text-muted-foreground">({تاب.عدد})</span>
          </button>
        ))}
      </div>

      {التاب === "customers" ? (
        <جدول_فواتير
          البيانات={فواتير_العملاء}
          عنوان_الطرف="العميل / المورد"
          عنوان_الرقم="رقم الفاتورة"
        />
      ) : (
        <جدول_فواتير
          البيانات={فواتير_الشراء}
          عنوان_الطرف="المورد"
          عنوان_الرقم="رقم فاتورة المورد"
          منقوص_الرقم
        />
      )}
    </div>
  );
}
