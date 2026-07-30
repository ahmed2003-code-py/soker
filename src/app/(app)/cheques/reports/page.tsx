import Link from "next/link";
import { ArrowRight } from "lucide-react";
import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { الزر } from "@/components/ui/button";
import { شاشة_تقارير_الشيكات } from "./client";

export const metadata = { title: "تقارير الشيكات — سُكر" };
export const dynamic = "force-dynamic";

export default async function صفحة_تقارير_الشيكات() {
  const شيكات = await prisma.cheque.findMany({
    orderBy: { dueDate: "asc" },
    select: {
      id: true, chequeNumber: true, bankName: true, drawerName: true, beneficiary: true,
      amount: true, direction: true, status: true, dueDate: true,
      party: { select: { id: true, name: true } },
    },
  });

  const صفوف = شيكات.map((ش) => ({
    id: ش.id,
    رقم_الشيك: ش.chequeNumber,
    اسم_البنك: ش.bankName,
    الطرف: ش.party?.name ?? (ش.direction === "OUTGOING" ? ش.beneficiary || ش.drawerName : ش.drawerName),
    معرف_الطرف: ش.party?.id ?? null,
    الاتجاه: ش.direction,
    الحالة: ش.status,
    تاريخ_الاستحقاق: ش.dueDate.toISOString(),
    المبلغ: Number(ش.amount),
  }));

  return (
    <div>
      <ترويسة_الصفحة
        العنوان="تقارير الشيكات"
        الوصف="تقارير شاملة: حسب الحالة والبنك والطرف + أعمار الشيكات المستحقة، مع تصدير إكسل"
        إجراء={
          <الزر variant="outline" asChild>
            <Link href="/cheques"><ArrowRight className="size-4" /> رجوع للشيكات</Link>
          </الزر>
        }
      />
      <شاشة_تقارير_الشيكات الصفوف={صفوف} />
    </div>
  );
}
