import { redirect } from "next/navigation";
import { المستخدم_الحالي } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { تسمية_حساب_الخزنة } from "@/lib/enums";
import { شاشة_الإعدادات } from "./client";

export const metadata = { title: "الإعدادات — سُكر" };
export const dynamic = "force-dynamic";

export default async function صفحة_الإعدادات() {
  const م = await المستخدم_الحالي();
  if (!م) redirect("/login");
  if (م.role !== "ADMIN") redirect("/");

  const [إعدادات, حسابات] = await Promise.all([
    prisma.setting.findMany(),
    prisma.treasuryAccount.findMany({ orderBy: { id: "asc" } }),
  ]);

  const قاموس: Record<string, string> = {};
  for (const e of إعدادات) قاموس[e.key] = e.value;

  let طرق_الدفع: string[] = ["نقدي", "إنستا باي", "بنك", "فودافون كاش"];
  try {
    if (قاموس["طرق_الدفع"]) طرق_الدفع = JSON.parse(قاموس["طرق_الدفع"]);
  } catch {}

  return (
    <div>
      <ترويسة_الصفحة
        العنوان="الإعدادات"
        الوصف="بيانات الشركة، الشعار، حدود الخزنة، حد الائتمان الافتراضي، وطرق الدفع"
      />
      <شاشة_الإعدادات
        القيم={{
          اسم_الشركة: قاموس["اسم_الشركة"] ?? "",
          شعار_الشركة: قاموس["شعار_الشركة"] ?? "",
          حد_الائتمان_الافتراضي: قاموس["حد_الائتمان_الافتراضي"] ?? "0",
          طرق_الدفع,
        }}
        الحسابات={حسابات.map((h) => ({
          id: h.id,
          التسمية: تسمية_حساب_الخزنة[h.type],
          الحد_الأدنى: h.minThreshold != null ? String(h.minThreshold) : "0",
        }))}
      />
    </div>
  );
}
