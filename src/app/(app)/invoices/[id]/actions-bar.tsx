"use client";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Printer, Pencil, Trash2, ArrowRight, MessageCircle, Link2 } from "lucide-react";
import * as React from "react";
import { الزر } from "@/components/ui/button";
import { الحقل } from "@/components/ui/input";
import { العنوان } from "@/components/ui/label";
import { الحوار, محتوى_الحوار, رأس_الحوار, عنوان_الحوار, تذييل_الحوار } from "@/components/ui/dialog";
import { حوار_تأكيد } from "@/components/confirm-dialog";
import { سجل_التغييرات } from "@/components/record-history";
import { useإشعار } from "@/components/ui/toast";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";
import { حذف_فاتورة } from "../actions";

function رقم_واتساب(هاتف: string): string {
  const نظيف = هاتف.replace(/\D/g, "");
  if (نظيف.startsWith("20")) return نظيف;
  if (نظيف.startsWith("0")) return "2" + نظيف;
  return "20" + نظيف;
}

export function شريط_إجراءات_الفاتورة({
  المعرف,
  الرقم,
  هاتف_العميل,
  اسم_العميل,
  اسم_الشركة,
  الإجمالي,
  التاريخ,
  رمز_المشاركة,
}: {
  المعرف: number;
  الرقم: number;
  هاتف_العميل?: string | null;
  اسم_العميل?: string;
  اسم_الشركة?: string;
  الإجمالي?: number;
  التاريخ?: string;
  رمز_المشاركة?: string | null;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const { t } = استخدام_اللغة();
  const [حذف, تعيين_حذف] = React.useState(false);
  const [واتساب_مفتوح, تعيين_واتساب_مفتوح] = React.useState(false);
  const [رقم_الهاتف, تعيين_رقم_الهاتف] = React.useState("");
  const [نُسخ, تعيين_نُسخ] = React.useState(false);

  const رابط_المشاركة = رمز_المشاركة
    ? `${typeof window !== "undefined" ? window.location.origin : ""}/share/${رمز_المشاركة}`
    : null;

  async function انسخ_الرابط() {
    if (!رابط_المشاركة) return;
    await navigator.clipboard.writeText(رابط_المشاركة);
    تعيين_نُسخ(true);
    setTimeout(() => تعيين_نُسخ(false), 2000);
  }

  function ابن_رسالة_واتساب(رقم: string) {
    const رقم_الفاتورة = String(الرقم).padStart(7, "0");
    const مبلغ = الإجمالي != null
      ? الإجمالي.toLocaleString("en-US", { minimumFractionDigits: 2 }) + " ج.م"
      : "";
    const رسالة = [
      `${اسم_الشركة ?? "مؤسسة سكر للتجارة"}`,
      `─────────────────`,
      `فاتورة رقم: ${رقم_الفاتورة}`,
      التاريخ ? `التاريخ: ${التاريخ}` : "",
      اسم_العميل ? `العميل: ${اسم_العميل}` : "",
      `─────────────────`,
      مبلغ ? `الإجمالي: ${مبلغ}` : "",
      `─────────────────`,
      رابط_المشاركة ? `رابط الفاتورة:\n${رابط_المشاركة}` : "",
      `─────────────────`,
      `شكراً لتعاملكم معنا`,
    ].filter(Boolean).join("\n");
    return `https://wa.me/${رقم_واتساب(رقم)}?text=${encodeURIComponent(رسالة)}`;
  }

  return (
    <div className="no-print mb-4 flex flex-wrap items-center justify-between gap-2">
      <الزر variant="outline" size="sm" onClick={() => router.push("/invoices")}>
        <ArrowRight className="size-4" /> {t("inv.back")}
      </الزر>
      <div className="flex flex-wrap gap-2">
        <سجل_التغييرات النوع="الفاتورة" المعرف={المعرف} />
        {رابط_المشاركة && (
          <الزر variant="outline" onClick={انسخ_الرابط}>
            <Link2 className="size-4" />
            {نُسخ ? "✓ تم النسخ" : "نسخ الرابط"}
          </الزر>
        )}
        <الزر
          variant="outline"
          onClick={() => {
            تعيين_رقم_الهاتف(هاتف_العميل ?? "");
            تعيين_واتساب_مفتوح(true);
          }}
        >
          <MessageCircle className="size-4 text-green-600" />
          واتساب
        </الزر>
        <الزر variant="blue" onClick={() => window.print()}>
          <Printer className="size-4" /> {t("inv.print")}
        </الزر>
        <الزر variant="outline" asChild>
          <Link href={`/invoices/${المعرف}/edit`}>
            <Pencil className="size-4" /> {t("common.edit")}
          </Link>
        </الزر>
        <الزر variant="danger" onClick={() => تعيين_حذف(true)}>
          <Trash2 className="size-4" /> {t("common.delete")}
        </الزر>
      </div>

      {/* حوار إرسال واتساب */}
      <الحوار open={واتساب_مفتوح} onOpenChange={(o) => !o && تعيين_واتساب_مفتوح(false)}>
        <محتوى_الحوار>
          <رأس_الحوار>
            <عنوان_الحوار>إرسال عبر واتساب</عنوان_الحوار>
          </رأس_الحوار>
          <div className="space-y-1.5">
            <العنوان>رقم الهاتف</العنوان>
            <الحقل
              autoFocus
              type="tel"
              className="ltr-nums"
              placeholder="01xxxxxxxxx"
              value={رقم_الهاتف}
              onChange={(e) => تعيين_رقم_الهاتف(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter" && رقم_الهاتف.trim()) {
                  window.open(ابن_رسالة_واتساب(رقم_الهاتف.trim()), "_blank");
                  تعيين_واتساب_مفتوح(false);
                }
              }}
            />
          </div>
          <تذييل_الحوار>
            <الزر
              variant="success"
              disabled={!رقم_الهاتف.trim()}
              onClick={() => {
                window.open(ابن_رسالة_واتساب(رقم_الهاتف.trim()), "_blank");
                تعيين_واتساب_مفتوح(false);
              }}
            >
              <MessageCircle className="size-4" /> إرسال
            </الزر>
            <الزر variant="outline" onClick={() => تعيين_واتساب_مفتوح(false)}>إلغاء</الزر>
          </تذييل_الحوار>
        </محتوى_الحوار>
      </الحوار>

      <حوار_تأكيد
        مفتوح={حذف}
        عند_التغيير={تعيين_حذف}
        العنوان={t("inv.delete_title", { number: String(الرقم).padStart(7, "0") })}
        الوصف={t("inv.delete_desc")}
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
