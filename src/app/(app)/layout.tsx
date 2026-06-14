import { redirect } from "next/navigation";
import { المستخدم_الحالي } from "@/lib/session";
import { هيكل_التطبيق } from "@/components/shell/app-shell";
import { انتقال_الصفحة } from "@/components/motion/page-transition";

export default async function تخطيط_التطبيق({
  children,
}: {
  children: React.ReactNode;
}) {
  const م = await المستخدم_الحالي();
  if (!م) redirect("/login");
  if (م.mustChangePassword) redirect("/change-password");

  return (
    <هيكل_التطبيق المستخدم={{ name: م.name, role: م.role }}>
      <انتقال_الصفحة>{children}</انتقال_الصفحة>
    </هيكل_التطبيق>
  );
}
