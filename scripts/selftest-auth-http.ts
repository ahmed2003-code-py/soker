/**
 * اختبار تسجيل دخول حقيقي عبر HTTP ضد خادم التطوير.
 * يتطلب تشغيل: npm run dev (المنفذ 3000) وقاعدة بيانات تعمل ومبذورة.
 */
const BASE = process.env.BASE_URL || "http://localhost:3000";

const الكوكيز = new Map<string, string>();
function خزّن_الكوكيز(res: Response) {
  const set = res.headers.getSetCookie?.() ?? [];
  for (const c of set) {
    const [pair] = c.split(";");
    const i = pair.indexOf("=");
    الكوكيز.set(pair.slice(0, i), pair.slice(i + 1));
  }
}
function ترويسة_الكوكيز() {
  return [...الكوكيز.entries()].map(([k, v]) => `${k}=${v}`).join("; ");
}

async function دخول(username: string, password: string) {
  const csrfRes = await fetch(`${BASE}/api/auth/csrf`, {
    headers: { cookie: ترويسة_الكوكيز() },
  });
  خزّن_الكوكيز(csrfRes);
  const { csrfToken } = await csrfRes.json();

  const body = new URLSearchParams({ csrfToken, username, password, json: "true" });
  const res = await fetch(`${BASE}/api/auth/callback/credentials`, {
    method: "POST",
    headers: {
      "content-type": "application/x-www-form-urlencoded",
      cookie: ترويسة_الكوكيز(),
    },
    body,
    redirect: "manual",
  });
  خزّن_الكوكيز(res);

  const sessRes = await fetch(`${BASE}/api/auth/session`, {
    headers: { cookie: ترويسة_الكوكيز() },
  });
  return sessRes.json();
}

function تحقق(ش: boolean, ر: string) {
  if (!ش) throw new Error("فشل: " + ر);
  console.log("✓ " + ر);
}

async function main() {
  // 1) دخول صحيح لأحمد
  const جلسة = await دخول("ahmed", "Soker@2026");
  تحقق(!!جلسة?.user, "تم تسجيل دخول أحمد عبر HTTP");
  تحقق(جلسة.user.role === "ADMIN", "دور أحمد = مدير");
  تحقق(جلسة.user.name === "أحمد سكر", "اسم الجلسة = أحمد سكر");

  // 2) دخول خاطئ
  الكوكيز.clear();
  const جلسة2 = await دخول("ahmed", "كلمة-غلط");
  تحقق(!جلسة2?.user, "كلمة المرور الخاطئة لا تنشئ جلسة");
}

main()
  .then(() => {
    console.log("\n✅ نجح اختبار الدخول عبر HTTP");
    process.exit(0);
  })
  .catch((e) => {
    console.error("\n❌ فشل:", e.message);
    process.exit(1);
  });
