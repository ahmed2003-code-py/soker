/** اختبار المرحلة 4: توزيع شيك وارد على فواتير العميل (تتبّع فقط، بلا قيود). */
import { PrismaClient } from "@prisma/client";
import { اجلب_توزيع_شيك, مدفوع_فاتورة_بشيكات, مدفوع_فواتير_بشيكات } from "../src/lib/cheque-allocation";
const prisma = new PrismaClient();
const N = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const عميل = await prisma.party.create({ data: { name: "عميل توزيع اختبار", type: "CUSTOMER", createdById: ahmed.id } });
  const عميل2 = await prisma.party.create({ data: { name: "عميل آخر اختبار", type: "CUSTOMER", createdById: ahmed.id } });
  const ف1 = await prisma.invoice.create({ data: { customerId: عميل.id, date: new Date("2026-07-01"), totalAmount: 6000, invoiceType: "SALE", createdById: ahmed.id } });
  const ف2 = await prisma.invoice.create({ data: { customerId: عميل.id, date: new Date("2026-07-10"), totalAmount: 4000, invoiceType: "SALE", createdById: ahmed.id } });
  // شيك وارد 10000 مربوط بالعميل
  const ش = await prisma.cheque.create({ data: { drawerName: "عميل", amount: 10000, direction: "INCOMING", dueDate: new Date("2026-09-01"), status: "PENDING", partyId: عميل.id, createdById: ahmed.id } });

  // توزيع: 6000 على ف1 + 3000 على ف2 = 9000 (يتبقّى 1000 غير موزَّع)
  await prisma.chequeInvoiceAllocation.createMany({ data: [
    { chequeId: ش.id, invoiceId: ف1.id, amount: 6000, createdById: ahmed.id },
    { chequeId: ش.id, invoiceId: ف2.id, amount: 3000, createdById: ahmed.id },
  ]});

  const ت = await اجلب_توزيع_شيك(ش.id);
  تحقق(!!ت && ت.قيمة_الشيك === 10000, "قيمة الشيك 10000");
  تحقق(ت!.المخصَّص === 9000, "المخصَّص 9000");
  تحقق(ت!.غير_موزَّع === 1000, "غير الموزَّع 1000");
  تحقق(ت!.البنود.length === 2, "بندان في التوزيع");

  تحقق(await مدفوع_فاتورة_بشيكات(ف1.id) === 6000, "ف1 مغطّاة بشيكات 6000");
  تحقق(await مدفوع_فاتورة_بشيكات(ف2.id) === 3000, "ف2 مغطّاة بشيكات 3000");

  const خ = await مدفوع_فواتير_بشيكات([ف1.id, ف2.id]);
  تحقق(خ.get(ف1.id) === 6000 && خ.get(ف2.id) === 3000, "النسخة المجمّعة مطابقة");

  // ارتداد الشيك → لا يُحتسب مغطّياً
  await prisma.cheque.update({ where: { id: ش.id }, data: { status: "BOUNCED" } });
  تحقق(await مدفوع_فاتورة_بشيكات(ف1.id) === 0, "بعد الارتداد: التغطية 0");
  const خ2 = await مدفوع_فواتير_بشيكات([ف1.id, ف2.id]);
  تحقق((خ2.get(ف1.id) ?? 0) === 0 && (خ2.get(ف2.id) ?? 0) === 0, "المجمّعة تستثني المرتد");

  // إرجاع الحالة والتحقق من التتالي عند حذف الشيك
  await prisma.cheque.update({ where: { id: ش.id }, data: { status: "PENDING" } });
  await prisma.cheque.delete({ where: { id: ش.id } });
  const باقٍ = await prisma.chequeInvoiceAllocation.count({ where: { chequeId: ش.id } });
  تحقق(باقٍ === 0, "حذف الشيك يتسلسل بحذف بنود التوزيع");

  // التحقق من تتالي حذف الفاتورة أيضاً
  const ش2 = await prisma.cheque.create({ data: { drawerName: "x", amount: 5000, direction: "INCOMING", dueDate: new Date("2026-09-01"), status: "PENDING", partyId: عميل.id, createdById: ahmed.id } });
  await prisma.chequeInvoiceAllocation.create({ data: { chequeId: ش2.id, invoiceId: ف1.id, amount: 5000, createdById: ahmed.id } });
  await prisma.invoice.delete({ where: { id: ف1.id } });
  تحقق(await prisma.chequeInvoiceAllocation.count({ where: { invoiceId: ف1.id } }) === 0, "حذف الفاتورة يتسلسل بحذف التوزيع");

  // تنظيف
  await prisma.cheque.delete({ where: { id: ش2.id } });
  await prisma.invoice.deleteMany({ where: { id: { in: [ف2.id] } } });
  for (const p of [عميل.id, عميل2.id]) { await prisma.ledgerEntry.deleteMany({ where: { partyId: p } }); await prisma.party.delete({ where: { id: p } }); }
  console.log("✓ تم التنظيف");
}
main().then(() => { console.log("\n✅ نجح اختبار توزيع الشيك على الفواتير (المرحلة 4)"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
