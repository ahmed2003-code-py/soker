import { z } from "zod";
import { تحليل_مبلغ } from "@/lib/money";

const مبلغ_موجب = z
  .union([z.string(), z.number()])
  .transform((v) => تحليل_مبلغ(v))
  .refine((v) => v !== null, { message: "المبلغ غير صالح" })
  .refine((v) => Number(v) > 0, { message: "المبلغ يجب أن يكون أكبر من صفر" });

export const مخطط_حركة_خزنة = z.object({
  التاريخ: z.string().min(1, "التاريخ مطلوب"),
  النوع: z.enum(["INCOME", "EXPENSE"]),
  المبلغ: مبلغ_موجب,
  معرف_الحساب: z.number().int().positive("اختر الحساب"),
  معرف_حساب_فرعي: z.number().int().positive().optional().nullable(),
  البيان: z.string().trim().min(1, "البيان مطلوب"),
  معرف_الطرف: z.number().int().positive().optional().nullable(),
  اسم_الطرف_الخارجي: z.string().trim().optional().nullable(),
  رقم_الفاتورة: z.string().trim().optional().nullable(),
  طريقة_الدفع: z.string().trim().optional().nullable(),
});

export type مدخلات_حركة_خزنة = z.infer<typeof مخطط_حركة_خزنة>;
