### ✅ Phase 1 Summary: مخطط قاعدة البيانات (Prisma) + المسرد + البذر

**- What was done:**
- مخطط Prisma كامل ومُفهرس لكل كيانات النظام في `prisma/schema.prisma`: `User, Party, Invoice, InvoiceLine, LedgerEntry, TreasuryAccount, TreasuryTxn, Cheque, ActivityLog, Setting`.
- Enums: `Role, PartyType, TreasuryAccountType, TxnKind, ChequeStatus, ActivityAction` (مفاتيح ASCII + تسميات عربية في `src/lib/enums.ts`).
- **المساءلة:** كل كيان أعمال يحمل `createdById/createdBy`، `updatedById/updatedBy`، `createdAt`، `updatedAt` بعلاقات مسمّاة إلى `User`.
- **نموذج الرصيد:** `LedgerEntry` فيه `debit/credit/balanceAfter`؛ `Party.balance` و`TreasuryAccount.balance` مخزّنان (مع دالة recompute لاحقاً). كل المبالغ/الكميات/الأوزان `Decimal(18,4)`.
- العلاقات وسلوك الحذف: `InvoiceLine` → Cascade مع الفاتورة؛ `LedgerEntry.party` و`Invoice.customer` و`TreasuryTxn.account` → Restrict (يمنع حذف طرف/حساب له حركات)؛ روابط الفاتورة/حركة الخزنة في القيود → SetNull. علاقة 1‑1 بين `LedgerEntry` و`TreasuryTxn` (لربط التحصيل/الصرف).
- الفهارس: `Party(type)،(name)`؛ `Invoice(date),(customerId)`؛ `LedgerEntry(partyId,date)`؛ `TreasuryTxn(accountId,date),(kind)`؛ `Cheque(dueDate),(status)`؛ `ActivityLog(createdAt),(userId),(entityType,entityId)`.
- الهجرة `20260613145412_init` أُنشئت وطُبّقت على Postgres.
- `prisma/seed.ts`: مالكان مديران (`ahmed`, `mahmoud`، كلمة مرور مؤقتة `Soker@2026` مع `mustChangePassword`)، 4 حسابات خزنة، إعدادات أساسية + عدّاد الفواتير.
- `docs/glossary.md`: خريطة مفهوم ↔ Prisma ↔ DB ↔ عربي لكل النماذج والحقول والـ enums.

**- Files added/changed:** `prisma/schema.prisma, prisma/seed.ts, prisma/migrations/20260613145412_init/*, src/lib/enums.ts, docs/glossary.md, scripts/selftest-phase1.ts`.

**- How to run & test:**
```bash
npx prisma migrate deploy   # يطبّق الهجرة
npm run seed                # يبذر المالكين + الحسابات + الإعدادات
npx tsx scripts/selftest-phase1.ts   # ✅ يتحقق من البذر ونموذج الرصيد والـ Restrict
```
اختبار القبول: الهجرة + البذر ينجحان؛ المسرد محفوظ؛ المخطط يعكس كل الكيانات ونموذج الرصيد.

**- Business rules / decisions / assumptions (قرارات اتخذتها):**
1. **الرصيد: مخزّن + recompute** (حسب القرار المعتمد) — `balance`/`balanceAfter` يُحدّثان داخل كل معاملة، ودالة `recompute()` (المرحلة 4/9) تعيد بناء سلسلة الطرف/الحساب بعد التعديل/الحذف.
2. **ترقيم الفواتير: عدّاد ذرّي** — مفتاح إعداد `عداد_الفواتير` يُزاد بتحديث ذرّي داخل `$transaction` (آمن للتزامن وبلا فجوات). بدأناه عند 5650 ليكون أول رقم 5651 مطابقاً للمثال المرجعي. (سيُنفّذ فعلياً في المرحلة 6.)
3. **تقسيم لغة أسماء القاعدة: إنجليزي** (مؤكّد في القرارات المعتمدة) — Prisma إنجليزي + `@map`، الكود عربي.
4. **تسعير الفاتورة: بالوزن** — `InvoiceLine.lineTotal = price × weight`، و`Invoice.totalAmount = Σ lineTotal` يُرحّل مديناً على العميل. الحقول جاهزة في المخطط؛ المنطق في المرحلة 6.
5. **[افتراض] منع حذف الطرف ذي الحركات** عبر `onDelete: Restrict` + رسالة عربية واضحة على مستوى الواجهة (المرحلة 4)؛ بدل الحذف الناعم اخترنا المنع الصريح.
6. **[افتراض] صورة الشيك** كـ `Bytes` في Postgres (+`imageMime`) لتبقى على Railway.

**- Missing / deferred:**
- منطق الترقيم الفعلي + الحساب (المرحلة 6)، دالة recompute (المرحلة 4/9)، دوال التحويل (mappers) تُبنى مع كل وحدة.

**- Questions I need answered before continuing:** تأكيد لاحق فقط لقاعدة التسعير (بالوزن مقابل بالعدد) — أتابع بالوزن حالياً.
