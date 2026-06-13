"use client";
import * as React from "react";
import { signOut } from "next-auth/react";
import { الزر } from "@/components/ui/button";
import { الحقل } from "@/components/ui/input";
import { العنوان } from "@/components/ui/label";
import { useإشعار } from "@/components/ui/toast";
import { تغيير_كلمتي } from "@/app/(app)/users/actions";

export function نموذج_تغيير_كلمة() {
  const إشعار = useإشعار();
  const [الحالية, تعيين_الحالية] = React.useState("");
  const [الجديدة, تعيين_الجديدة] = React.useState("");
  const [التأكيد, تعيين_التأكيد] = React.useState("");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  async function إرسال(e: React.FormEvent) {
    e.preventDefault();
    تعيين_جارٍ(true);
    const res = await تغيير_كلمتي({ الحالية, الجديدة, التأكيد });
    تعيين_جارٍ(false);
    if (!res.نجاح) {
      إشعار.خطأ(res.رسالة);
      return;
    }
    إشعار.نجاح("تم تغيير كلمة المرور", "سيُعاد توجيهك لتسجيل الدخول");
    setTimeout(() => signOut({ callbackUrl: "/login" }), 900);
  }

  return (
    <form onSubmit={إرسال} className="space-y-4">
      <div className="space-y-1.5">
        <العنوان مطلوب>كلمة المرور الحالية</العنوان>
        <الحقل
          type="password"
          autoFocus
          value={الحالية}
          onChange={(e) => تعيين_الحالية(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <العنوان مطلوب>كلمة المرور الجديدة</العنوان>
        <الحقل
          type="password"
          value={الجديدة}
          onChange={(e) => تعيين_الجديدة(e.target.value)}
        />
      </div>
      <div className="space-y-1.5">
        <العنوان مطلوب>تأكيد كلمة المرور</العنوان>
        <الحقل
          type="password"
          value={التأكيد}
          onChange={(e) => تعيين_التأكيد(e.target.value)}
        />
      </div>
      <الزر type="submit" className="w-full" disabled={جارٍ}>
        {جارٍ ? "جارٍ الحفظ…" : "تغيير كلمة المرور"}
      </الزر>
    </form>
  );
}
