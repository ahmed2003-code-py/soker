# دليل النشر على Railway — Soker ERP

> هذا الدليل يأخذك من صفر إلى تطبيق سُكر يعمل على رابط `https://*.up.railway.app` مع قاعدة بيانات PostgreSQL مُدارة.

## 1) المتطلبات
- حساب على [Railway](https://railway.app)
- مستودع GitHub لهذا المشروع (مثلاً `github.com/<user>/soker`)
- لا تحتاج تثبيت Postgres أو Docker محلياً

---

## 2) إنشاء مشروع Railway

1. سجّل الدخول إلى Railway → **New Project**.
2. اختر **Provision PostgreSQL** → سيُنشأ خدمة Postgres مُدارة.
3. اضغط **+ New** → **GitHub Repo** → اختر مستودع `soker`. Railway يبني تلقائياً عبر Nixpacks (موجود `railway.json` يضبط الأوامر).

> **مهم:** ضع خدمة Postgres والـ App في **نفس المشروع** ليشتركا في الشبكة الخاصة.

---

## 3) متغيرات البيئة

في خدمة التطبيق، افتح **Variables** وأضف:

| المتغير | القيمة | ملاحظة |
|---|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` | اربطها كمرجع لمتغير Postgres (auto-injected) |
| `NEXTAUTH_SECRET` | سلسلة عشوائية قوية | ولّدها بـ `openssl rand -base64 32` |
| `NEXTAUTH_URL` | `https://<your-app>.up.railway.app` | الرابط العام للتطبيق (بعد توليده) |
| `OCR_ENGINE` | `tesseract` | افتراضي. غيّر إلى `ocrspace` أو `google` لاحقاً |
| `OCRSPACE_API_KEY` | (اختياري) | فقط إذا `OCR_ENGINE=ocrspace` |
| `GOOGLE_VISION_API_KEY` | (اختياري) | فقط إذا `OCR_ENGINE=google` |

> **حول `NEXTAUTH_URL`:** بعد أول Deploy، Railway يعطيك دومين. خذه واملأ المتغير ثم انتظر إعادة النشر.

---

## 4) أوامر البناء والتشغيل

موجودة في `railway.json` و `package.json`، ولا تحتاج تعديلها:
- **Build:** `npm run build` → يشمل `prisma generate && next build`.
- **Start:** `npm run start` → يشمل `prisma migrate deploy && next start -p $PORT`.

> الترحيلات (`migrate deploy`) تعمل **عند كل إقلاع** — آمنة (idempotent) وتضمن مزامنة المخطط بعد كل Push.

---

## 5) البذر الأولي (مرة واحدة)

بعد أول Deploy ناجح، شغّل البذر لإنشاء المالكَين الافتراضيين والحسابات الأربعة:

من جهازك المحلي مع تصدير `DATABASE_URL` الخاص بالإنتاج:
```bash
DATABASE_URL="<railway-prod-url>" npm run seed
```

أو من **Railway Shell** (في صفحة الخدمة → `…` → **Open Shell**):
```bash
npm run seed
```

**النتيجة:**
- مستخدمان: `ahmed` و `mahmoud` — كلمة المرور المؤقتة `Soker@2026` (مفعّل علم التغيير الإجباري).
- 4 حسابات خزنة: إنستا باي / نقدي / بنك / فودافون كاش.
- إعدادات أساسية (اسم الشركة، طرق الدفع، عداد فواتير).

---

## 6) فحص نهائي بعد النشر

افتح الرابط واختبر بالتسلسل:
1. تسجيل الدخول بحساب `ahmed` → تغيير كلمة المرور (إجباري).
2. **/customers** — أضف عميلاً.
3. **/invoices/new** — أنشئ فاتورة.
4. **/treasury** — سجّل تحصيلاً عبر «الخزنة» مع ربطه بالعميل (Phase 9).
5. **/cheques** — أضف شيكاً وارفع صورة (OCR).
6. **/dashboard** — تأكد أن الأرقام تتطابق.
7. **/reports** — اطبع كشف حساب، صدّر Excel.
8. **/settings** — حدّث اسم/شعار الشركة وحدود الخزنة.

---

## 7) النسخ الاحتياطي والاستعادة

### تلقائي (Railway)
- خدمة Postgres على Railway تأخذ **نسخاً يومية** تلقائياً (احتفاظ متغيّر حسب الخطة).
- استعد من خلال **Postgres → Backups** → **Restore**.

### يدوي (`pg_dump` / `pg_restore`)

#### تصدير
```bash
# يتطلب pg_dump 16+
pg_dump --no-owner --no-acl --clean --if-exists \
  --dbname "$DATABASE_URL" \
  --file backups/soker_$(date +%Y%m%d_%H%M).sql
```

#### استعادة (إلى قاعدة فارغة)
```bash
psql --dbname "$DATABASE_URL" --file backups/soker_YYYYMMDD_HHMM.sql
```

> احفظ النسخ الاحتياطية خارج Railway (Google Drive / S3) لحماية مزدوجة.

---

## 8) المراقبة وقت التشغيل

- **سجلات Railway** (Logs) — تعرض stdout/stderr للخادم.
- مسار `/login` يُستخدم كـ healthcheck.
- إذا تعطّل migrate (مثلاً تعارض schema)، الخدمة لن تبدأ. تحقق من السجلات أولاً.

---

## 9) ترقية الإصدار

1. Push إلى GitHub → Railway يكتشف ويبني تلقائياً.
2. `prisma migrate deploy` يطبّق الترحيلات الجديدة تلقائياً.
3. **لا تُعِد البذر** بعد الإطلاق — يقتصر على المرة الأولى.

---

## 10) استكشاف المشاكل

| المشكلة | الحل |
|---|---|
| `Error: P3009 migrate found failed migrations` | افتح Shell وشغّل `npx prisma migrate resolve --rolled-back <migration_name>` ثم أعِد النشر |
| `NEXTAUTH_NO_SECRET` | تأكد من ضبط `NEXTAUTH_SECRET` |
| إعادة توجيه لانهائية بعد الدخول | تحقق أن `NEXTAUTH_URL` = الرابط الفعلي للتطبيق |
| OCR بطيء | غيّر `OCR_ENGINE` إلى خدمة سحابية (`ocrspace` / `google`) |
| الفواتير لا تُعرض الشعار | تأكد من رفع الشعار من `/settings` بعد البذر |

---

تمّ ✅ — التطبيق جاهز للإنتاج على Railway.
