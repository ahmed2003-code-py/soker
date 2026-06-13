### ✅ Phase 8 Summary: استخراج بيانات الشيك تلقائياً (OCR)

**- What was done:**
- **تخزين الصورة:** في Postgres (`Cheque.imageData` Bytes + `imageMime`) — القرار المعتمد ليبقى على Railway.
- **مسار `/api/cheques/ocr`** (POST multipart): يشغّل OCR ويعيد كائناً منظّماً لكل حقل `{ القيمة, الثقة }` أو `null`، + `نص_OCR` الخام + اسم المحرك.
- **واجهة OCR قابلة للاستبدال** `src/lib/ocr/index.ts`: `خدمة_OCR` مع تنفيذ افتراضي **Tesseract.js (ara+eng)**، وبديل سحابي **OCR.space** يُختار عبر `OCR_ENGINE` (لخط اليد الأفضل). يدعم `TESSDATA_PATH` محلي لتفادي الاعتماد على CDN وقت التشغيل.
- **محلّل ذكي** `src/lib/ocr/parse.ts`: استخراج المبلغ (أرقام لاتينية/عربية + فواصل)، تطبيع التاريخ (dd/mm/yyyy و yyyy-mm-dd)، رقم الشيك، ومطابقة اسم البنك من **قائمة بنوك مصرية**، واستنتاج المدين/المستفيد.
- **مرونة:** عند الفشل أو ضعف الجودة يعيد قيماً فارغة ويُسجّل النص الخام؛ **لا يُعطّل الإدخال اليدوي أبداً**.
- **واجهة الإضافة:** رفع صورة (سحب/إفلات + التقاط بالكاميرا على الموبايل) + زر "استخراج تلقائي" → يملأ المكتشَف ويترك الباقي فارغاً + خيار "تخطّي/يدوي". الصورة المخزّنة تُعرض من صف الشيك (`/api/cheques/[id]/image`).

**- Files added/changed:** `src/lib/ocr/{index,parse}.ts, src/app/api/cheques/ocr/route.ts, src/app/api/cheques/[id]/image/route.ts (م7), src/app/(app)/cheques/ocr-upload.tsx (م7), scripts/selftest-phase8.ts`.

**- How to run & test:**
```bash
npx tsx scripts/selftest-phase8.ts   # ✅ المحلّل: مبلغ/تاريخ/بنك/رقم + تدهور رشيق
npm run dev  # /cheques → إضافة شيك → رفع صورة → استخراج تلقائي → مراجعة وحفظ
```
- **اختبار القبول:** المحلّل يستخرج عدة حقول من نص شيك واقعي (185,000 / 2026-07-15 / البنك الأهلي / 00123456 / المستفيد)؛ نص رديء → فراغ بلا أخطاء؛ الصورة تُخزَّن وتُعرض.

**- Business rules / decisions / assumptions (قرارات اتخذتها):**
1. **[قرار معتمد] صورة الشيك في Postgres** (base64/bytes).
2. **[قرار] OCR قابل للاستبدال** عبر env (`OCR_ENGINE`): Tesseract افتراضي، OCR.space/Vision للترقية.
3. **[ملاحظة مهمة — قيد بيئة البناء]** محرك Tesseract يُنزِّل بيانات اللغة من CDN أول مرة، و**هذه الساندبوكس تحجب CDN**، لذا لم أُشغّل التعرّف الحيّ على صورة هنا؛ تم **التحقق من تحميل المحرك** ومن **المحلّل بالكامل آلياً**. على Railway (شبكة متاحة) يعمل التعرّف؛ لتشغيل بلا إنترنت ضَع ملفات `ara/eng.traineddata` واضبط `TESSDATA_PATH`.

**- How to plug a cloud OCR engine:** اضبط `OCR_ENGINE=ocrspace` و`OCRSPACE_API_KEY` (أو أضف تنفيذاً لـ Google Vision عبر نفس واجهة `خدمة_OCR`). لا تغيير في بقية الكود.

**- Missing / deferred:** قياس دقة فعلية على صور حقيقية (يتطلب عينات شيكات + شبكة) — يُجرى عند توفّر صور على البيئة الحيّة.

**- Questions I need answered before continuing:** لا شيء.
