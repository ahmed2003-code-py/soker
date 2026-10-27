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
  // ── المخزن (يُتجاهَل تماماً وقت إقفال متغير التشغيل) ──
  معرف_اللط: z.number().int().positive().optional().nullable(), // الصرف/المرتجع: من أي لط
  رقم_اللط: z.string().trim().optional().nullable(),            // الوارد: رقم اللط (تلقائي لو فاضي)
});

export const مخطط_بند_دفعة_فاتورة = z.object({
  المبلغ: z
    .union([z.string(), z.number()])
    .transform((v) => تحليل_مبلغ(v))
    .refine((v) => v !== null && Number(v) > 0, { message: "مبلغ وسيلة الدفع يجب أن يكون أكبر من صفر" }),
  معرف_الحساب: z.number().int().positive("اختر حساب الخزنة"),
  معرف_حساب_فرعي: z.number().int().positive().optional().nullable(),
});

/** دفعة فاتورة فورية — وسيلة دفع واحدة أو موزّعة على أكثر من وسيلة (بحد أقصى 4). */
export const مخطط_دفعة_الفاتورة = z.object({
  بنود: z.array(مخطط_بند_دفعة_فاتورة).min(1, "أضف وسيلة دفع واحدة على الأقل").max(4, "٤ وسائل دفع كحد أقصى لكل فاتورة"),
  ملاحظات: z.string().trim().optional().nullable(),
});

/** مصروف إضافي على الفاتورة (نقل، تحميل، …) — يُضاف للإجمالي النهائي. */
export const مخطط_مصروف_إضافي = z.object({
  البيان: z.string().trim().min(1, "بيان المصروف الإضافي مطلوب").max(200, "بيان المصروف طويل جداً"),
  المبلغ: z
    .union([z.string(), z.number()])
    .transform((v) => تحليل_مبلغ(v))
    .refine((v) => v !== null && Number(v) > 0, { message: "مبلغ المصروف الإضافي يجب أن يكون أكبر من صفر" }),
});

export const مخطط_مصروفات_إضافية = z
  .array(مخطط_مصروف_إضافي)
  .max(20, "٢٠ مصروفاً إضافياً كحد أقصى لكل فاتورة")
  .optional()
  .default([]);

/**
 * تحصيل فاتورة زائر معلّقة لاحقاً (وسيلة واحدة أو موزّعة حتى 4)، بتاريخ التحصيل الفعلي.
 *  - عادي: المبلغ = المتبقي بالكامل.
 *  - إنهاء: المبلغ ≤ المتبقي (ويجوز صفر لو فيه تحصيل سابق) والباقي مسامَح فيه — تُقفل الفاتورة.
 */
export const مخطط_تحصيل_فاتورة = z
  .object({
    التاريخ: z.string().min(1, "تاريخ التحصيل مطلوب"),
    بنود: z.array(مخطط_بند_دفعة_فاتورة).max(4, "٤ وسائل دفع كحد أقصى").default([]),
    ملاحظات: z.string().trim().optional().nullable(),
    إنهاء: z.boolean().optional().default(false),
  })
  .refine((x) => x.إنهاء || x.بنود.length > 0, { message: "أضف وسيلة دفع واحدة على الأقل" });

export const مخطط_فاتورة = z.object({
  نوع_الفاتورة: z.enum(["SALE", "PURCHASE", "SUPPLIER_RETURN"]).default("SALE"),
  // وجهة بضاعة فاتورة الشراء: المخزن (افتراضي) أو توريد مباشر للعميل (بلا أثر مخزني)
  وجهة_البضاعة: z.enum(["WAREHOUSE", "DIRECT"]).optional().nullable(),
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
  المصروفات_الإضافية: مخطط_مصروفات_إضافية,
});

/** بند الفاتورة المباشرة: نفس البند بسعرين — سعر الشراء من المورد وسعر البيع للعميل. */
export const مخطط_بند_مباشر = مخطط_بند.extend({
  سعر_المورد: رقم_اختياري, // السعر اللي بندفعه للمورد
  // السعر (الموروث من مخطط_بند) = سعر البيع للعميل
});

/**
 * فاتورة مباشرة (مورد ← عميل): البضاعة تروح من المورد للعميل على طول.
 * إدخال واحد ⇒ فاتورتان مربوطتان: شراء على المورد (دائن بسعر المورد)
 * + بيع على العميل (مدين بسعر العميل). الفرق = ربح المعاملة.
 * لكل جهة دفعة اختيارية مستقلة.
 */
export const مخطط_فاتورة_مباشرة = z.object({
  معرف_المورد: z.number().int().positive("اختر المورد"),
  معرف_العميل: z.number().int().positive("اختر العميل"),
  مرجع_خارجي: z.string().trim().optional().nullable(), // رقم فاتورة المورد
  رقم_الفاتورة_المحدد: z.number().int().positive().optional().nullable(), // رقم فاتورة العميل
  الهاتف: z.string().trim().optional().nullable(),
  التاريخ: z.string().min(1, "التاريخ مطلوب"),
  ملاحظات: z.string().trim().optional().nullable(),
  البنود: z.array(مخطط_بند_مباشر).min(1, "أضف بنداً واحداً على الأقل"),
  دفعة_العميل: مخطط_دفعة_الفاتورة.optional().nullable(), // تحصيل من العميل
  دفعة_المورد: مخطط_دفعة_الفاتورة.optional().nullable(), // صرف للمورد
  مصروفات_المورد: مخطط_مصروفات_إضافية, // تُضاف لفاتورة الشراء (المستحق للمورد)
  مصروفات_العميل: مخطط_مصروفات_إضافية, // تُضاف لفاتورة البيع (مديونية العميل)
});

export type مدخلات_فاتورة = z.infer<typeof مخطط_فاتورة>;
export type مدخلات_فاتورة_مباشرة = z.infer<typeof مخطط_فاتورة_مباشرة>;
export type مدخلات_بند = z.infer<typeof مخطط_بند>;
export type مدخلات_مصروف_إضافي = z.infer<typeof مخطط_مصروف_إضافي>;
