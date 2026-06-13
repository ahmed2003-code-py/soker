/**
 * تشغيل/إيقاف PostgreSQL محلي حقيقي عبر embedded-postgres للتطوير والاختبار الذاتي.
 * (لا حاجة لـ Docker أو تثبيت Postgres على الجهاز.)
 *
 *   npx tsx scripts/local-postgres.ts start   # يُهيّئ ويشغّل ويُبقي العملية حية
 *   npx tsx scripts/local-postgres.ts stop
 *
 * بيانات القاعدة تُخزَّن في ./.localdb (متجاهَلة في git).
 * سلسلة الاتصال الناتجة تُكتب في .env كـ DATABASE_URL.
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import path from "node:path";

const جذر = process.cwd();
const مجلد_البيانات = path.join(جذر, ".localdb");
const المنفذ = 5433;
const المستخدم = "postgres";
const كلمة_المرور = "postgres";
const اسم_القاعدة = "soker";
const رابط =
  `postgresql://${المستخدم}:${كلمة_المرور}@localhost:${المنفذ}/${اسم_القاعدة}?schema=public`;

function اكتب_env() {
  const ملف = path.join(جذر, ".env");
  let محتوى = existsSync(ملف) ? readFileSync(ملف, "utf8") : "";
  const سطر = `DATABASE_URL="${رابط}"`;
  if (/^DATABASE_URL=.*$/m.test(محتوى)) {
    محتوى = محتوى.replace(/^DATABASE_URL=.*$/m, سطر);
  } else {
    محتوى += (محتوى && !محتوى.endsWith("\n") ? "\n" : "") + سطر + "\n";
  }
  // قيم افتراضية للاختبار المحلي إن لم تكن موجودة
  if (!/^NEXTAUTH_SECRET=/m.test(محتوى)) محتوى += `NEXTAUTH_SECRET="local-dev-secret-please-change"\n`;
  if (!/^NEXTAUTH_URL=/m.test(محتوى)) محتوى += `NEXTAUTH_URL="http://localhost:3000"\n`;
  if (!/^OCR_ENGINE=/m.test(محتوى)) محتوى += `OCR_ENGINE="tesseract"\n`;
  writeFileSync(ملف, محتوى, "utf8");
  console.log("✓ تم تحديث .env بـ DATABASE_URL المحلي");
}

async function ابدأ() {
  اكتب_env();
  const مُهيّأ = existsSync(path.join(مجلد_البيانات, "PG_VERSION"));
  const pg = new EmbeddedPostgres({
    databaseDir: مجلد_البيانات,
    user: المستخدم,
    password: كلمة_المرور,
    port: المنفذ,
    persistent: true,
    // UTF8 ضروري لتخزين النصوص العربية بشكل سليم (افتراضي ويندوز هو WIN1252)
    initdbFlags: ["--encoding=UTF8", "--locale=C"],
  });

  if (!مُهيّأ) {
    console.log("… تهيئة قاعدة البيانات المحلية لأول مرة (UTF8)");
    await pg.initialise();
  }
  await pg.start();
  console.log(`✓ PostgreSQL يعمل على المنفذ ${المنفذ}`);

  // إنشاء القاعدة بترميز UTF8 صراحةً (من template0) لدعم العربية
  const عميل = pg.getPgClient("postgres");
  await عميل.connect();
  try {
    const موجودة = await عميل.query(
      "select 1 from pg_database where datname=$1",
      [اسم_القاعدة]
    );
    if (موجودة.rowCount === 0) {
      await عميل.query(
        `CREATE DATABASE ${عميل.escapeIdentifier(اسم_القاعدة)} WITH ENCODING 'UTF8' TEMPLATE template0`
      );
      console.log(`✓ تم إنشاء قاعدة "${اسم_القاعدة}" (UTF8)`);
    } else {
      console.log(`• قاعدة "${اسم_القاعدة}" موجودة مسبقاً`);
    }
  } finally {
    await عميل.end();
  }

  const إيقاف = async () => {
    console.log("\n… إيقاف PostgreSQL");
    try {
      await pg.stop();
    } catch {}
    process.exit(0);
  };
  process.on("SIGINT", إيقاف);
  process.on("SIGTERM", إيقاف);

  console.log("القاعدة جاهزة. اترك هذه العملية تعمل. (Ctrl+C للإيقاف)");
  // إبقاء العملية حية
  setInterval(() => {}, 1 << 30);
}

async function أوقف() {
  const pg = new EmbeddedPostgres({
    databaseDir: مجلد_البيانات,
    user: المستخدم,
    password: كلمة_المرور,
    port: المنفذ,
    persistent: true,
  });
  try {
    await pg.stop();
    console.log("✓ تم الإيقاف");
  } catch (e) {
    console.log("• لا يوجد خادم قيد التشغيل أو تعذر الإيقاف");
  }
}

const الأمر = process.argv[2];
if (الأمر === "stop") {
  أوقف();
} else {
  ابدأ().catch((e) => {
    console.error("فشل تشغيل PostgreSQL:", e);
    process.exit(1);
  });
}
