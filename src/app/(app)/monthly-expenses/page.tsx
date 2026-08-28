import { redirect } from "next/navigation";
import { المستخدم_الحالي } from "@/lib/session";
import { ترويسة_الصفحة } from "@/components/page-header";
import { اجلب_بنود_الشهر, حلّل_الشهر, تسمية_الشهر, الشهر_السابق, الشهر_التالي, شهر_اليوم } from "@/lib/monthly-expenses";
import { قائمة_المصروفات_الشهرية } from "./client";

export const metadata = { title: "المصروفات الشهرية — سُكر" };
export const dynamic = "force-dynamic";

export default async function صفحة_المصروفات_الشهرية({
  searchParams,
}: {
  searchParams: { y?: string; m?: string };
}) {
  const م = await المستخدم_الحالي();
  if (!م) redirect("/login");

  const الشهر = حلّل_الشهر(searchParams.y, searchParams.m);
  const بنود = await اجلب_بنود_الشهر(الشهر, م.id);
  const اليوم = شهر_اليوم();

  return (
    <div>
      <ترويسة_الصفحة
        العنوان="المصروفات الشهرية"
        الوصف="بنود ثابتة كل شهر — مقرر ومدفوع ومتبقٍّ، والفرق يترحّل تلقائياً للشهر اللي بعده"
      />
      <قائمة_المصروفات_الشهرية
        الشهر={الشهر}
        تسمية={تسمية_الشهر(الشهر)}
        السابق={الشهر_السابق(الشهر)}
        التالي={الشهر_التالي(الشهر)}
        هو_الشهر_الحالي={الشهر.سنة === اليوم.سنة && الشهر.شهر === اليوم.شهر}
        البنود={بنود}
      />
    </div>
  );
}
