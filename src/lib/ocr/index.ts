/**
 * واجهة خدمة OCR قابلة للاستبدال (Tesseract افتراضياً، أو سحابية عبر env).
 * OCR_ENGINE = "tesseract" | "ocrspace"
 */
export interface خدمة_OCR {
  الاسم: string;
  استخرج(صورة: Buffer, mime: string): Promise<{ نص: string; ثقة: number }>;
}

/** Tesseract.js محلي (ara+eng) */
class خدمة_Tesseract implements خدمة_OCR {
  الاسم = "tesseract";
  async استخرج(صورة: Buffer): Promise<{ نص: string; ثقة: number }> {
    const { createWorker } = await import("tesseract.js");
    // langPath محلي اختياري (TESSDATA_PATH) لتفادي الاعتماد على CDN وقت التشغيل؛
    // وإلا يُنزِّل بيانات اللغة من CDN (يتطلب شبكة خارجية — متاحة على Railway).
    const worker = await createWorker(["ara", "eng"], 1, {
      langPath: process.env.TESSDATA_PATH || undefined,
      cachePath: process.env.TESSERACT_CACHE || undefined,
    });
    try {
      const { data } = await worker.recognize(صورة);
      return { نص: data.text ?? "", ثقة: (data.confidence ?? 0) / 100 };
    } finally {
      await worker.terminate();
    }
  }
}

/** OCR.space سحابي (لخط اليد الأفضل) — يتطلب OCRSPACE_API_KEY */
class خدمة_OCRSpace implements خدمة_OCR {
  الاسم = "ocrspace";
  async استخرج(صورة: Buffer, mime: string): Promise<{ نص: string; ثقة: number }> {
    const key = process.env.OCRSPACE_API_KEY;
    if (!key) throw new Error("OCRSPACE_API_KEY غير مضبوط");
    const fd = new FormData();
    fd.append("base64Image", `data:${mime};base64,${صورة.toString("base64")}`);
    fd.append("language", "ara");
    fd.append("OCREngine", "2");
    const res = await fetch("https://api.ocr.space/parse/image", {
      method: "POST",
      headers: { apikey: key },
      body: fd,
    });
    const data = await res.json();
    const نص = data?.ParsedResults?.[0]?.ParsedText ?? "";
    return { نص, ثقة: 0.7 };
  }
}

export function اختر_خدمة_OCR(): خدمة_OCR {
  const محرك = (process.env.OCR_ENGINE || "tesseract").toLowerCase();
  if (محرك === "ocrspace") return new خدمة_OCRSpace();
  return new خدمة_Tesseract();
}
