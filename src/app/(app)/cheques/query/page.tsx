import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { شاشة_استعلام_الشيكات } from "./client";

export const metadata = { title: "استعلام الشيكات — سُكر" };

export default async function صفحة_استعلام_الشيكات() {
  const شيكات = await prisma.cheque.findMany({
    orderBy: { dueDate: "asc" },
    select: {
      id: true,
      chequeNumber: true,
      bankName: true,
      drawerName: true,
      beneficiary: true,
      direction: true,
      status: true,
      dueDate: true,
      amount: true,
    },
  });

  const بيانات = شيكات.map((c) => ({
    id: c.id,
    رقم_الشيك: c.chequeNumber,
    اسم_البنك: c.bankName,
    المدين: c.drawerName,
    المستفيد: c.beneficiary,
    الاتجاه: c.direction,
    الحالة: c.status,
    تاريخ_الاستحقاق: c.dueDate.toISOString(),
    المبلغ: Number(c.amount),
  }));

  return (
    <div>
      <ترويسة_الصفحة
        العنوان="استعلام الشيكات"
        الوصف="ابحث وفلتر الشيكات بالتاريخ والحالة والاتجاه، مع ملخص سريع للمستحقات."
      />
      <شاشة_استعلام_الشيكات البيانات={بيانات} />
    </div>
  );
}
