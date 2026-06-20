import { z } from "zod";
import { تحليل_مبلغ } from "@/lib/money";

const مبلغ_اختياري = z
  .union([z.string(), z.number(), z.null()])
  .optional()
  .transform((v) => (v === null || v === undefined || v === "" ? null : تحليل_مبلغ(v)))
  .refine((v) => v === null || v !== null, { message: "قيمة غير صالحة" });

export const مخطط_طرف = z.object({
  الاسم: z.string().trim().min(2, "الاسم مطلوب"),
  الهاتف: z.string().trim().optional().nullable(),
  العنوان: z.string().trim().optional().nullable(),
  النوع: z.enum(["CUSTOMER", "SUPPLIER"]),
  حد_الائتمان: مبلغ_اختياري,
  ملاحظات: z.string().trim().optional().nullable(),
});

export type مدخلات_طرف = z.infer<typeof مخطط_طرف>;

export const مخطط_دفعة = z
  .object({
    معرف_الطرف: z.number().int().positive(),
    التاريخ: z.string().min(1, "التاريخ مطلوب"),
    مبلغ_له: مبلغ_اختياري,
    مبلغ_عليه: مبلغ_اختياري,
    معرف_حساب_الخزنة: z.number().int().positive("اختر حساب الخزنة"),
    رقم_الفاتورة: z.string().trim().optional().nullable(),
  })
  .refine(
    (d) => Number(d.مبلغ_له ?? 0) > 0 || Number(d.مبلغ_عليه ?? 0) > 0,
    { message: "أدخل مبلغاً في خانة له أو عليه" }
  );

export const مخطط_حركة_يدوية = z.object({
  معرف_الطرف: z.number().int().positive(),
  التاريخ: z.string().min(1, "التاريخ مطلوب"),
  البيان: z.string().trim().min(1, "البيان مطلوب"),
  مدين: z
    .union([z.string(), z.number(), z.literal("")])
    .transform((v) => (v === "" ? "0" : تحليل_مبلغ(v)))
    .refine((v) => v !== null, { message: "قيمة مدين غير صالحة" }),
  دائن: z
    .union([z.string(), z.number(), z.literal("")])
    .transform((v) => (v === "" ? "0" : تحليل_مبلغ(v)))
    .refine((v) => v !== null, { message: "قيمة دائن غير صالحة" }),
});
