// جلسة الاختبار: نفس واجهة src/lib/session.ts — المستخدم من globalThis.__مستخدم_الاختبار
exports.المستخدم_الحالي = async () => globalThis.__مستخدم_الاختبار ?? null;
exports.اطلب_المستخدم = async () => {
  const م = globalThis.__مستخدم_الاختبار;
  if (!م) throw new Error("غير مصرّح: يجب تسجيل الدخول");
  return م;
};
