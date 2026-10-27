/**
 * تحميل مسبق (--require) لاختبار الإجراءات الخادمية الحقيقية خارج Next.js:
 *  - "@/lib/session"  ⇒ جلسة اختبار يحددها السكربت (globalThis.__مستخدم_الاختبار)
 *  - "next/cache"     ⇒ revalidatePath/revalidateTag بلا أثر
 * باقي الكود (Zod، الصلاحيات، المعاملات، القيود) يعمل كما هو.
 */
const Module = require("module");
const path = require("path");

const جلسة = path.join(__dirname, "session-stub.cjs");
const ذاكرة = path.join(__dirname, "next-cache-stub.cjs");
const أصلي = Module._resolveFilename;
Module._resolveFilename = function (طلب, ...باقي) {
  if (طلب === "next/cache") return ذاكرة;
  if (طلب === "@/lib/session" || /[\\/]src[\\/]lib[\\/]session(\.ts)?$/.test(طلب)) return جلسة;
  const محلول = أصلي.call(this, طلب, ...باقي);
  if (/[\\/]src[\\/]lib[\\/]session\.ts$/.test(محلول)) return جلسة;
  return محلول;
};
