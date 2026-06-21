import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { المستخدم_الحالي } from "@/lib/session";

/** تقديم شعار الشركة من الإعدادات — يُستخدم في الفواتير بدلاً من embed base64 */
export async function GET() {
  const م = await المستخدم_الحالي();
  if (!م) return new NextResponse(null, { status: 401 });

  const إعداد = await prisma.setting.findUnique({ where: { key: "شعار_الشركة" } });
  const قيمة = إعداد?.value ?? "";
  if (!قيمة || !قيمة.startsWith("data:image/")) {
    return new NextResponse(null, { status: 404 });
  }

  const [header, data] = قيمة.split(",");
  const mime = header.replace("data:", "").replace(";base64", "");
  const buffer = Buffer.from(data, "base64");

  return new NextResponse(buffer, {
    headers: {
      "Content-Type": mime,
      "Cache-Control": "private, max-age=86400",
    },
  });
}
