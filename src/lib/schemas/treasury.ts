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
  // العميل يتحكم بالطرف صراحةً (فورم الخزنة) → يسمح بفك الربط عن طرف مسجّل.
  // تُترك غير مُرسلة من صفحة الطرف حيث الطرف ضمني ولا يُفك تلقائياً.
  صريح_الطرف: z.boolean().optional(),
  // ── ربط المصروف ببند مصروف شهري (تصنيف فقط — بلا أثر محاسبي إضافي) ──
  معرف_بند_مصروف_شهري: z.number().int().positive().optional().nullable(),
  // تأكيد تجاوز المتاح في البند (الزيادة تترحّل للشهر الجاي)
  تأكيد_تجاوز_المصروف: z.boolean().optional(),
});

export type مدخلات_حركة_خزنة = z.infer<typeof مخطط_حركة_خزنة>;

export const مخطط_تحويل_خزنة = z
  .object({
    التاريخ: z.string().min(1, "التاريخ مطلوب"),
    المبلغ: مبلغ_موجب,
    من_الحساب: z.number().int().positive("اختر الحساب المصدر"),
    إلى_الحساب: z.number().int().positive("اختر الحساب الوجهة"),
    معرف_حساب_فرعي_من: z.number().int().positive().optional().nullable(),
    معرف_حساب_فرعي_إلى: z.number().int().positive().optional().nullable(),
    البيان: z.string().trim().optional(),
  })
  .refine((d) => d.من_الحساب !== d.إلى_الحساب, {
    message: "لا يمكن التحويل من الحساب لنفسه",
    path: ["إلى_الحساب"],
  });

export const مخطط_دفع_مباشر = z
  .object({
    التاريخ: z.string().min(1, "التاريخ مطلوب"),
    المبلغ: مبلغ_موجب,
    // العميل: إمّا مسجّل (معرف_العميل) أو عميل عابر بالاسم (اسم_العميل_الخارجي)
    معرف_العميل: z.number().int().positive().optional().nullable(),
    اسم_العميل_الخارجي: z.string().trim().optional().nullable(),
    معرف_المورد: z.number().int().positive("اختر المورد"),
    معرف_الحساب: z.number().int().positive("اختر حساب الخزنة"),
    معرف_حساب_فرعي: z.number().int().positive().optional().nullable(),
    البيان: z.string().trim().optional(),
  })
  .refine((d) => !!d.معرف_العميل || !!d.اسم_العميل_الخارجي?.trim(), {
    message: "اختر العميل أو اكتب اسمه",
    path: ["معرف_العميل"],
  });

export const مخطط_تعديل_دفع_مباشر = z.object({
  التاريخ: z.string().min(1, "التاريخ مطلوب"),
  المبلغ: مبلغ_موجب,
  معرف_الحساب: z.number().int().positive("اختر حساب الخزنة"),
  معرف_حساب_فرعي: z.number().int().positive().optional().nullable(),
  البيان: z.string().trim().optional(),
});

// ─── دفعة موزّعة: إجمالي واحد موزّع على عدة وسائل/حسابات ───────────────────────
const بند_دفع_موزّع = z.object({
  معرف_الحساب: z.number().int().positive("اختر حساب الخزنة"),
  معرف_حساب_فرعي: z.number().int().positive().optional().nullable(),
  المبلغ: مبلغ_موجب,
});

export const مخطط_دفعة_موزعة = z
  .object({
    // الطرف: مسجّل (معرف_الطرف) أو خارجي بالاسم أو بدون
    معرف_الطرف: z.number().int().positive().optional().nullable(),
    اسم_الطرف_الخارجي: z.string().trim().optional().nullable(),
    // الاتجاه صريح (إيراد=تحصيل/له، مصروف=صرف/عليه) — إن غاب يُشتق من نوع الطرف المسجّل
    النوع: z.enum(["INCOME", "EXPENSE"]).optional(),
    التاريخ: z.string().min(1, "التاريخ مطلوب"),
    الإجمالي: مبلغ_موجب,
    البيان: z.string().trim().optional().nullable(),
    رقم_الفاتورة: z.string().trim().optional().nullable(),
    بنود: z.array(بند_دفع_موزّع).min(1, "أضف بند دفع واحداً على الأقل"),
  })
  .refine(
    (d) => {
      const مجموع = d.بنود.reduce((s, ب) => s + Number(ب.المبلغ), 0);
      return Math.abs(مجموع - Number(d.الإجمالي)) < 0.005;
    },
    { message: "مجموع المبالغ الموزّعة يجب أن يساوي الإجمالي تماماً", path: ["بنود"] }
  )
  .refine((d) => !!d.معرف_الطرف || !!d.النوع, {
    message: "حدّد النوع (إيراد/مصروف) عند عدم اختيار طرف مسجّل",
    path: ["النوع"],
  });

export type مدخلات_دفعة_موزعة = z.infer<typeof مخطط_دفعة_موزعة>;
