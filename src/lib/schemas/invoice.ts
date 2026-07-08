import { z } from "zod";
import { تحليل_مبلغ } from "@/lib/money";

const رقم_اختياري = z
  .union([z.string(), z.number(), z.null(), z.literal("")])
  .optional()
  .transform((v) => (v === null || v === undefined || v === "" ? null : تحليل_مبلغ(v)));

const رقم_غير_سالب = z
  .union([z.string(), z.number(), z.literal("")])
  .transform((v) => (v === "" ? "0" : تحليل_مبلغ(v)))
  .refine((v) => v !== null && Number(v) >= 0, { message: "قيمة غير صالحة" });

export const مخطط_بند = z.object({
  اللون: z.string().trim().min(1, "اللون مطلوب"),
  الشركة: z.string().trim().optional().nullable(),
  الكمية: رقم_غير_سالب,
  الوزن: رقم_غير_سالب,
  التصنيف: z.string().trim().min(1, "التصنيف مطلوب"),
  السعر: رقم_اختياري,
  ملاحظات: z.string().trim().optional().nullable(),
});

export const مخطط_دفعة_الفاتورة = z.object({
  المبلغ: z
    .union([z.string(), z.number()])
    .transform((v) => تحليل_مبلغ(v))
    .refine((v) => v !== null && Number(v) > 0, { message: "مبلغ الدفعة يجب أن يكون أكبر من صفر" }),
  معرف_الحساب: z.number().int().positive("اختر حساب الخزنة"),
  معرف_حساب_فرعي: z.number().int().positive().optional().nullable(),
  ملاحظات: z.string().trim().optional().nullable(),
});

export const مخطط_فاتورة = z.object({
  نوع_الفاتورة: z.enum(["SALE", "CUSTOMER_RETURN", "PURCHASE", "SUPPLIER_RETURN"]).default("SALE"),
  مرجع_خارجي: z.string().trim().optional().nullable(), // رقم فاتورة المورد (للجاية)
  رقم_الفاتورة_المحدد: z.number().int().positive().optional().nullable(),
  معرف_العميل: z.number().int().positive("اختر الطرف"),
  الهاتف: z.string().trim().optional().nullable(),
  التاريخ: z.string().min(1, "التاريخ مطلوب"),
  ملاحظات: z.string().trim().optional().nullable(),
  البنود: z.array(مخطط_بند).min(1, "أضف بنداً واحداً على الأقل"),
  الدفعة: مخطط_دفعة_الفاتورة.optional().nullable(),
});

export type مدخلات_فاتورة = z.infer<typeof مخطط_فاتورة>;
export type مدخلات_بند = z.infer<typeof مخطط_بند>;
