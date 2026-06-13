import { prisma } from "@/lib/prisma";
import { اليوم, مفتاح_الشهر, اسم_الشهر } from "@/lib/date";

/** هل الشيك متأخر؟ (تاريخ الاستحقاق < اليوم والحالة منتظر) */
export function متأخر(تاريخ_الاستحقاق: Date, الحالة: string): boolean {
  return الحالة === "PENDING" && تاريخ_الاستحقاق < اليوم();
}

/** حسابات التنبيهات للوحة التحكم */
export async function تنبيهات_الشيكات() {
  const الآن = اليوم();
  const بعد7 = new Date(الآن);
  بعد7.setDate(بعد7.getDate() + 7);
  const نهاية_الشهر = new Date(الآن.getFullYear(), الآن.getMonth() + 1, 0, 23, 59, 59);

  const منتظرة = await prisma.cheque.findMany({
    where: { status: "PENDING" },
    orderBy: { dueDate: "asc" },
  });

  const مستحقة_خلال_7 = منتظرة.filter((c) => c.dueDate >= الآن && c.dueDate <= بعد7);
  const مستحقة_هذا_الشهر = منتظرة.filter((c) => c.dueDate >= الآن && c.dueDate <= نهاية_الشهر);
  const متأخرة = منتظرة.filter((c) => c.dueDate < الآن);
  const إجمالي_المستحق = منتظرة.reduce((س, c) => س + Number(c.amount), 0);

  return {
    عدد_خلال_7: مستحقة_خلال_7.length,
    عدد_هذا_الشهر: مستحقة_هذا_الشهر.length,
    عدد_متأخر: متأخرة.length,
    إجمالي_المستحق,
    قائمة_متأخرة: متأخرة.map((c) => ({
      id: c.id,
      اسم_المدين: c.drawerName,
      المبلغ: Number(c.amount),
      تاريخ_الاستحقاق: c.dueDate.toISOString(),
    })),
  };
}

/** تجميع شهري لقائمة شيكات (مفتاح الشهر + اسمه + عدد + إجمالي) */
export function جمّع_الشيكات_شهرياً(
  شيكات: { تاريخ_الاستحقاق: string; المبلغ: number }[]
) {
  const م = new Map<string, { الاسم: string; عدد: number; إجمالي: number }>();
  for (const ش of شيكات) {
    const مفتاح = مفتاح_الشهر(ش.تاريخ_الاستحقاق);
    const ح = م.get(مفتاح) ?? { الاسم: اسم_الشهر(ش.تاريخ_الاستحقاق), عدد: 0, إجمالي: 0 };
    ح.عدد += 1;
    ح.إجمالي += ش.المبلغ;
    م.set(مفتاح, ح);
  }
  return [...م.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([مفتاح, ح]) => ({ مفتاح, ...ح }));
}
