import { z } from "zod";
import { تحليل_مبلغ } from "@/lib/money";

export const مخطط_شيك = z.object({
  // اختياري: للوارد يُشتق من اسم العميل (محوّل من) عند تركه فارغاً
  اسم_المدين: z.string().trim().optional().nullable(),
  المبلغ: z
    .union([z.string(), z.number()])
    .transform((v) => تحليل_مبلغ(v))
    .refine((v) => v !== null && Number(v) > 0, { message: "المبلغ يجب أن يكون أكبر من صفر" }),
  المستفيد: z.string().trim().optional().nullable(),
  محول_من: z.string().trim().optional().nullable(),
  اسم_البنك: z.string().trim().optional().nullable(),
  تاريخ_الاستحقاق: z.string().min(1, "تاريخ الاستحقاق مطلوب"),
  رقم_الشيك: z.string().trim().optional().nullable(),
  الاتجاه: z.enum(["INCOMING", "OUTGOING"]).default("INCOMING"),
  الحالة: z
    .enum(["REGISTERED", "PENDING", "DEPOSITED", "ENDORSED", "COLLECTED", "BOUNCED", "CANCELLED"])
    .default("REGISTERED"),
  معرف_الطرف: z.number().int().positive().optional().nullable(),
  معرف_الدفتر: z.number().int().positive().optional().nullable(),
  رقم_الورقة: z.number().int().positive().optional().nullable(),
  ملاحظات: z.string().trim().optional().nullable(),
  // الصورة (المرحلة 8): base64 + النوع
  صورة_base64: z.string().optional().nullable(),
  صورة_mime: z.string().optional().nullable(),
  نص_OCR: z.string().optional().nullable(),
  // ── شيك افتتاحي (محسوب ضمن الرصيد الافتتاحي) — يُسجَّل في موديول الشيكات فقط بلا حركة عند الإدخال ──
  افتتاحي: z.boolean().optional().default(false),
  // للشيك الافتتاحي «مودع/محصّل»: حساب الخزنة الذي يقيم فيه الشيك وقت البداية (لعكسه عند خروجه)
  معرف_حساب_افتتاحي: z.number().int().positive().optional().nullable(),
  معرف_حساب_فرعي_افتتاحي: z.number().int().positive().optional().nullable(),
  // للشيك الافتتاحي «مظهّر لمورد»: المورد المُظهَّر له
  معرف_مورد_افتتاحي: z.number().int().positive().optional().nullable(),
});

export type مدخلات_شيك = z.infer<typeof مخطط_شيك>;
