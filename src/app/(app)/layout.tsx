import { redirect } from "next/navigation";
import { المستخدم_الحالي } from "@/lib/session";
import { هيكل_التطبيق } from "@/components/shell/app-shell";
import { انتقال_الصفحة } from "@/components/motion/page-transition";
import { المخزن_مفعّل } from "@/lib/flags";

export default async function تخطيط_التطبيق({
  children,
}: {
  children: React.ReactNode;
}) {
  const م = await المستخدم_الحالي();
  if (!م) redirect("/login");
  if (م.mustChangePassword) redirect("/change-password");
  const مخزن = await المخزن_مفعّل();

  return (
    <هيكل_التطبيق المستخدم={{ name: م.name, role: م.role }} مخزن_مفعّل={مخزن}>
      <انتقال_الصفحة>{children}</انتقال_الصفحة>
    </هيكل_التطبيق>
  );
}
