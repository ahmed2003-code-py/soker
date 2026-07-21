"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { UserCheck } from "lucide-react";
import { الزر } from "@/components/ui/button";
import { الحقل, منطقة_نص } from "@/components/ui/input";
import { العنوان } from "@/components/ui/label";
import {
  الحوار,
  محتوى_الحوار,
  رأس_الحوار,
  عنوان_الحوار,
  تذييل_الحوار,
} from "@/components/ui/dialog";
import { useإشعار } from "@/components/ui/toast";
import { حوّل_مؤقت_لدائم } from "./actions";

/** زر + حوار تحويل الحساب المؤقت إلى عميل دائم (يحفظ كل الفواتير والحركات والرصيد). */
export function زر_تحويل_مؤقت({
  المعرف,
  الاسم_الحالي,
  الهاتف_الحالي,
  العنوان_الحالي,
  ملاحظات_حالية,
}: {
  المعرف: number;
  الاسم_الحالي: string;
  الهاتف_الحالي: string | null;
  العنوان_الحالي: string | null;
  ملاحظات_حالية: string | null;
}) {
  const router = useRouter();
  const إشعار = useإشعار();
  const [مفتوح, تعيين_مفتوح] = React.useState(false);
  const [اسم, تعيين_اسم] = React.useState(الاسم_الحالي);
  const [هاتف, تعيين_هاتف] = React.useState(الهاتف_الحالي ?? "");
  const [عنوان, تعيين_عنوان] = React.useState(العنوان_الحالي ?? "");
  const [ملاحظات, تعيين_ملاحظات] = React.useState(ملاحظات_حالية ?? "");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  async function حفظ() {
    if (اسم.trim().length < 2) return إشعار.خطأ("الاسم مطلوب");
    تعيين_جارٍ(true);
    const r = await حوّل_مؤقت_لدائم(المعرف, {
      النوع: "CUSTOMER",
      الاسم: اسم.trim(),
      الهاتف: هاتف.trim() || null,
      العنوان: عنوان.trim() || null,
      ملاحظات: ملاحظات.trim() || null,
    });
    تعيين_جارٍ(false);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    إشعار.نجاح(r.رسالة!);
    تعيين_مفتوح(false);
    router.refresh();
  }

  return (
    <>
      <الزر size="sm" variant="outline" onClick={() => تعيين_مفتوح(true)}>
        <UserCheck className="size-4" /> تحويل لعميل دائم
      </الزر>
      {مفتوح && (
        <الحوار open onOpenChange={(o) => !o && تعيين_مفتوح(false)}>
          <محتوى_الحوار className="max-w-md">
            <رأس_الحوار>
              <عنوان_الحوار className="flex items-center gap-2">
                <UserCheck className="size-5 text-primary" /> تحويل لعميل دائم
              </عنوان_الحوار>
            </رأس_الحوار>
            <p className="rounded-lg bg-appgray px-3 py-2 text-[12px] text-muted-foreground mb-1">
              كل الفواتير والحركات والرصيد تنتقل كما هي — يتحوّل الحساب المؤقت إلى عميل دائم دون فقدان أي بيانات.
            </p>
            <div className="space-y-3">
              <div className="space-y-1.5">
                <العنوان مطلوب>الاسم</العنوان>
                <الحقل autoFocus value={اسم} onChange={(e) => تعيين_اسم(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <العنوان>الهاتف</العنوان>
                <الحقل className="ltr-nums" value={هاتف} onChange={(e) => تعيين_هاتف(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <العنوان>العنوان</العنوان>
                <الحقل value={عنوان} onChange={(e) => تعيين_عنوان(e.target.value)} />
              </div>
              <div className="space-y-1.5">
                <العنوان>ملاحظات</العنوان>
                <منطقة_نص value={ملاحظات} onChange={(e) => تعيين_ملاحظات(e.target.value)} />
              </div>
            </div>
            <تذييل_الحوار>
              <الزر variant="success" onClick={حفظ} disabled={جارٍ}>
                {جارٍ ? "جارٍ التحويل…" : "تأكيد التحويل"}
              </الزر>
              <الزر variant="outline" onClick={() => تعيين_مفتوح(false)}>إلغاء</الزر>
            </تذييل_الحوار>
          </محتوى_الحوار>
        </الحوار>
      )}
    </>
  );
}
