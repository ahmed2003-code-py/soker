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
import { نص_مبلغ } from "@/components/money-text";
import { useإشعار } from "@/components/ui/toast";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";
import { حذف_فاتورة, اجلب_ارتباطات_الفاتورة, type ملخص_ارتباطات } from "../actions";

function رقم_واتساب(هاتف: string): string {
  const نظيف = هاتف.replace(/\D/g, "");
  if (نظيف.startsWith("20")) return نظيف;
  if (نظيف.startsWith("0")) return "2" + نظيف;
  return "20" + نظيف;
}

export function شريط_إجراءات_الفاتورة({
  المعرف,
  الرقم,
  مرجع_خارجي,
  هاتف_العميل,
  اسم_العميل,
  اسم_الشركة,
  الإجمالي,
  التاريخ,
  رمز_المشاركة,
}: {
  المعرف: number;
  الرقم: number | null;
  مرجع_خارجي?: string | null;
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
  const [ارتباطات, تعيين_ارتباطات] = React.useState<ملخص_ارتباطات | null>(null);
  const [واتساب_مفتوح, تعيين_واتساب_مفتوح] = React.useState(false);

  async function افتح_الحذف() {
    تعيين_ارتباطات(null);
    تعيين_حذف(true);
    try {
      تعيين_ارتباطات(await اجلب_ارتباطات_الفاتورة(المعرف));
    } catch {
      /* نتجاهل — الحوار يبقى بالوصف العام */
    }
  }
  const [رقم_الهاتف, تعيين_رقم_الهاتف] = React.useState("");
  const [نُسخ, تعيين_نُسخ] = React.useState(false);

  function ابن_رابط_المشاركة() {
    if (!رمز_المشاركة) return null;
    const base = `${window.location.origin}/share/${رمز_المشاركة}`;
    const مع_رصيد = new URLSearchParams(window.location.search).get("balance") === "1";
    return مع_رصيد ? `${base}?balance=1` : base;
  }

  async function انسخ_الرابط() {
    const رابط = ابن_رابط_المشاركة();
    if (!رابط) return;
    await navigator.clipboard.writeText(رابط);
    تعيين_نُسخ(true);
    setTimeout(() => تعيين_نُسخ(false), 2000);
  }

  function ابن_رسالة_واتساب(رقم: string) {
    const رقم_الفاتورة = الرقم ? String(الرقم).padStart(7, "0") : (مرجع_خارجي ?? "—");
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
      رمز_المشاركة ? `رابط الفاتورة:\n${ابن_رابط_المشاركة() ?? ""}` : "",
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
        {رمز_المشاركة && (
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
        <الزر variant="danger" onClick={افتح_الحذف}>
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
        العنوان={t("inv.delete_title", { number: الرقم ? String(الرقم).padStart(7, "0") : (مرجع_خارجي ?? "—") })}
        الوصف={t("inv.delete_desc")}
        تفاصيل={
          ارتباطات && (ارتباطات.عدد_القيود > 0 || ارتباطات.عدد_حركات_الخزنة > 0) ? (
            <div className="rounded-lg border border-warning/40 bg-warning-soft/40 p-3 text-sm space-y-1.5">
              <p className="font-medium text-warning">سيتم عكس الارتباطات التالية تلقائياً:</p>
              <ul className="space-y-1 text-foreground">
                {ارتباطات.عدد_القيود > 0 && (
                  <li className="flex items-center justify-between gap-2">
                    <span>قيود على حساب {ارتباطات.الطرف ?? "الطرف"} ({ارتباطات.عدد_القيود})</span>
                    <نص_مبلغ القيمة={ارتباطات.إجمالي_القيود} />
                  </li>
                )}
                {ارتباطات.عدد_حركات_الخزنة > 0 && (
                  <li className="flex items-center justify-between gap-2">
                    <span>حركات في الخزنة ({ارتباطات.عدد_حركات_الخزنة})</span>
                    <نص_مبلغ القيمة={ارتباطات.إجمالي_حركات_الخزنة} />
                  </li>
                )}
              </ul>
              <p className="text-xs text-muted-foreground pt-1">
                ستُعاد الأرصدة تلقائياً بعد الحذف — لن يبقى أي اختلاف محاسبي.
              </p>
            </div>
          ) : undefined
        }
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
