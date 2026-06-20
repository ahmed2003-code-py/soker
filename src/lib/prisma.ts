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
  });

// احتفظ بنسخة واحدة في جميع البيئات لتجنب تعدد الاتصالات
عالمي.prisma ??= prisma;
