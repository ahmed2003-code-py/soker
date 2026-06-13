import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { المستخدم_الحالي } from "@/lib/session";

/** تقديم صورة الشيك المخزّنة في Postgres */
export async function GET(
  _req: Request,
  { params }: { params: { id: string } }
) {
  const م = await المستخدم_الحالي();
  if (!م) return NextResponse.json({ خطأ: "غير مصرّح" }, { status: 401 });

  const شيك = await prisma.cheque.findUnique({
    where: { id: Number(params.id) },
    select: { imageData: true, imageMime: true },
  });
  if (!شيك?.imageData) {
    return NextResponse.json({ خطأ: "لا توجد صورة" }, { status: 404 });
  }
  return new NextResponse(Buffer.from(شيك.imageData), {
    headers: {
      "Content-Type": شيك.imageMime || "image/jpeg",
      "Cache-Control": "private, max-age=3600",
    },
  });
}
