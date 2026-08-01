import { NextResponse } from "next/server";
import { المستخدم_الحالي } from "@/lib/session";
import { اختر_خدمة_OCR } from "@/lib/ocr";
import { حلّل_نص_الشيك } from "@/lib/ocr/parse";

export const runtime = "nodejs";
export const maxDuration = 60;

/** POST صورة الشيك (multipart) → استخراج حقول منظّمة + النص الخام */
export async function POST(req: Request) {
  const م = await المستخدم_الحالي();
  if (!م) return NextResponse.json({ خطأ: "غير مصرّح" }, { status: 401 });

  try {
    const form = await req.formData();
    const ملف = form.get("image");
    // فحص بالسلوك بدل `instanceof File` — لأن `File` قد لا يكون global في بعض بيئات Node
    if (!ملف || typeof ملف === "string" || typeof (ملف as Blob).arrayBuffer !== "function") {
      return NextResponse.json({ خطأ: "لم تُرفق صورة" }, { status: 400 });
    }
    const blob = ملف as Blob;
    const buffer = Buffer.from(await blob.arrayBuffer());

    const خدمة = اختر_خدمة_OCR();
    let نص = "";
    let ثقة = 0;
    try {
      const ناتج = await خدمة.استخرج(buffer, blob.type);
      نص = ناتج.نص;
      ثقة = ناتج.ثقة;
    } catch (e) {
      // فشل المحرك: لا نُعطّل الإدخال اليدوي — نُرجِع حقولاً فارغة
      console.error("OCR engine failed:", e);
      return NextResponse.json({ حقول: {}, نص_OCR: "", ثقة: 0, محرك: خدمة.الاسم });
    }

    const حقول = حلّل_نص_الشيك(نص);
    return NextResponse.json({ حقول, نص_OCR: نص, ثقة, محرك: خدمة.الاسم });
  } catch (e) {
    console.error(e);
    return NextResponse.json({ خطأ: "تعذّر معالجة الصورة" }, { status: 500 });
  }
}
