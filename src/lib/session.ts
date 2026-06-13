import { getServerSession } from "next-auth";
import { خيارات_المصادقة } from "@/lib/auth";

export type المستخدم_الجلسة = {
  id: number;
  name: string;
  username: string;
  role: import("@prisma/client").Role;
  mustChangePassword: boolean;
};

/** المستخدم الحالي من الجلسة (أو null) */
export async function المستخدم_الحالي(): Promise<المستخدم_الجلسة | null> {
  const جلسة = await getServerSession(خيارات_المصادقة);
  return (جلسة?.user as المستخدم_الجلسة) ?? null;
}

/** يُرجع المستخدم أو يرمي خطأ — يُستخدم في الإجراءات (لا عملية بدون مستخدم) */
export async function اطلب_المستخدم(): Promise<المستخدم_الجلسة> {
  const م = await المستخدم_الحالي();
  if (!م) throw new Error("غير مصرّح: يجب تسجيل الدخول");
  return م;
}
