import { PrismaClient } from "@prisma/client";

const عالمي = globalThis as unknown as { prisma?: PrismaClient };

function بناء_رابط_الاتصال(): string | undefined {
  const url = process.env.DATABASE_URL;
  if (!url) return undefined;
  try {
    const u = new URL(url);
    if (!u.searchParams.has("connection_limit"))
      u.searchParams.set("connection_limit", "10");
    if (!u.searchParams.has("pool_timeout"))
      u.searchParams.set("pool_timeout", "20");
    if (!u.searchParams.has("connect_timeout"))
      u.searchParams.set("connect_timeout", "10");
    return u.toString();
  } catch {
    return url;
  }
}

export const prisma =
  عالمي.prisma ??
  new PrismaClient({
    datasourceUrl: بناء_رابط_الاتصال(),
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
    // قاعدة الإنتاج في مشروع Railway منفصل عن التطبيق (اتصال عبر TCP proxy عام لا شبكة
    // داخلية) — زمن الاستجابة أعلى وأقل ثباتاً من الافتراضي (5 ثوانٍ timeout / 2 ثانية
    // maxWait)، فأي $transaction فيه أكتر من استعلام أو حلقة كان بيتقفل قبل ما يخلص
    // ويطلع "Transaction not found" عند أول استعلام بعدها. رفعناها هنا مركزياً بدل
    // ما نصلّح كل $transaction على حدة (76 مكان في الكود).
    transactionOptions: { maxWait: 10_000, timeout: 30_000 },
  });

// احتفظ بنسخة واحدة في جميع البيئات لتجنب تعدد الاتصالات
عالمي.prisma ??= prisma;
