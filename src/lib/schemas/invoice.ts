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
  نوع_البند: z.enum(["SALE", "RETURN"]).default("SALE"),
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
  نوع_الفاتورة: z.enum(["SALE", "PURCHASE", "SUPPLIER_RETURN"]).default("SALE"),
  مرجع_خارجي: z.string().trim().optional().nullable(),
  رقم_الفاتورة_المحدد: z.number().int().positive().optional().nullable(),
  معرف_العميل: z.number().int().positive().optional().nullable(), // null = عميل زائر/مؤقت
  اسم_الزائر: z.string().trim().optional().nullable(),           // للطباعة عند الزائر / اسم العميل المؤقت
  عميل_مؤقت: z.boolean().optional(),                             // إنشاء حساب مؤقت له رصيد متابَع (بدل الزائر بلا حساب)
  الهاتف: z.string().trim().optional().nullable(),
  التاريخ: z.string().min(1, "التاريخ مطلوب"),
  ملاحظات: z.string().trim().optional().nullable(),
  البنود: z.array(مخطط_بند).min(1, "أضف بنداً واحداً على الأقل"),
  الدفعة: مخطط_دفعة_الفاتورة.optional().nullable(),
  غير_مسعّرة: z.boolean().optional(), // فاتورة تُحفظ بلا أسعار (بلا أثر مالي) حتى تُسعَّر لاحقاً
});

/**
 * فاتورة مباشرة (مورد ← عميل): البضاعة تروح من المورد للعميل على طول.
 * إدخال واحد ⇒ فاتورتان مربوطتان: شراء على المورد (دائن) + بيع على العميل (مدين)
 * بنفس البنود ونفس السعر. لكل جهة دفعة اختيارية مستقلة.
 */
export const مخطط_فاتورة_مباشرة = z.object({
  معرف_المورد: z.number().int().positive("اختر المورد"),
  معرف_العميل: z.number().int().positive("اختر العميل"),
  مرجع_خارجي: z.string().trim().optional().nullable(), // رقم فاتورة المورد
  رقم_الفاتورة_المحدد: z.number().int().positive().optional().nullable(), // رقم فاتورة العميل
  الهاتف: z.string().trim().optional().nullable(),
  التاريخ: z.string().min(1, "التاريخ مطلوب"),
  ملاحظات: z.string().trim().optional().nullable(),
  البنود: z.array(مخطط_بند).min(1, "أضف بنداً واحداً على الأقل"),
  دفعة_العميل: مخطط_دفعة_الفاتورة.optional().nullable(), // تحصيل من العميل
  دفعة_المورد: مخطط_دفعة_الفاتورة.optional().nullable(), // صرف للمورد
});

export type مدخلات_فاتورة = z.infer<typeof مخطط_فاتورة>;
export type مدخلات_فاتورة_مباشرة = z.infer<typeof مخطط_فاتورة_مباشرة>;
export type مدخلات_بند = z.infer<typeof مخطط_بند>;
