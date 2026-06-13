import { z } from "zod";

export const مخطط_إنشاء_مستخدم = z.object({
  الاسم: z.string().trim().min(2, "الاسم مطلوب (حرفان على الأقل)"),
  اسم_المستخدم: z
    .string()
    .trim()
    .min(3, "اسم المستخدم 3 أحرف على الأقل")
    .regex(/^[a-zA-Z0-9_.]+$/, "أحرف لاتينية وأرقام فقط"),
  كلمة_المرور: z.string().min(6, "كلمة المرور 6 أحرف على الأقل"),
  الدور: z.enum(["ADMIN", "ACCOUNTANT", "READONLY"]),
});

export const مخطط_تعديل_مستخدم = z.object({
  الاسم: z.string().trim().min(2, "الاسم مطلوب"),
  الدور: z.enum(["ADMIN", "ACCOUNTANT", "READONLY"]),
});

export const مخطط_تغيير_كلمتي = z
  .object({
    الحالية: z.string().min(1, "أدخل كلمة المرور الحالية"),
    الجديدة: z.string().min(6, "كلمة المرور الجديدة 6 أحرف على الأقل"),
    التأكيد: z.string(),
  })
  .refine((d) => d.الجديدة === d.التأكيد, {
    message: "كلمتا المرور غير متطابقتين",
    path: ["التأكيد"],
  });

export type مدخلات_إنشاء_مستخدم = z.infer<typeof مخطط_إنشاء_مستخدم>;
export type مدخلات_تعديل_مستخدم = z.infer<typeof مخطط_تعديل_مستخدم>;
