/**
 * استيراد البيانات الحقيقية من ملفات الإكسل إلى قاعدة البيانات.
 *
 * القرارات (موثّقة من المالك):
 *  - الملفات الفردية = موردون، ملفات "عملاء *" = عملاء.
 *  - نقدى/أجل = أطراف منفصلة.
 *  - حركات الخزنة تُوزّع على الـ 4 حسابات بالاستنتاج من البيان.
 *  - اتفاقية الرصيد: عميل = Σمدين−Σدائن، مورد = Σدائن−Σمدين.
 *
 * التشغيل:
 *   npx tsx scripts/import-data.ts --dry      # تحليل فقط، بدون كتابة
 *   DATABASE_URL=... npx tsx scripts/import-data.ts --commit   # تنفيذ فعلي (يمسح بيانات الأعمال أولاً)
 */
import * as XLSX from "xlsx";
import path from "node:path";
import { PrismaClient, PartyType, TxnKind, TreasuryAccountType } from "@prisma/client";

const مجلد = "/home/ahmedeldeeb/Videos/data";
const DRY = !process.argv.includes("--commit");

// ── إعداد الملفات ──────────────────────────────────────────────
type تصنيف_ملف = {
  ملف: string;
  نوع: PartyType;
  منطقة?: string; // للعملاء المجمّعين
  أجل?: boolean;
};
const ملفات_الأطراف: تصنيف_ملف[] = [
  // موردون (أفراد) — كل شيت = طرف باسم الشيت
  { ملف: "خالد رجب 1.xls", نوع: PartyType.SUPPLIER },
  { ملف: "سارة تكس.xls", نوع: PartyType.SUPPLIER },
  { ملف: "طارق.xls", نوع: PartyType.SUPPLIER },
  { ملف: "عادل جمعة.xls", نوع: PartyType.SUPPLIER },
  { ملف: "عادل حسنى.xls", نوع: PartyType.SUPPLIER },
  { ملف: "م عبد الحليم.xls", نوع: PartyType.SUPPLIER },
  // عملاء (مجمّعون) — كل شيت = عميل
  { ملف: "عملاءبهتيم اجل.xls", نوع: PartyType.CUSTOMER, منطقة: "بهتيم", أجل: true },
  { ملف: "عملاء بهتيم نقدى.xls", نوع: PartyType.CUSTOMER, منطقة: "بهتيم", أجل: false },
  { ملف: "عملاء سويس وعبور اجل.xls", نوع: PartyType.CUSTOMER, منطقة: "سويس وعبور", أجل: true },
  { ملف: "عملاء سويس وعبور نقدى.xls", نوع: PartyType.CUSTOMER, منطقة: "سويس وعبور", أجل: false },
  { ملف: "عملاء مريوطيه اجل.xls", نوع: PartyType.CUSTOMER, منطقة: "مريوطية", أجل: true },
  { ملف: "عملاء مريوطيه نقدى.xls", نوع: PartyType.CUSTOMER, منطقة: "مريوطية", أجل: false },
];
const ملف_الخزنة = "خزينه2025.xls";
const ملفات_الشيكات = [
  { ملف: "شيكات صادرة سنة 2018.xls", وارد: false },
  { ملف: "شيكات صادره2026.xls", وارد: false },
  { ملف: "شيكات وارده 2026.xls", وارد: true },
];

const شيتات_فارغة = new Set([
  "Sheet1", "Sheet2", "Sheet3", "ورقة1", "ورقة2", "ورقة3",
  "مخطط1", "مخطط2", "ط1", "Chart1",
]);
const أشهر = ["يناير", "فبراير", "مارس", "ابريل", "أبريل", "مايو", "يونيو", "يوليو", "اغسطس", "أغسطس", "سبتمبر", "اكتوبر", "أكتوبر", "نوفمبر", "ديسمبر"];

// ── أدوات ──────────────────────────────────────────────────────
function رقم(v: unknown): number {
  if (typeof v === "number") return isFinite(v) ? v : 0;
  if (v == null) return 0;
  const s = String(v).replace(/[,٬\s]/g, "").replace(/[^\d.\-]/g, "");
  const n = parseFloat(s);
  return isFinite(n) ? n : 0;
}
function م2(n: number): string { return (Math.round(n * 100) / 100).toFixed(2); }
function م4(n: number): string { return (Math.round(n * 10000) / 10000).toFixed(4); }

function تاريخ(v: unknown): Date | null {
  if (v instanceof Date && !isNaN(v.getTime())) return v;
  if (typeof v === "number" && v > 30000 && v < 60000) {
    // رقم تسلسلي إكسل
    const d = XLSX.SSF ? new Date(Math.round((v - 25569) * 86400 * 1000)) : null;
    if (d && !isNaN(d.getTime())) return d;
  }
  const s = String(v ?? "").trim();
  if (!s) return null;
  // d/m/yyyy أو d/m/yy
  const m = s.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})$/);
  if (m) {
    let [, d, mo, y] = m;
    let yy = parseInt(y);
    if (yy < 100) yy += 2000;
    const dt = new Date(Date.UTC(yy, parseInt(mo) - 1, parseInt(d)));
    return isNaN(dt.getTime()) ? null : dt;
  }
  const iso = s.match(/^(\d{4})-(\d{1,2})-(\d{1,2})/);
  if (iso) {
    const dt = new Date(Date.UTC(+iso[1], +iso[2] - 1, +iso[3]));
    return isNaN(dt.getTime()) ? null : dt;
  }
  return null;
}

function هل_ترويسة(صف: unknown[]): boolean {
  const نص = صف.map((c) => String(c ?? "").trim()).join("|");
  return /منه|له|الرصيد|البيان|تاريخ|الكمية|اسم المدين|ايرادات|مصروفات/.test(نص) &&
    !/\d{4}-\d{2}-\d{2}/.test(نص);
}

// ── أنواع التجميع ──────────────────────────────────────────────
type قيد = { تاريخ: Date; بيان: string; مدين: number; دائن: number; كمية: number | null; سعر: number | null; مستند: string | null };
type طرف_مستورد = { اسم: string; نوع: PartyType; ملاحظات: string | null; قيود: قيد[] };
type حركة_خزنة = { تاريخ: Date; نوع: TxnKind; مبلغ: number; بيان: string; حساب: TreasuryAccountType };
type شيك_مستورد = { المدين: string; المبلغ: number; المستفيد: string | null; محول_من: string | null; البنك: string | null; الاستحقاق: Date; رقم: string | null; ملاحظات: string | null };

const أطراف: طرف_مستورد[] = [];
const حركات_خزنة: حركة_خزنة[] = [];
const شيكات: شيك_مستورد[] = [];
const تخطّيات: string[] = [];

// ── تحليل كشوف الأطراف ─────────────────────────────────────────
function اقرأ_كشف(ws: XLSX.WorkSheet): قيد[] {
  const rows = XLSX.utils.sheet_to_json<unknown[]>(ws, { header: 1, blankrows: false, defval: "" });
  const قيود: قيد[] = [];
  let آخر_تاريخ: Date | null = null;
  for (const r of rows) {
    if (هل_ترويسة(r as unknown[])) continue;
    const c = r as unknown[];
    const كمية = رقم(c[0]);
    const سعر = رقم(c[1]);
    const مدين = رقم(c[2]);
    const دائن = رقم(c[3]);
    const بيان = String(c[5] ?? "").trim();
    const ت = تاريخ(c[6]) ?? آخر_تاريخ;
    const مستند = String(c[7] ?? "").trim() || null;
    if (ت) آخر_تاريخ = ت;
    // تخطّي الصفوف الفارغة تمامًا
    if (!مدين && !دائن && !كمية && !بيان) continue;
    if (!ت) continue; // بدون تاريخ لا يمكن ترتيبه
    قيود.push({
      تاريخ: ت, بيان: بيان || "—", مدين, دائن,
      كمية: كمية || null, سعر: سعر || null, مستند,
    });
  }
  return قيود;
}

for (const f of ملفات_الأطراف) {
  const wb = XLSX.readFile(path.join(مجلد, f.ملف), { cellDates: true });
  for (const اسم of wb.SheetNames) {
    if (شيتات_فارغة.has(اسم.trim())) continue;
    const قيود = اقرأ_كشف(wb.Sheets[اسم]);
    if (قيود.length === 0) { تخطّيات.push(`${f.ملف} » ${اسم} (فارغ)`); continue; }
    const اسمنظيف = اسم.trim();
    const اسم_الطرف = f.نوع === PartyType.CUSTOMER
      ? `${اسمنظيف} (${f.منطقة} ${f.أجل ? "أجل" : "نقدى"})`
      : اسمنظيف;
    أطراف.push({
      اسم: اسم_الطرف,
      نوع: f.نوع,
      ملاحظات: `مستورد من: ${f.ملف}${f.منطقة ? ` / ${f.منطقة}` : ""}`,
      قيود,
    });
  }
}

// ── تحليل الخزنة ───────────────────────────────────────────────
function حساب_من_البيان(بيان: string): TreasuryAccountType {
  const b = بيان;
  if (/فودافون|فودا/.test(b)) return TreasuryAccountType.VODAFONE;
  if (/انستا|إنستا|انستاباي/.test(b)) return TreasuryAccountType.INSTAPAY;
  if (/بنك|تحويل|شيك|حق |حواله|حوالة|انتساب/.test(b)) return TreasuryAccountType.BANK;
  return TreasuryAccountType.CASH;
}
{
  const wb = XLSX.readFile(path.join(مجلد, ملف_الخزنة), { cellDates: true });
  for (const اسم of wb.SheetNames) {
    if (!أشهر.includes(اسم.trim())) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[اسم], { header: 1, blankrows: false, defval: "" });
    let آخر: Date | null = null;
    for (const r of rows) {
      if (هل_ترويسة(r as unknown[])) continue;
      const c = r as unknown[];
      const إيراد = رقم(c[0]);
      const مصروف = رقم(c[1]);
      const بيان = String(c[3] ?? "").trim();
      const ت = تاريخ(c[4]) ?? آخر;
      if (ت) آخر = ت;
      if (!ت) continue;
      if (إيراد > 0) حركات_خزنة.push({ تاريخ: ت, نوع: TxnKind.INCOME, مبلغ: إيراد, بيان: بيان || "إيراد", حساب: حساب_من_البيان(بيان) });
      if (مصروف > 0) حركات_خزنة.push({ تاريخ: ت, نوع: TxnKind.EXPENSE, مبلغ: مصروف, بيان: بيان || "مصروف", حساب: حساب_من_البيان(بيان) });
    }
  }
}

// ── تحليل الشيكات ──────────────────────────────────────────────
for (const ch of ملفات_الشيكات) {
  const wb = XLSX.readFile(path.join(مجلد, ch.ملف), { cellDates: true });
  for (const اسم of wb.SheetNames) {
    if (شيتات_فارغة.has(اسم.trim())) continue;
    const rows = XLSX.utils.sheet_to_json<unknown[]>(wb.Sheets[اسم], { header: 1, blankrows: false, defval: "" });
    for (const r of rows) {
      if (هل_ترويسة(r as unknown[])) continue;
      const c = r as unknown[];
      const المدين = String(c[0] ?? "").trim();
      const المستفيد = String(c[2] ?? "").trim() || null;
      const محول_من = String(c[3] ?? "").trim() || null;
      const البنك = String(c[4] ?? "").trim() || null;
      const ت = تاريخ(c[5]);
      // المبلغ قد يكون في عمود المبلغ أو رقم الشيك أو محول الى (بيانات غير متسقة)
      const مرشحات = [رقم(c[1]), رقم(c[6]), رقم(c[7])].filter((n) => n > 0);
      const المبلغ = مرشحات.length ? Math.max(...مرشحات) : 0;
      if (!المدين && !المبلغ) continue; // صف فارغ
      if (!ت) { تخطّيات.push(`${ch.ملف} » ${اسم}: شيك بدون تاريخ (${المدين})`); continue; }
      if (!المبلغ) { تخطّيات.push(`${ch.ملف} » ${اسم}: شيك بدون مبلغ (${المدين})`); continue; }
      شيكات.push({
        المدين: المدين || "—",
        المبلغ,
        المستفيد,
        محول_من,
        البنك,
        الاستحقاق: ت,
        رقم: null,
        ملاحظات: ch.وارد ? "وارد" : "صادر",
      });
    }
  }
}

// ── أثر الحركة على الرصيد حسب النوع ────────────────────────────
function أثر(نوع: PartyType, مدين: number, دائن: number): number {
  return نوع === PartyType.CUSTOMER ? مدين - دائن : دائن - مدين;
}

// ── ملخص ───────────────────────────────────────────────────────
function ملخص() {
  const عملاء = أطراف.filter((p) => p.نوع === PartyType.CUSTOMER);
  const موردون = أطراف.filter((p) => p.نوع === PartyType.SUPPLIER);
  const totalEntries = أطراف.reduce((s, p) => s + p.قيود.length, 0);
  console.log("\n════════════════ ملخّص الاستيراد ════════════════");
  console.log(`الأطراف: ${أطراف.length}  (عملاء ${عملاء.length} | موردون ${موردون.length})`);
  console.log(`قيود دفتر الأستاذ: ${totalEntries.toLocaleString("en-US")}`);
  console.log(`حركات الخزنة: ${حركات_خزنة.length.toLocaleString("en-US")}`);
  const perAcc: Record<string, { in: number; out: number }> = {};
  for (const t of حركات_خزنة) {
    perAcc[t.حساب] ??= { in: 0, out: 0 };
    if (t.نوع === TxnKind.INCOME) perAcc[t.حساب].in += t.مبلغ; else perAcc[t.حساب].out += t.مبلغ;
  }
  for (const [a, v] of Object.entries(perAcc))
    console.log(`   - ${a}: إيراد ${Math.round(v.in).toLocaleString("en-US")} | مصروف ${Math.round(v.out).toLocaleString("en-US")}`);
  console.log(`الشيكات: ${شيكات.length}`);
  // أعلى 8 أطراف بالرصيد
  const أرصدة = أطراف.map((p) => ({
    اسم: p.اسم, نوع: p.نوع,
    رصيد: p.قيود.reduce((s, q) => s + أثر(p.نوع, q.مدين, q.دائن), 0),
  })).sort((a, b) => Math.abs(b.رصيد) - Math.abs(a.رصيد));
  console.log("\nأعلى 8 أطراف بالرصيد:");
  for (const r of أرصدة.slice(0, 8))
    console.log(`   ${r.نوع === "CUSTOMER" ? "عميل " : "مورد "} ${r.اسم}: ${Math.round(r.رصيد).toLocaleString("en-US")}`);
  if (تخطّيات.length) {
    console.log(`\nتخطّيات (${تخطّيات.length}):`);
    for (const s of تخطّيات.slice(0, 20)) console.log("   ⚠ " + s);
    if (تخطّيات.length > 20) console.log(`   … و${تخطّيات.length - 20} أخرى`);
  }
}

// ── الكتابة في القاعدة ─────────────────────────────────────────
async function اكتب() {
  const prisma = new PrismaClient();
  try {
    const مالك = await prisma.user.findFirst({ where: { role: "ADMIN" }, orderBy: { id: "asc" } });
    if (!مالك) throw new Error("لا يوجد مستخدم مدير — شغّل البذر (seed) أولاً");
    const uid = مالك.id;

    console.log("🗑  مسح بيانات الأعمال السابقة (التجريبية)…");
    await prisma.$transaction([
      prisma.ledgerEntry.deleteMany({}),
      prisma.treasuryTxn.deleteMany({}),
      prisma.cheque.deleteMany({}),
      prisma.invoiceLine.deleteMany({}),
      prisma.invoice.deleteMany({}),
      prisma.party.deleteMany({}),
    ]);
    await prisma.treasuryAccount.updateMany({ data: { balance: 0 } });

    // الأطراف + القيود
    console.log("👥 إدراج الأطراف والقيود…");
    for (const p of أطراف) {
      const طرف = await prisma.party.create({
        data: { name: p.اسم, type: p.نوع, notes: p.ملاحظات, createdById: uid },
      });
      const مرتب = [...p.قيود].sort((a, b) => a.تاريخ.getTime() - b.تاريخ.getTime());
      let تراكمي = 0;
      const data = مرتب.map((q) => {
        تراكمي += أثر(p.نوع, q.مدين, q.دائن);
        return {
          partyId: طرف.id, date: q.تاريخ, description: q.بيان,
          docNumber: q.مستند, category: null,
          qty: q.كمية != null ? م4(q.كمية) : null,
          price: q.سعر != null ? م4(q.سعر) : null,
          debit: م2(q.مدين), credit: م2(q.دائن), balanceAfter: م2(تراكمي),
          createdById: uid,
        };
      });
      for (let i = 0; i < data.length; i += 1000)
        await prisma.ledgerEntry.createMany({ data: data.slice(i, i + 1000) });
      await prisma.party.update({ where: { id: طرف.id }, data: { balance: م2(تراكمي) } });
    }

    // الخزنة
    console.log("💰 إدراج حركات الخزنة…");
    const حسابات = await prisma.treasuryAccount.findMany();
    const idByType: Record<string, number> = {};
    for (const a of حسابات) idByType[a.type] = a.id;
    const متراكم: Record<number, number> = {};
    const مرتبة_خزنة = [...حركات_خزنة].sort((a, b) => a.تاريخ.getTime() - b.تاريخ.getTime());
    const بياناتخزنة = مرتبة_خزنة.map((t) => {
      const accId = idByType[t.حساب];
      متراكم[accId] = (متراكم[accId] ?? 0) + (t.نوع === TxnKind.INCOME ? t.مبلغ : -t.مبلغ);
      return {
        date: t.تاريخ, kind: t.نوع, amount: م2(t.مبلغ), accountId: accId,
        description: t.بيان, balanceAfter: م2(متراكم[accId]), createdById: uid,
      };
    });
    for (let i = 0; i < بياناتخزنة.length; i += 1000)
      await prisma.treasuryTxn.createMany({ data: بياناتخزنة.slice(i, i + 1000) });
    for (const [accId, bal] of Object.entries(متراكم))
      await prisma.treasuryAccount.update({ where: { id: Number(accId) }, data: { balance: م2(bal) } });

    // الشيكات
    console.log("🧾 إدراج الشيكات…");
    const بياناتشيكات = شيكات.map((c) => ({
      drawerName: c.المدين, amount: م2(c.المبلغ), beneficiary: c.المستفيد,
      transferredFrom: c.محول_من, bankName: c.البنك, dueDate: c.الاستحقاق,
      chequeNumber: c.رقم, notes: c.ملاحظات, createdById: uid,
    }));
    for (let i = 0; i < بياناتشيكات.length; i += 1000)
      await prisma.cheque.createMany({ data: بياناتشيكات.slice(i, i + 1000) });

    console.log("✅ تم الاستيراد بنجاح");
  } finally {
    await prisma.$disconnect();
  }
}

ملخص();
if (DRY) {
  console.log("\n(وضع التحليل فقط — لم تُكتب أي بيانات. أضف --commit للتنفيذ)");
} else {
  اكتب().catch((e) => { console.error("❌ فشل:", e); process.exit(1); });
}
