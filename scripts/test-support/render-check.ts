/**
 * فحص عرض الصفحات عبر HTTP ضد خادم تطوير متصل بقاعدة الاختبار المعزولة:
 * قائمة الفواتير (شارة/فلتر المعلّقة)، صفحة فاتورة زائر معلّقة (الحالة + زر التحصيل + المصروفات)،
 * صفحة التعديل (تحميل المصروفات)، صفحة المشاركة (المصروفات).
 */
import { PrismaClient } from "@prisma/client";
const BASE = process.env.BASE_URL || "http://localhost:3100";
const prisma = new PrismaClient();
const كوكيز = new Map<string, string>();
const خزّن = (r: Response) => { for (const c of r.headers.getSetCookie?.() ?? []) { const [p] = c.split(";"); const i = p.indexOf("="); كوكيز.set(p.slice(0, i), p.slice(i + 1)); } };
const ترويسة = () => [...كوكيز].map(([k, v]) => `${k}=${v}`).join("; ");
function تحقق(ش: boolean, ر: string) { if (!ش) throw new Error("فشل: " + ر); console.log("✓ " + ر); }
const صفحة = async (مسار: string) => { const r = await fetch(BASE + مسار, { headers: { cookie: ترويسة() }, redirect: "manual" }); return { حالة: r.status, نص: await r.text() }; };

(async () => {
  const c = await fetch(`${BASE}/api/auth/csrf`); خزّن(c);
  const { csrfToken } = await c.json();
  const r = await fetch(`${BASE}/api/auth/callback/credentials`, { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded", cookie: ترويسة() }, body: new URLSearchParams({ csrfToken, username: "ahmed", password: process.env.TEST_PASSWORD ?? "", json: "true" }), redirect: "manual" });
  خزّن(r);
  تحقق([...كوكيز.keys()].some((k) => k.includes("session-token")), "تسجيل الدخول (قاعدة الاختبار)");

  const معلّقة = await prisma.invoice.findFirstOrThrow({ where: { guestName: "زائر متزامن" }, orderBy: { id: "desc" } });
  const بمصروفات = await prisma.invoice.findFirstOrThrow({ where: { guestName: "زائر اختبار" }, orderBy: { id: "desc" } });

  const قائمة = await صفحة("/invoices");
  تحقق(قائمة.حالة === 200 && قائمة.نص.includes("معلّقة — متبقي") && قائمة.نص.includes("معلّقة (غير محصّلة) فقط"), "القائمة: شارة «معلّقة — متبقي» + فلتر المعلّقة");

  const تفاصيل = await صفحة(`/invoices/${معلّقة.id}`);
  تحقق(تفاصيل.حالة === 200 && تفاصيل.نص.includes("حالة الدفع") && تفاصيل.نص.includes("معلّقة (غير محصّلة)") && تفاصيل.نص.includes("تحصيل المتبقي"), "صفحة الفاتورة المعلّقة: الحالة + زر تحصيل المتبقي");

  تحقق(تفاصيل.نص.includes("تحصيل وإنهاء"), "صفحة الفاتورة المعلّقة: زر «تحصيل وإنهاء»");
  const مُنهاة = await prisma.invoice.findFirstOrThrow({ where: { guestName: "زائر 1010" }, orderBy: { id: "desc" } });
  const ص_مُنهاة = await صفحة(`/invoices/${مُنهاة.id}`);
  تحقق(ص_مُنهاة.نص.includes("منتهية (تحصيل وإنهاء)") && ص_مُنهاة.نص.includes("مسامحة (لم تدخل الخزنة)") && !ص_مُنهاة.نص.includes("تحصيل المتبقي"), "فاتورة مُنهاة: الحالة + المسامحة، بلا أزرار تحصيل");
  const قديمة = await prisma.invoice.findFirstOrThrow({ where: { guestName: "زائر قديم بباقي" } });
  await prisma.invoice.update({ where: { id: قديمة.id }, data: { paymentTracked: false } }); // الـbackfill في الاختبار علّمها
  const ص_قديمة = await صفحة(`/invoices/${قديمة.id}`);
  تحقق(!ص_قديمة.نص.includes("حالة الدفع") && !ص_قديمة.نص.includes("تحصيل المتبقي"), "فاتورة زائر قديمة: بلا حالة دفع ولا تحصيل");

  const مدفوعة = await صفحة(`/invoices/${بمصروفات.id}`);
  تحقق(مدفوعة.حالة === 200 && مدفوعة.نص.includes("مصروف إضافي") && مدفوعة.نص.includes("تحميل") && مدفوعة.نص.includes("إجمالي البنود") && !مدفوعة.نص.includes("تحصيل المتبقي"), "فاتورة مدفوعة بمصروفات: صفوف المصروفات + إجمالي البنود، بلا زر تحصيل");
  تحقق(مدفوعة.نص.includes("1,050.00"), "الإجمالي النهائي 1,050.00 معروض");

  const تعديل = await صفحة(`/invoices/${بمصروفات.id}/edit`);
  تحقق(تعديل.حالة === 200 && تعديل.نص.includes("تحميل") && تعديل.نص.includes("مصروفات إضافية"), "صفحة التعديل: قسم المصروفات محمّل بالبيانات");

  const جديد = await صفحة("/invoices/new");
  تحقق(جديد.حالة === 200 && جديد.نص.includes("مصروفات إضافية (اختياري)") && جديد.نص.includes("يمكن تحصيله لاحقاً"), "فاتورة جديدة: قسم المصروفات + خيار الزائر بتحصيل لاحق");

  const مشاركة = await صفحة(`/share/${بمصروفات.shareToken}`);
  تحقق(مشاركة.حالة === 200 && مشاركة.نص.includes("تحميل") && مشاركة.نص.includes("1,050.00"), "صفحة المشاركة: المصروفات معروضة");

  console.log("\n✅ نجح فحص عرض الصفحات");
  process.exit(0);
})().catch((e) => { console.error("❌", e.message); process.exit(1); });
