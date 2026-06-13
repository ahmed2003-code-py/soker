### ✅ Phase 13 Summary: الإعدادات، الجاهزية للإنتاج، النشر على Railway

**- What was done:**
- **`/settings` (للمديرين فقط):** ثلاث بطاقات —
  1. **بيانات الشركة:** الاسم، حد الائتمان الافتراضي، طرق الدفع (قابلة للإضافة/الحذف، مع منع حذف آخر طريقة).
  2. **شعار الشركة:** رفع PNG/JPG ≤1.5MB، يُخزَّن base64 في الإعدادات (يظهر في رأس الفاتورة من Phase 6).
  3. **حدود الخزنة الدنيا:** حقل لكل حساب من الأربعة، يُفعِّل تنبيهات لوحة التحكم.
- **`actions.ts` (3 إجراءات):** `حفظ_الإعدادات_العامة`, `حفظ_شعار_الشركة`, `حفظ_حدود_الخزنة` — كلها تتحقق من `إدارة_الإعدادات` عبر `can()`، تستخدم `$transaction`، وتسجّل في `ActivityLog`، وتعيد `revalidatePath` لـ `/settings + /treasury + /invoices + /dashboard`.
- **رابط الإعدادات** في الشريط الجانبي (للمديرين فقط).
- **جاهزية الإنتاج:**
  - `package.json` → `start = prisma migrate deploy && next start -p $PORT` (ترحيلات آلية عند كل إقلاع).
  - `railway.json` يحدد build/start/healthcheck=`/login`/policy إعادة التشغيل.
  - `next build` يمر نظيفاً (19 مسار)؛ TS strict بلا أي `any` جديد.
- **`docs/DEPLOY.md`:** دليل خطوة بخطوة لـ Railway (إنشاء Postgres + متغيرات البيئة، البذر الأولي، فحص ما بعد النشر، النسخ الاحتياطي pg_dump/Railway، استكشاف المشاكل).

**- Files added/changed:**
`src/app/(app)/settings/page.tsx`, `src/app/(app)/settings/client.tsx`, `src/app/(app)/settings/actions.ts`,
`src/components/shell/nav-items.ts`,
`package.json`, `railway.json`, `docs/DEPLOY.md`,
`scripts/selftest-phase13.ts`.

**- How to run & test:**
```bash
npx tsx scripts/selftest-phase13.ts   # ✅ إعدادات + حدود الخزنة + المالكان
npm run build                         # ✅ يبني للإنتاج (19 مسار)
npm run dev                           # /settings — يحتاج دور ADMIN
```
**اختبار القبول (تم):** بناء الإنتاج ينجح بـ 0 أخطاء؛ صفحة `/settings` تظهر للمديرين فقط؛ `حفظ_حدود_الخزنة` يُغيِّر `minThreshold` بـ Decimal دقيق ويُحدِّث تنبيهات اللوحة.

---

### 🎯 الفحص النهائي مقابل خطة v5

| المتطلب (من الخطة) | الحالة |
|---|---|
| Phase 0 — Project Setup + Postgres + Design System | ✅ تم |
| Phase 1 — Prisma schema (Arabic ids) + glossary + seed | ✅ تم |
| Phase 2 — Auth + Roles + Activity Log + per-record history | ✅ تم |
| Phase 3 — App shell + responsive nav + DataTable | ✅ تم |
| Phase 4 — Customers/Suppliers + ledger + payments | ✅ تم |
| Phase 5 — Treasury (4 accounts) + thresholds | ✅ تم |
| Phase 6 — Invoices (grouping, by-weight, print/PDF) | ✅ تم |
| Phase 7 — Cheques (CRUD + monthly + overdue alerts) | ✅ تم |
| Phase 8 — Cheque OCR (Tesseract pluggable) | ✅ تم |
| Phase 9 — Cross-module integration (atomic linking) | ✅ تم |
| Phase 10 — Dashboard (KPIs, charts, alerts) | ✅ تم |
| Phase 11 — Unified search | ✅ تم |
| Phase 12 — Reports + PDF/Excel | ✅ تم |
| Phase 13 — Settings + Deploy on Railway | ✅ تم (النشر ينتظر متغيرات الإنتاج) |
| Accountability — createdBy/updatedBy + activity log per action | ✅ تم |
| Money via Decimal (no JS float) | ✅ تم |
| RTL + Arabic identifiers (PSL exception with @map) | ✅ تم |
| Comboboxes للقيم الثابتة | ✅ تم |
| ConfirmDialog + Toast + EmptyState + LoadingSkeleton | ✅ تم |

**- Business rules / decisions / assumptions (قرارات اتخذتها):**
1. **[قرار] `prisma migrate deploy` عند كل start** بدل خطوة release منفصلة — أبسط، آمن (idempotent)، ويعمل مع Railway المباشر.
2. **[قرار] شعار الشركة كـ base64 داخل `Setting.value`** (≤1.5MB) — يبقى على Railway بدون نظام ملفات دائم، ويُستخدم مباشرة في `<img src=>`.
3. **[قرار] healthcheck = `/login`** — يضمن أن الخادم وراوتر Next يعملان، حتى للمستخدم غير المسجَّل.
4. **[قرار] منع حذف آخر طريقة دفع** كي لا تنكسر نماذج الخزنة/المدفوعات.

**- Missing / deferred:**
- **بذر بيانات ديمو واقعية** (عملاء+فواتير+حركات+شيكات متعددة) — تُركت اختيارية حتى لا تلوث قاعدة الإنتاج عند `seed`؛ يمكن إضافة `scripts/seed-demo.ts` لاحقاً عند الحاجة.
- النشر الفعلي على Railway: ينتظر متغيرات الإنتاج من المالك.

**- Questions I need answered before continuing:** لا شيء — النظام مكتمل وفق خطة v5.
