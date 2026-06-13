### ✅ Phase 3 Summary: هيكل التطبيق والتخطيط والتنقل

**- What was done:**
- **تخطيط مصادَق** عبر مجموعة مسارات `(app)/layout.tsx`: يجلب المستخدم، يحوّل غير المصرّح إلى `/login` ومن عليه تغيير كلمة المرور إلى `/change-password`، ثم يعرض الهيكل.
- **هيكل التطبيق** `هيكل_التطبيق`:
  - سطح المكتب: شريط جانبي **يمين** (RTL) قابل للطي + شريط علوي.
  - الموبايل: درج (hamburger) + شريط سفلي لأهم 4 وجهات.
- **الشريط الجانبي:** الرئيسية، الفواتير، العملاء، الموردون، الخزنة، الشيكات، التقارير، المستخدمون، سجل العمليات — مع حالة نشطة واضحة.
- **التحكم بالرؤية حسب الدور:** `المستخدمون` و`سجل العمليات` يظهران للمديرين فقط (`عناصر_مرئية(الدور)`).
- **الشريط العلوي:** حقل بحث موحّد (واجهة فقط الآن — يُفعّل في المرحلة 11) + قائمة مستخدم (الاسم، شارة الدور، تغيير كلمة المرور، تسجيل الخروج).
- **صفحات نائبة** لكل وجهة (dashboard/invoices/customers/suppliers/treasury/cheques/reports) بترويسة، فالتنقل قابل للنقر بالكامل.
- **DataTable** مُستعرَض ببيانات حقيقية في `/users` و`/activity-log` (ترقيم/فرز/بحث/فراغ/تحميل + بطاقات على الموبايل).
- نقل `/users` و`/activity-log` إلى `(app)` لتطبيق الهيكل عليهما.

**- Files added/changed:** `src/app/(app)/layout.tsx, src/app/(app)/{dashboard,invoices,customers,suppliers,treasury,cheques,reports}/page.tsx, src/app/(app)/{users,activity-log}/** (نُقلت), src/components/shell/{nav-items.ts,sidebar,topbar,app-shell}.tsx, src/components/search/global-search.tsx, src/app/page.tsx (→ /dashboard), scripts/selftest-auth-http.ts`.

**- How to run & test:**
```bash
npm run dev
npx tsx scripts/selftest-auth-http.ts   # ✅ دخول حقيقي عبر HTTP (أحمد مدير) + رفض كلمة خاطئة
# تحقق الحماية:
curl -I http://localhost:3000/dashboard  # 307 → /login?callbackUrl=/dashboard
```
- اختبار القبول: التنقل يعمل على الموبايل وسطح المكتب؛ روابط المديرين مخفية لغيرهم؛ DataTable يعرض ترقيم/فرز/بحث/فراغ/تحميل. **تم التحقق حياً:** دخول HTTP ناجح وحماية المسارات (307).

**- Business rules / decisions / assumptions (قرارات اتخذتها):**
1. **[قرار] مجموعة مسارات `(app)`** لتطبيق الهيكل والحماية على كل الصفحات الداخلية دون تغيير عناوين URL.
2. **[قرار] تمرير بيانات المستخدم كـ props** من الخادم بدل `SessionProvider` (أبسط، أقل JS على العميل)؛ `signOut` يعمل مستقلاً.
3. **[افتراض] الشريط السفلي للموبايل** يعرض أول 4 وجهات (الرئيسية/الفواتير/العملاء/الموردون).

**- Missing / deferred:** البحث الموحّد فعلي (المرحلة 11)؛ محتوى الصفحات النائبة يُبنى في مراحلها.

**- Questions I need answered before continuing:** لا شيء.
