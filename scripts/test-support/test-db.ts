/**
 * قاعدة PostgreSQL معزولة مؤقتة للاختبارات (embedded-postgres على المنفذ 5544).
 * لا تمس قاعدة التطوير (.localdb / 5433) ولا الإنتاج. البيانات تُمسح عند الإيقاف.
 *
 *   npx tsx scripts/test-support/test-db.ts <مجلد_البيانات>
 *   ⇒ DATABASE_URL="postgresql://postgres:test@localhost:5544/soker_test?schema=public"
 */
import EmbeddedPostgres from "embedded-postgres";
import { existsSync } from "node:fs";

const مجلد = process.argv[2];
if (!مجلد) {
  console.error("حدد مجلد بيانات مؤقت");
  process.exit(1);
}
const pg = new EmbeddedPostgres({
  databaseDir: مجلد,
  user: "postgres",
  password: "test",
  port: 5544,
  persistent: false,
  initdbFlags: ["--encoding=UTF8", "--locale=C"],
});

(async () => {
  if (!existsSync(`${مجلد}/PG_VERSION`)) await pg.initialise();
  await pg.start();
  await pg.createDatabase("soker_test");
  console.log("READY");
  const أوقف = async () => {
    await pg.stop();
    process.exit(0);
  };
  process.on("SIGTERM", أوقف);
  process.on("SIGINT", أوقف);
  setInterval(() => {}, 1 << 30);
})().catch((e) => {
  console.error(e);
  process.exit(1);
});
