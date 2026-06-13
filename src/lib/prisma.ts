import { PrismaClient } from "@prisma/client";

/** عميل Prisma وحيد (يمنع تعدد الاتصالات أثناء التطوير) */
const عالمي = globalThis as unknown as { prisma?: PrismaClient };

export const prisma =
  عالمي.prisma ??
  new PrismaClient({
    log: process.env.NODE_ENV === "development" ? ["warn", "error"] : ["error"],
  });

if (process.env.NODE_ENV !== "production") عالمي.prisma = prisma;
