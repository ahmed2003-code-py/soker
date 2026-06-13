### ✅ Phase 11 Summary: البحث الموحّد

**- What was done:**
- **`GET /api/search?q=`**: بحث متوازٍ عبر العملاء، الموردين، الفواتير (بالرقم/العميل)، الشيكات (الاسم/البنك/الرقم/المستفيد)، حركات الخزنة (البيان/الطرف). نتائج **مجمّعة حسب النوع** ومحدودة (6 لكل مجموعة). يستخدم `mode: insensitive` ويعتمد على فهارس المرحلة 1.
- **واجهة الشريط العلوي**: إدخال **debounced (300ms)**، قائمة منسدلة بالنتائج المجمّعة، كل نتيجة برابط لصفحتها، **تنقّل بلوحة المفاتيح** (أسهم + Enter + Esc)، وإغلاق عند النقر خارجها.
- تعديل الـ middleware لاستثناء كل `/api` (كل مسار يتحقق من الجلسة بنفسه ويعيد **401** بدل التحويل) — أنسب لواجهات API.

**- Files added/changed:** `src/app/api/search/route.ts, src/components/search/global-search.tsx, src/middleware.ts, scripts/selftest-phase11.ts`.

**- How to run & test:**
```bash
npm run dev
BASE_URL=http://localhost:3000 npx tsx scripts/selftest-phase11.ts   # ✅ عبر HTTP
```
- **اختبار القبول (تم حياً عبر HTTP):** البحث باسم عميل وبهاتفه يعيد نتائج مجمّعة صحيحة مع روابط سليمة؛ الطلب بدون مصادقة يُرفض (401). الاستجابة سريعة.

**- Business rules / decisions / assumptions (قرارات اتخذتها):**
1. **[قرار] سقف 6 نتائج لكل مجموعة** لاستجابة سريعة.
2. **[قرار] استثناء `/api` من الـ middleware** ليعيد كل مسار 401 صريحة (بدل تحويل HTML).
3. **[افتراض] نتائج الشيكات/الخزنة ترتبط بصفحة الوحدة** (لا صفحة تفصيل مفردة لكل شيك/حركة).

**- Missing / deferred:** لا شيء.

**- Questions I need answered before continuing:** لا شيء.
