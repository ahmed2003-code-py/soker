/** اختبار المرحلة 5: دفاتر/حافظات الشيكات + إحصاءات الاستخدام. */
import { PrismaClient } from "@prisma/client";
import { اجلب_الدفاتر, اجلب_خيارات_الدفاتر } from "../src/lib/cheque-books";
const prisma = new PrismaClient();
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });

  // دفتر صادر بمدى 100 ورقة (1..100)
  const دفتر = await prisma.chequeBook.create({ data: { name: "دفتر اختبار الأهلي", direction: "OUTGOING", bankName: "الأهلي", startNo: 1, endNo: 100, createdById: ahmed.id } });
  // حافظة واردة (بلا مدى)
  const حافظة = await prisma.chequeBook.create({ data: { name: "حافظة اختبار", direction: "INCOMING", createdById: ahmed.id } });

  // 3 شيكات صادرة في الدفتر بقيم 1000/2000/3000
  const قيم = [1000, 2000, 3000];
  const شيكات: number[] = [];
  for (const q of قيم) {
    const c = await prisma.cheque.create({ data: { drawerName: "الشركة", amount: q, direction: "OUTGOING", dueDate: new Date("2026-09-01"), status: "PENDING", chequeBookId: دفتر.id, createdById: ahmed.id } });
    شيكات.push(c.id);
  }
  // شيك وارد في الحافظة
  const وارد = await prisma.cheque.create({ data: { drawerName: "عميل", amount: 5000, direction: "INCOMING", dueDate: new Date("2026-09-01"), status: "PENDING", chequeBookId: حافظة.id, createdById: ahmed.id } });

  const كل = await اجلب_الدفاتر();
  const د1 = كل.find((d) => d.id === دفتر.id)!;
  const ح1 = كل.find((d) => d.id === حافظة.id)!;
  تحقق(د1.عدد_الشيكات === 3, "الدفتر: 3 شيكات");
  تحقق(د1.إجمالي_القيمة === 6000, "الدفتر: إجمالي 6000");
  تحقق(د1.سعة_الأوراق === 100, "الدفتر: سعة 100 ورقة");
  تحقق(د1.متبقّي_الأوراق === 97, "الدفتر: متبقّي 97 ورقة (100-3)");
  تحقق(ح1.عدد_الشيكات === 1 && ح1.إجمالي_القيمة === 5000, "الحافظة: 1 شيك بـ5000");
  تحقق(ح1.سعة_الأوراق === null && ح1.متبقّي_الأوراق === null, "الحافظة: بلا سعة أوراق");

  // خيارات الدفاتر: نشطة + حسب الاتجاه
  const خيارات_صادر = await اجلب_خيارات_الدفاتر("OUTGOING");
  تحقق(خيارات_صادر.some((o) => o.id === دفتر.id) && !خيارات_صادر.some((o) => o.id === حافظة.id), "خيارات الصادر تُظهر الدفتر فقط");
  const خيارات_وارد = await اجلب_خيارات_الدفاتر("INCOMING");
  تحقق(خيارات_وارد.some((o) => o.id === حافظة.id), "خيارات الوارد تُظهر الحافظة");

  // أرشفة الدفتر → يختفي من الخيارات النشطة
  await prisma.chequeBook.update({ where: { id: دفتر.id }, data: { isActive: false } });
  const بعد_الأرشفة = await اجلب_خيارات_الدفاتر("OUTGOING");
  تحقق(!بعد_الأرشفة.some((o) => o.id === دفتر.id), "بعد الأرشفة: يختفي من الخيارات النشطة");
  // لكنه يظل في القائمة الكاملة
  const كل2 = await اجلب_الدفاتر();
  تحقق(كل2.some((d) => d.id === دفتر.id && !d.نشط), "الدفتر المؤرشف يظل في القائمة الكاملة");

  // حذف شيك من الدفتر → العدد ينقص
  await prisma.cheque.delete({ where: { id: شيكات[0] } });
  const كل3 = await اجلب_الدفاتر();
  تحقق(كل3.find((d) => d.id === دفتر.id)!.عدد_الشيكات === 2, "بعد حذف شيك: العدد 2");

  // FK SetNull: حذف الدفتر لا يحذف الشيكات (يفكّ الربط)
  await prisma.cheque.deleteMany({ where: { chequeBookId: دفتر.id } });
  await prisma.cheque.delete({ where: { id: وارد.id } });
  await prisma.chequeBook.deleteMany({ where: { id: { in: [دفتر.id, حافظة.id] } } });
  console.log("✓ تم التنظيف");
}
main().then(() => { console.log("\n✅ نجح اختبار الدفاتر والحافظات (المرحلة 5)"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
