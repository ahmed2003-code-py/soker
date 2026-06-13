# سُكر — نظام إدارة الأعمال (ERP)

نظام ERP عربي (RTL) لإدارة تجارة (نسيج/غزل): الفواتير، الخزنة (4 حسابات)، العملاء والموردين (دفتر أستاذ)، والشيكات (مع OCR). مبني بـ **Next.js + Prisma + PostgreSQL** ويُنشَر على **Railway**.

## المتطلبات
- Node.js 20+ و npm

## التشغيل محلياً

> لا حاجة لتثبيت PostgreSQL أو Docker — يُشغَّل خادم Postgres حقيقي محلياً عبر حزمة `embedded-postgres`.

```bash
npm install

# 1) شغّل قاعدة بيانات محلية (تبقى تعمل في نافذة منفصلة) — تكتب DATABASE_URL في .env تلقائياً
npm run pg:start

# 2) في نافذة أخرى: هيّئ المخطط وابذر البيانات
npm run prisma:generate
npx prisma migrate deploy   # أو: npx prisma db push
npm run seed

# 3) شغّل التطبيق
npm run dev
# افتح http://localhost:3000
```

لإيقاف قاعدة البيانات المحلية: `npm run pg:stop` (أو Ctrl+C في نافذتها).

## بيانات الدخول الافتراضية (بعد البذر)
| المستخدم | اسم المستخدم | كلمة المرور (مؤقتة) | الدور |
|---|---|---|---|
| أحمد سكر | `ahmed` | `Soker@2026` | مدير |
| محمود سكر | `mahmoud` | `Soker@2026` | مدير |

> ⚠️ كلمة المرور مؤقتة — غيّرها من صفحة المستخدمين بعد أول دخول.

## النشر
يتم النشر على **Railway** مع PostgreSQL. التفاصيل الكاملة في [`docs/DEPLOY.md`](docs/DEPLOY.md).

## بنية المشروع
```
src/
  app/            # صفحات ومسارات App Router + Server Actions
  components/ui/  # عناصر shadcn-style (أزرار، حوارات، قوائم…)
  components/     # عناصر المشروع (MoneyText, DataTable, KpiCard, Combobox…)
  lib/            # prisma, money, decimal, date, auth, validation, ocr
prisma/           # schema + seed + migrations
scripts/          # تشغيل Postgres المحلي + اختبارات ذاتية لكل مرحلة
docs/             # الخطة، المسرد، ملخصات المراحل، دليل النشر
```

## ملاحظات معمارية
- **اللغة:** كل معرّفات الكود بالعربية. استثناء إجباري: نماذج/حقول Prisma بالإنجليزية (PSL يقبل ASCII فقط) مع `@map` لأسماء قاعدة بيانات إنجليزية. انظر `docs/glossary.md`.
- **المال:** `Decimal` فقط (لا أرقام JS عائمة) عبر `src/lib/decimal.ts`.
- **المساءلة:** كل سجل يحمل `أنشئ_بواسطة`/`عُدّل_بواسطة`، وكل عملية تُسجَّل في سجل العمليات.
