"use server";
import { اطلب_المستخدم } from "@/lib/session";
import { سجل_الكيان, type نوع_الكيان } from "@/lib/activity";

/** جلب المسار الزمني (التاريخ/الـ audit trail) لكيان محدد */
export async function جلب_سجل_الكيان(نوع: نوع_الكيان, معرف: number) {
  await اطلب_المستخدم();
  const سجلات = await سجل_الكيان(نوع, معرف);
  return سجلات.map((س) => ({
    id: س.id,
    العملية: س.action,
    بواسطة: س.user.name,
    التاريخ: س.createdAt.toISOString(),
    التفاصيل: س.details,
  }));
}
