### ✅ Phase 0 Summary: إعداد المشروع + قاعدة البيانات + نظام التصميم الأبيض

**- What was done:**
- إنشاء مشروع Next.js 14 (App Router) + TypeScript (strict) + Tailwind، مع RTL وخط Cairo عبر `next/font`.
- تثبيت وإعداد الحزم: Prisma + @prisma/client، Zod، date-fns، Recharts، xlsx (SheetJS)، bcryptjs، next-auth، tesseract.js، Radix UI، lucide-react.
- نظام التصميم الأبيض في `tailwind.config.ts` + `globals.css` (الألوان، الحواف، الظلال، RTL، أنماط الطباعة A4).
- **PostgreSQL محلي حقيقي** عبر `embedded-postgres` (PG 17.5، ترميز UTF8) — يعمل بدون Docker. سكربت `scripts/local-postgres.ts` يشغّله ويكتب `DATABASE_URL` تلقائياً.
- إثبات الاتصال: `scripts/selftest-phase0.ts` ينشئ سجلاً، يقرؤه، ويتحقق من سلامة النص العربي (UTF8) ذهاباً وإياباً ثم ينظّف.
- العناصر الأساسية القابلة لإعادة الاستخدام: `الزر، الحقل، منطقة_نص، العنوان، البطاقة، الشارة، هيكل_تحميل، الحوار، القائمة(Select)، التبويبات، قائمة_منسدلة، منبثقة، الإشعارات(Toast)` + عناصر المشروع: `نص_مبلغ (MoneyText)، نص_تاريخ (DateText)، شارة_حالة (StatusBadge)، بطاقة_مؤشر (KpiCard)، ترويسة_الصفحة (PageHeader)، حالة_فارغة (EmptyState)، حوار_تأكيد (ConfirmDialog)، قائمة_اختيار (Combobox مع بحث + إضافة جديد)، جدول_بيانات (DataTable: بحث/فرز/ترقيم/تحميل/فراغ/خطأ + بطاقات على الموبايل)`.
- صفحة `/style-guide` تعرض كل العناصر ببيانات عربية تجريبية، متجاوبة (موبايل وسطح مكتب).
- `lib/`: `utils (cn)، money (تنسيق/تحليل المبالغ، آمن للعميل)، decimal (حساب دقيق عبر Prisma.Decimal للخادم)، date، prisma (عميل مفرد)`.
- README + `.env.example` + `.gitignore`.

**- Files added/changed:** `package.json, tsconfig.json, next.config.mjs, tailwind.config.ts, postcss.config.mjs, .env.example, .gitignore, .claude/settings.local.json, CLAUDE.md, README.md, prisma/schema.prisma (مؤقت), scripts/local-postgres.ts, scripts/selftest-phase0.ts, src/lib/*, src/components/ui/*, src/components/*, src/app/{layout,page,globals.css}, src/app/style-guide/*, docs/glossary.md`.

**- How to run & test:**
```bash
npm install
npm run pg:start         # نافذة منفصلة — يشغّل Postgres ويكتب DATABASE_URL
npx prisma db push
npx tsx scripts/selftest-phase0.ts   # ✅ يثبت الاتصال + سلامة UTF8
npm run dev              # افتح http://localhost:3000/style-guide
```
- اختبار القبول: `npx next build` ينجح بصفر أخطاء؛ `/style-guide` يعرض كل العناصر ويبدو سليماً على عرض ≤400px.

**- Business rules / decisions / assumptions (قرارات اتخذتها):**
1. **[افتراض/قرار مهم] معرّفات Prisma بالإنجليزية:** لغة مخطط Prisma تقبل ASCII فقط — يستحيل تسمية النماذج/الحقول/enum بالعربية. لذلك نماذج وحقول Prisma إنجليزية + `@map`/`@@map`، وكل بقية الكود (متغيرات/دوال/أنواع/مفاتيح Zod/تسميات/JSON على السلك) بالعربية عبر دوال تحويل. موثّق في `docs/glossary.md`. (هذا انحراف إجباري عن نص الخطة بسبب قيد تقني، وليس قراراً اختيارياً.)
2. **[افتراض] قاعدة بيانات الاختبار المحلي:** لعدم وجود Docker/Postgres على الجهاز ولعدم تزويدي برابط Railway، أُشغّل Postgres محلي عبر `embedded-postgres` (نفس محرك Postgres ونفس دلالات Decimal). الإنتاج يستبدل `DATABASE_URL` برابط Railway — المخطط مطابق.
3. **[قرار] ترميز UTF8 + locale=C** للقاعدة المحلية (افتراضي ويندوز WIN1252 يُفسد العربية) — أُجبِر عبر `initdbFlags`.
4. **[قرار] bcryptjs بدل bcrypt** لتفادي مشاكل البناء الأصلي على ويندوز/Railway.

**- Missing / deferred:**
- المخطط الكامل + البذر (المرحلة 1). `schema.prisma` الحالي مؤقت (نموذج `HealthCheck` فقط لإثبات الاتصال).
- المصادقة، الواجهة الكاملة، والوحدات — المراحل 2+.

**- Questions I need answered before continuing:** لا شيء حالياً — التقدّم مستمر بالقرارات أعلاه.
