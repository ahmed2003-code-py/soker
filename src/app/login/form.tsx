"use client";
import * as React from "react";
import { signIn } from "next-auth/react";
import { useRouter } from "next/navigation";
import { الزر } from "@/components/ui/button";
import { الحقل } from "@/components/ui/input";
import { العنوان } from "@/components/ui/label";

export function نموذج_الدخول() {
  const router = useRouter();
  const [اسم, تعيين_اسم] = React.useState("");
  const [كلمة, تعيين_كلمة] = React.useState("");
  const [خطأ, تعيين_خطأ] = React.useState<string | null>(null);
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  async function إرسال(e: React.FormEvent) {
    e.preventDefault();
    تعيين_خطأ(null);
    تعيين_جارٍ(true);
    const res = await signIn("credentials", {
      username: اسم,
      password: كلمة,
      redirect: false,
    });
    تعيين_جارٍ(false);
    if (res?.error) {
      تعيين_خطأ("اسم المستخدم أو كلمة المرور غير صحيحة");
      return;
    }
    router.push("/");
    router.refresh();
  }

  return (
    <form onSubmit={إرسال} className="space-y-4">
      <h2 className="text-lg font-semibold">تسجيل الدخول</h2>
      <div className="space-y-1.5">
        <العنوان مطلوب htmlFor="username">اسم المستخدم</العنوان>
        <الحقل
          id="username"
          autoFocus
          value={اسم}
          onChange={(e) => تعيين_اسم(e.target.value)}
          placeholder="ahmed"
          className="ltr-nums"
          autoComplete="username"
        />
      </div>
      <div className="space-y-1.5">
        <العنوان مطلوب htmlFor="password">كلمة المرور</العنوان>
        <الحقل
          id="password"
          type="password"
          value={كلمة}
          onChange={(e) => تعيين_كلمة(e.target.value)}
          placeholder="••••••••"
          autoComplete="current-password"
        />
      </div>
      {خطأ && (
        <p className="rounded-lg bg-danger-soft px-3 py-2 text-sm text-danger">{خطأ}</p>
      )}
      <الزر type="submit" className="w-full" disabled={جارٍ}>
        {جارٍ ? "جارٍ الدخول…" : "دخول"}
      </الزر>
    </form>
  );
}
