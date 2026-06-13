/** اختبار ذاتي للمرحلة 11: البحث الموحّد عبر HTTP. يتطلب npm run dev. */
import { PrismaClient } from "@prisma/client";
const BASE = process.env.BASE_URL || "http://localhost:3000";
const prisma = new PrismaClient();

const الكوكيز = new Map<string, string>();
function خزّن(res: Response) {
  for (const c of res.headers.getSetCookie?.() ?? []) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    الكوكيز.set(pair.slice(0, i), pair.slice(i + 1));
  }
}
const ترويسة = () => [...الكوكيز].map(([k, v]) => `${k}=${v}`).join("; ");

async function دخول() {
  const csrf = await fetch(`${BASE}/api/auth/csrf`, { headers: { cookie: ترويسة() } });
  خزّن(csrf);
  const { csrfToken } = await csrf.json();
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: { "content-type": "application/x-www-form-urlencoded", cookie: ترويسة() },
    body: new URLSearchParams({ csrfToken, username: "ahmed", password: "Soker@2026", json: "true" }),
    redirect: "manual",
  });
  خزّن(res);
}

function تحقق(ش: boolean, ر: string) {
  if (!ش) throw new Error("فشل: " + ر);
  console.log("✓ " + ر);
}

async function main() {
  const ahmed = await prisma.user.findUniqueOrThrow({ where: { username: "ahmed" } });
  const اسم = "زبون بحث فريد ٩٩٧";
  const عميل = await prisma.party.create({ data: { name: اسم, type: "CUSTOMER", phone: "01099887766", createdById: ahmed.id } });

  await دخول();
  تحقق(الكوكيز.size > 0, "تم تسجيل الدخول");

  // البحث بالاسم
  const r1 = await fetch(`${BASE}/api/search?q=${encodeURIComponent("بحث فريد")}`, { headers: { cookie: ترويسة() } });
  const d1 = await r1.json();
  const عملاء = d1.المجموعات?.find((g: { النوع: string }) => g.النوع === "العملاء");
  تحقق(!!عملاء && عملاء.العناصر.some((x: { عنوان: string }) => x.عنوان === اسم), "البحث بالاسم يجد العميل");

  // البحث بالهاتف
  const r2 = await fetch(`${BASE}/api/search?q=01099887766`, { headers: { cookie: ترويسة() } });
  const d2 = await r2.json();
  تحقق(
    d2.المجموعات?.some((g: { العناصر: { رابط: string }[] }) => g.العناصر.some((x) => x.رابط === `/customers/${عميل.id}`)),
    "البحث بالهاتف يجد العميل والرابط صحيح"
  );

  // طلب بلا مصادقة → 401
  const r3 = await fetch(`${BASE}/api/search?q=test`);
  تحقق(r3.status === 401, "البحث بدون مصادقة مرفوض (401)");

  await prisma.party.delete({ where: { id: عميل.id } });
  console.log("✓ تم التنظيف");
}

main()
  .then(() => { console.log("\n✅ نجح اختبار المرحلة 11"); process.exit(0); })
  .catch((e) => { console.error("\n❌ فشل اختبار المرحلة 11:", e.message); process.exit(1); })
  .finally(() => prisma.$disconnect());
