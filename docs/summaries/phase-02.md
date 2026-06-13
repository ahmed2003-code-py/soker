### ✅ Phase 2 Summary: المصادقة والأدوار وسجل العمليات

**- What was done:**
- **المصادقة:** Auth.js (NextAuth v4) + Credentials + bcryptjs. صفحة `/login` عربية بتحقق ورسائل خطأ عامة. الجلسة (JWT) تحمل `id, name, username, role, mustChangePassword`.
- **الحماية:** `middleware.ts` يحمي كل المسارات الداخلية (غير المصرّح → `/login`)، ويُجبر تغيير كلمة المرور المؤقتة (`mustChangePassword` → `/change-password`).
- **التفويض:** دالة موحّدة `يستطيع(الدور, الإجراء)` + `تحقق_الصلاحية` تُفرض على **كل** Server Action في الخادم بغضّ النظر عن الواجهة. READONLY: قراءة فقط؛ ACCOUNTANT: قراءة/كتابة/حذف؛ ADMIN: الكل + إدارة المستخدمين/الإعدادات.
- **المستخدمون `/users` (مدير فقط):** قائمة + إضافة/تعديل/تعطيل + إعادة تعيين كلمة المرور (تُجبر التغيير لاحقاً)، الدور عبر قائمة اختيار، لا تُكشف الهاشات. حواجز: لا يُعطَّل/يُنزَّل آخر مدير نشط.
- **تغيير كلمة المرور `/change-password`:** يتحقق من الحالية، يضبط الجديدة ويلغي الإجبار ثم يعيد تسجيل الدخول (لتحديث الـ JWT).
- **المساءلة + سجل العمليات:**
  - `تسجيل_عملية(tx, …)` يُكتب داخل نفس الـ `$transaction` لكل create/update/delete (append-only).
  - طوابع `createdBy/updatedBy` تُؤخذ من الجلسة دائماً (لا من العميل).
  - مكوّن `سطر_المساءلة` ("أُضيف/آخر تعديل بواسطة …") + مكوّن `سجل_التغييرات` (المسار الزمني لأي سجل) عبر إجراء `جلب_سجل_الكيان`.
  - صفحة `/activity-log` (مدير فقط) قابلة للتصفية حسب **الشخص** (أحمد/محمود)، نوع الكيان، ونطاق التاريخ.

**- Files added/changed:** `src/lib/{auth,session,authz,activity,result}.ts, src/types/next-auth.d.ts, src/middleware.ts, src/app/api/auth/[...nextauth]/route.ts, src/app/login/{page,form}.tsx, src/app/change-password/{page,form}.tsx, src/app/users/{page,client,actions,schema}.ts(x), src/app/activity-log/{page,client,actions}.ts(x), src/components/{record-history,accountability-line}.tsx, scripts/selftest-phase2.ts, tsconfig.json (استثناء scripts من بناء الإنتاج)`.

**- How to run & test:**
```bash
npx tsx scripts/selftest-phase2.ts   # ✅ الصلاحيات + كلمة المرور + سجل العمليات + الطوابع
npx next build                        # ✅ يبني كل المسارات بلا أخطاء
npm run dev                           # /login بـ ahmed/Soker@2026 → يُجبر تغيير الكلمة
```
- اختبار القبول: المالكان يدخلان كمديرين (تحقّق منطقي عبر bcrypt)؛ create/edit/delete يضبط الطوابع ويكتب صفّ سجل عمليات؛ السجل يُصفّى لأحمد فقط أو محمود فقط (تحقّق آلي).

**- Business rules / decisions / assumptions (قرارات اتخذتها):**
1. **[قرار] جلسة JWT** (لا قاعدة جلسات) — أبسط وأنسب لـ Railway. مدة 12 ساعة.
2. **[قرار] بعد تغيير كلمة المرور يُعاد تسجيل الدخول** لتحديث الـ JWT (بدل تحديث صامت يتطلب SessionProvider).
3. **[افتراض] User بلا طوابع createdBy/updatedBy** لأن الخطة لم تُدرجه ضمن كيانات المساءلة؛ لكن كل تغييرات المستخدمين تُسجَّل في سجل العمليات.
4. **[افتراض] صلاحيات الأدوار:** ACCOUNTANT يكتب/يحذف سجلات الأعمال لكن لا يدير المستخدمين/الإعدادات؛ READONLY قراءة فقط بالكامل.

**- Missing / deferred:**
- اختبار دخول حقيقي عبر HTTP يُجرى بعد توفّر الواجهة/اللوحة (المرحلة 3).
- عرض "أُضيف/آخر تعديل بواسطة" على سجلات الأعمال يُربط فعلياً مع كل وحدة (المراحل 4+).

**- Questions I need answered before continuing:** لا شيء.
