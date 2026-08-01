/**
 * نسخة احتياطية منطقية كاملة (مستقلة عن إصدار PostgreSQL) عبر Prisma.
 * تقرأ كل الجداول وتكتبها JSON. الحقول الثنائية (صور الشيكات) تُرمَّز base64.
 * الاستخدام: DATABASE_URL=<prod> npx tsx scripts/backup-prod-json.ts <outfile>
 */
import { PrismaClient, Prisma } from "@prisma/client";
import { writeFileSync } from "fs";
const prisma = new PrismaClient();

const جداول = [
  "user", "party", "invoice", "invoiceLine", "ledgerEntry", "subAccount",
  "treasuryAccount", "treasuryTxn", "directPayment", "splitPayment",
  "cheque", "chequeInvoiceAllocation", "chequeBook", "activityLog", "setting",
] as const;

function replacer(_k: string, v: unknown): unknown {
  if (v && typeof v === "object") {
    // Buffer / Bytes → base64
    if (typeof (v as { toString?: unknown }).toString === "function" && (v as { type?: string }).type === "Buffer" && Array.isArray((v as { data?: unknown }).data)) {
      return { __bytes_b64__: Buffer.from((v as { data: number[] }).data).toString("base64") };
    }
    // Prisma.Decimal → string (دقة كاملة)
    if (v instanceof Prisma.Decimal) return { __decimal__: v.toString() };
  }
  return v;
}

async function main() {
  const out = process.argv[2] || "backups/prod-backup.json";
  const dump: Record<string, unknown[]> = {};
  const counts: Record<string, number> = {};
  for (const t of جداول) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const rows = await (prisma as any)[t].findMany();
    dump[t] = rows;
    counts[t] = rows.length;
    console.log(`  ${t}: ${rows.length}`);
  }
  const payload = { الإصدار: 1, وقت: new Date().toISOString(), counts, بيانات: dump };
  writeFileSync(out, JSON.stringify(payload, replacer));
  console.log(`\n✅ اكتملت النسخة: ${out}`);
}
main().catch((e) => { console.error("❌", e.message); process.exit(1); }).finally(() => prisma.$disconnect());
