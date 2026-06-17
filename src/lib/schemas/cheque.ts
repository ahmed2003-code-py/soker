import { z } from "zod";
import { تحليل_مبلغ } from "@/lib/money";

export const مخطط_شيك = z.object({
  اسم_المدين: z.string().trim().min(1, "اسم المدين مطلوب"),
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
  الحالة: z.enum(["PENDING", "COLLECTED", "BOUNCED"]).default("PENDING"),
  ملاحظات: z.string().trim().optional().nullable(),
  // الصورة (المرحلة 8): base64 + النوع
  صورة_base64: z.string().optional().nullable(),
  صورة_mime: z.string().optional().nullable(),
  نص_OCR: z.string().optional().nullable(),
});

export type مدخلات_شيك = z.infer<typeof مخطط_شيك>;
