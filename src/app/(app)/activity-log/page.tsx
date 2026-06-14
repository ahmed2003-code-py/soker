import { redirect } from "next/navigation";
import type { Prisma } from "@prisma/client";
import { المستخدم_الحالي } from "@/lib/session";
import { prisma } from "@/lib/prisma";
import { ترويسة_الصفحة } from "@/components/page-header";
import { مترجم_الخادم } from "@/lib/i18n/server";
import { سجل_العمليات_العرض } from "./client";

export const metadata = { title: "سجل العمليات — سُكر" };

type المعاملات = {
  المستخدم?: string;
  النوع?: string;
  من?: string;
  إلى?: string;
};

export default async function صفحة_سجل_العمليات({
  searchParams,
}: {
  searchParams: المعاملات;
}) {
  const م = await المستخدم_الحالي();
  if (!م) redirect("/login");
  if (م.role !== "ADMIN") redirect("/");
  const { t } = مترجم_الخادم();

  const where: Prisma.ActivityLogWhereInput = {};
  if (searchParams.المستخدم) where.userId = Number(searchParams.المستخدم);
  if (searchParams.النوع) where.entityType = searchParams.النوع;
  if (searchParams.من || searchParams.إلى) {
    where.createdAt = {};
    if (searchParams.من) where.createdAt.gte = new Date(searchParams.من);
    if (searchParams.إلى) {
      const ن = new Date(searchParams.إلى);
      ن.setHours(23, 59, 59, 999);
      where.createdAt.lte = ن;
    }
  }

  const [سجلات, مستخدمون] = await Promise.all([
    prisma.activityLog.findMany({
      where,
      include: { user: { select: { name: true } } },
      orderBy: { createdAt: "desc" },
      take: 500,
    }),
    prisma.user.findMany({ select: { id: true, name: true }, orderBy: { name: "asc" } }),
  ]);

  const بيانات = سجلات.map((س) => ({
    id: س.id,
    العملية: س.action,
    بواسطة: س.user.name,
    نوع_الكيان: س.entityType,
    معرف_الكيان: س.entityId,
    التاريخ: س.createdAt.toISOString(),
    التفاصيل: س.details,
  }));

  return (
    <div>
      <ترويسة_الصفحة
        العنوان={t("activity.title")}
        الوصف={t("activity.subtitle")}
      />
      <سجل_العمليات_العرض
        البيانات={بيانات}
        المستخدمون={مستخدمون}
        القيم={searchParams}
      />
    </div>
  );
}
