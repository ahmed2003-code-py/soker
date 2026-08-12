/**
 * اختبار «إضافة شيكات للمعاملة» (تظهير عدة شيكات متاحة لمورد) — يحاكي ظهّر_شيكات_لمورد:
 *  - كل شيك متاح (مسجّل) يُظهَّر للمورد: مستحق المورد يقل بمجموع قيمها، ودين كل عميل يبقى كما هو.
 *  - الشيكات تخرج من خزنة الشيكات (لم تعد مسجّلة).
 */
import { PrismaClient } from "@prisma/client";
import { زامن_آثار_الشيك, رصيد_خزنة_الشيكات } from "../src/lib/cheques-accounting";
const prisma = new PrismaClient();
const N = (v: unknown) => Number(v);
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }
const رطرف = async (id: number) => N((await prisma.party.findUniqueOrThrow({ where: { id } })).balance);
const رخزنة_شيكات = async () => N(await رصيد_خزنة_الشيكات(prisma));

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const مورد = await prisma.party.create({ data: { name: "مورد إضافة", type: "SUPPLIER", openingBalance: 200000, balance: 200000, createdById: ahmed.id } });
  const عميل = await prisma.party.create({ data: { name: "عميل إضافة", type: "CUSTOMER", openingBalance: 100000, balance: 100000, createdById: ahmed.id } });
  const خ0 = await رخزنة_شيكات();

  // 3 شيكات متاحة (مسجّلة) بقيم 20/30/50 ألف
  const قيم = [20000, 30000, 50000];
  const شيكات: number[] = [];
  for (const v of قيم) {
    const ش = await prisma.cheque.create({ data: { drawerName: "ش", amount: v, direction: "INCOMING", accountingVersion: 2, dueDate: new Date("2026-09-01"), status: "REGISTERED", partyId: عميل.id, createdById: ahmed.id } });
    await prisma.$transaction(async (tx) => { const c = await tx.cheque.findUniqueOrThrow({ where: { id: ش.id } }); await زامن_آثار_الشيك(tx, c as any, "REGISTERED", {}, ahmed.id); });
    شيكات.push(ش.id);
  }
  تحقق(await رطرف(عميل.id) === 100000 - 100000, "تسجيل: دين العميل 100000→0 (استلمنا 100000 شيكات)");
  تحقق(await رخزنة_شيكات() === خ0 + 100000, "تسجيل: خزنة الشيكات +100000");
  const مستحق_قبل = await رطرف(مورد.id); // 200000

  // ═══ إضافة الشيكات للمعاملة (تظهير للمورد) — نحاكي ظهّر_شيكات_لمورد ═══
  await prisma.$transaction(async (tx) => {
    for (const id of شيكات) {
      const ش = await tx.cheque.findUniqueOrThrow({ where: { id } });
      if (ش.status !== "REGISTERED") throw new Error("غير متاح");
      await زامن_آثار_الشيك(tx, ش as any, "ENDORSED", { معرف_المورد_للتظهير: مورد.id }, ahmed.id);
    }
  });
  تحقق(await رطرف(مورد.id) === مستحق_قبل - 100000, "إضافة: مستحق المورد قلّ 100000 (200000→100000)");
  تحقق(await رطرف(عميل.id) === 0, "إضافة: دين العميل ثابت (0)");
  تحقق(await رخزنة_شيكات() === خ0, "إضافة: الشيكات خرجت من خزنة الشيكات");
  for (const id of شيكات) {
    const ش = await prisma.cheque.findUniqueOrThrow({ where: { id } });
    تحقق(ش.status === "ENDORSED" && ش.endorsedToId === مورد.id, `الشيك ${id} بقى «مظهّر» باسم المورد`);
  }

  // تنظيف
  for (const id of شيكات) await prisma.cheque.delete({ where: { id } });
  for (const p of [عميل.id, مورد.id]) { await prisma.ledgerEntry.deleteMany({ where: { partyId: p } }); await prisma.party.delete({ where: { id: p } }); }
}
main().then(() => { console.log("\n✅ نجح اختبار إضافة شيكات لمعاملة تظهير المورد"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل:", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
