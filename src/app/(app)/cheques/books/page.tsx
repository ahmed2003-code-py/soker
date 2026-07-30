import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { ترويسة_الصفحة } from "@/components/page-header";
import { الزر } from "@/components/ui/button";
import { اجلب_الدفاتر } from "@/lib/cheque-books";
import { شاشة_الدفاتر } from "./client";

export const metadata = { title: "دفاتر وحافظات الشيكات — سُكر" };
export const dynamic = "force-dynamic";

export default async function صفحة_الدفاتر() {
  const دفاتر = await اجلب_الدفاتر();
  return (
    <div>
      <ترويسة_الصفحة
        العنوان="دفاتر وحافظات الشيكات"
        الوصف="دفاتر الشيكات الصادرة (بنك + مدى أرقام) وحافظات الشيكات الواردة"
        إجراء={
          <الزر variant="outline" asChild>
            <Link href="/cheques"><ArrowRight className="size-4" /> رجوع للشيكات</Link>
          </الزر>
        }
      />
      <شاشة_الدفاتر الدفاتر={دفاتر} />
    </div>
  );
}
