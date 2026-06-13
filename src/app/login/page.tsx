import { redirect } from "next/navigation";
import { المستخدم_الحالي } from "@/lib/session";
import { نموذج_الدخول } from "./form";

export const metadata = { title: "تسجيل الدخول — سُكر" };

export default async function صفحة_الدخول() {
  const م = await المستخدم_الحالي();
  if (م) redirect("/");
  return (
    <div className="flex min-h-screen items-center justify-center bg-appgray p-4">
      <div className="w-full max-w-md">
        <div className="mb-6 text-center">
          <h1 className="text-3xl font-bold text-primary">سُكر</h1>
          <p className="mt-1 text-sm text-muted-foreground">نظام إدارة الأعمال</p>
        </div>
        <div className="card-soft p-6">
          <نموذج_الدخول />
        </div>
        <p className="mt-4 text-center text-xs text-muted-foreground">
          للمالكَين: <span className="ltr-nums">ahmed</span> /{" "}
          <span className="ltr-nums">mahmoud</span>
        </p>
      </div>
    </div>
  );
}
