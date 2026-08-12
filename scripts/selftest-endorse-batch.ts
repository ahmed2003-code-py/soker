/**
 * اختبار معرّف معاملة التظهير (endorseBatchId):
 *  - التظهير المفرد (من صفحة الشيكات) ياخد معرّف معاملة خاص به (= معرّف الشيك) → معاملة مستقلة.
 *  - إضافة شيكات دفعة واحدة (ظهّر_شيكات_لمورد) تتشارك معرّف معاملة واحد → معاملة واحدة.
 *  - الإضافة لمعاملة قائمة تُوحِّد المعرّف على القديم والجديد (تثبيت المجموعة).
 * يحاكي منطق تعيين المعرّف في الأكشنز (بلا جلسة).
 */
import { PrismaClient } from "@prisma/client";
import { زامن_آثار_الشيك } from "../src/lib/cheques-accounting";
const prisma = new PrismaClient();
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const مورد = await prisma.party.create({ data: { name: "مورد باتش", type: "SUPPLIER", openingBalance: 500000, balance: 500000, createdById: ahmed.id } });
  const عميل = await prisma.party.create({ data: { name: "عميل باتش", type: "CUSTOMER", openingBalance: 300000, balance: 300000, createdById: ahmed.id } });
  const mk = async (v: number) => {
    const ش = await prisma.cheque.create({ data: { drawerName: "ش", amount: v, direction: "INCOMING", accountingVersion: 2, dueDate: new Date("2026-09-01"), status: "REGISTERED", partyId: عميل.id, createdById: ahmed.id } });
    await prisma.$transaction(async (tx) => { const c = await tx.cheque.findUniqueOrThrow({ where: { id: ش.id } }); await زامن_آثار_الشيك(tx, c as any, "REGISTERED", {}, ahmed.id); });
    return ش.id;
  };
  const [A, B, C, D] = [await mk(10000), await mk(20000), await mk(30000), await mk(40000)];

  // (1) تظهير مفرد للشيك A (يحاكي تغيير_حالة ENDORSED): batchId = A
  await prisma.$transaction(async (tx) => {
    const c = await tx.cheque.findUniqueOrThrow({ where: { id: A } });
    await زامن_آثار_الشيك(tx, c as any, "ENDORSED", { معرف_المورد_للتظهير: مورد.id }, ahmed.id);
    await tx.cheque.update({ where: { id: A }, data: { endorseBatchId: A } });
  });
  تحقق((await prisma.cheque.findUniqueOrThrow({ where: { id: A } })).endorseBatchId === A, "تظهير مفرد A: معرّف المعاملة = معرّف الشيك A (معاملة مستقلة)");

  // (2) إضافة B,C دفعة واحدة (يحاكي ظهّر_شيكات_لمورد بلا معاملة قائمة): batchId = min(B,C) = B
  const batchBC = Math.min(B, C);
  await prisma.$transaction(async (tx) => {
    for (const id of [B, C]) {
      const c = await tx.cheque.findUniqueOrThrow({ where: { id } });
      await زامن_آثار_الشيك(tx, c as any, "ENDORSED", { معرف_المورد_للتظهير: مورد.id }, ahmed.id);
      await tx.cheque.update({ where: { id }, data: { endorseBatchId: batchBC } });
    }
  });
  const b = await prisma.cheque.findUniqueOrThrow({ where: { id: B } });
  const c2 = await prisma.cheque.findUniqueOrThrow({ where: { id: C } });
  تحقق(b.endorseBatchId === batchBC && c2.endorseBatchId === batchBC, "دفعة B,C: نفس معرّف المعاملة (معاملة واحدة)");
  تحقق(batchBC !== A, "معاملة B,C مختلفة عن معاملة A المفردة");

  // (3) الإضافة لمعاملة B,C القائمة: توحيد D معها بنفس المعرّف
  await prisma.$transaction(async (tx) => {
    const موجود = await tx.cheque.findFirst({ where: { id: { in: [B, C] }, endorseBatchId: { not: null } }, select: { endorseBatchId: true } });
    const batch = موجود?.endorseBatchId ?? Math.min(B, C, D);
    await tx.cheque.updateMany({ where: { id: { in: [B, C] }, endorseBatchId: null }, data: { endorseBatchId: batch } });
    const c = await tx.cheque.findUniqueOrThrow({ where: { id: D } });
    await زامن_آثار_الشيك(tx, c as any, "ENDORSED", { معرف_المورد_للتظهير: مورد.id }, ahmed.id);
    await tx.cheque.update({ where: { id: D }, data: { endorseBatchId: batch } });
  });
  const d = await prisma.cheque.findUniqueOrThrow({ where: { id: D } });
  تحقق(d.endorseBatchId === batchBC, "الإضافة للمعاملة: D انضم لنفس معرّف B,C");

  // تنظيف
  for (const id of [A, B, C, D]) await prisma.cheque.delete({ where: { id } });
  for (const p of [عميل.id, مورد.id]) { await prisma.ledgerEntry.deleteMany({ where: { partyId: p } }); await prisma.party.delete({ where: { id: p } }); }
}
main().then(() => { console.log("\n✅ نجح اختبار معرّف معاملة التظهير (مفرد مستقل + دفعة موحّدة)"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
