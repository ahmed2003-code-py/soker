# مسرد المصطلحات (Glossary) — Soker ERP

> القاعدة: **مفهوم → معرّف Prisma (إنجليزي) → اسم قاعدة البيانات (إنجليزي) → المعرّف العربي في الكود**
>
> ⚠️ **ملاحظة فنية مهمة:** لغة مخطط Prisma (PSL) تقبل معرّفات ASCII فقط، فلا يمكن أن تكون أسماء النماذج/الحقول/الـ enum بالعربية.
> لذلك: نماذج وحقول Prisma بالإنجليزية + `@map`/`@@map` لأسماء قاعدة بيانات إنجليزية (snake_case)،
> وكل ما تبقّى عربي: المتغيرات، الدوال، الأنواع/نماذج العرض (view-models)، مفاتيح Zod للنماذج، تسميات العرض، والـ JSON على السلك (Arabic-keyed) عبر دوال تحويل (mappers).

## النماذج (Models)

| المفهوم | نموذج Prisma | جدول DB | نوع/نموذج عرض عربي |
|---|---|---|---|
| المستخدم | `User` | `users` | `مستخدم` |
| الطرف (عميل/مورد) | `Party` | `parties` | `طرف` |
| الفاتورة | `Invoice` | `invoices` | `فاتورة` |
| بند الفاتورة | `InvoiceLine` | `invoice_lines` | `بند_فاتورة` |
| حركة الحساب (دفتر الأستاذ) | `LedgerEntry` | `ledger_entries` | `حركة_حساب` |
| حساب الخزنة | `TreasuryAccount` | `treasury_accounts` | `حساب_خزنة` |
| حركة الخزنة | `TreasuryTxn` | `treasury_txns` | `حركة_خزنة` |
| الشيك | `Cheque` | `cheques` | `شيك` |
| سجل العمليات | `ActivityLog` | `activity_log` | `عملية_مسجلة` |
| الإعدادات | `Setting` | `settings` | `إعداد` |

## الحقول الشائعة (المساءلة / الطوابع)

| المفهوم | حقل Prisma | عمود DB | عربي |
|---|---|---|---|
| أنشئ بواسطة | `createdById` / `createdBy` | `created_by_id` | `أنشئ_بواسطة` |
| عُدّل بواسطة | `updatedById` / `updatedBy` | `updated_by_id` | `عُدّل_بواسطة` |
| تاريخ الإنشاء | `createdAt` | `created_at` | `تاريخ_الإنشاء` |
| تاريخ التعديل | `updatedAt` | `updated_at` | `تاريخ_التعديل` |

## الحقول حسب النموذج

### Party (الطرف)
| Prisma | DB | عربي |
|---|---|---|
| `name` | `name` | `الاسم` |
| `phone` | `phone` | `الهاتف` |
| `address` | `address` | `العنوان` |
| `type` | `type` | `النوع` (عميل/مورد) |
| `creditLimit` | `credit_limit` | `حد_الائتمان` |
| `balance` | `balance` | `الرصيد` |
| `notes` | `notes` | `ملاحظات` |
| `active` | `active` | `نشط` |

### Invoice / InvoiceLine (الفاتورة وبنودها)
| Prisma | DB | عربي |
|---|---|---|
| `number` | `number` | `الرقم` |
| `customerId` | `customer_id` | `العميل` |
| `date` | `date` | `التاريخ` |
| `totalQty` | `total_qty` | `إجمالي_الكمية` |
| `totalWeight` | `total_weight` | `إجمالي_الوزن` |
| `totalAmount` | `total_amount` | `الإجمالي_المالي` |
| `color` | `color` | `اللون` |
| `qty` | `qty` | `الكمية` |
| `weight` | `weight` | `الوزن` |
| `category` | `category` | `التصنيف` |
| `price` | `price` | `السعر` |

### LedgerEntry (حركة الحساب)
| Prisma | DB | عربي |
|---|---|---|
| `partyId` | `party_id` | `الطرف` |
| `date` | `date` | `التاريخ` |
| `docNumber` | `doc_number` | `رقم_المستند` |
| `description` | `description` | `البيان` |
| `category` | `category` | `التصنيف` |
| `qty` | `qty` | `الكمية` |
| `price` | `price` | `السعر` |
| `debit` | `debit` | `مدين` |
| `credit` | `credit` | `دائن` |
| `balanceAfter` | `balance_after` | `الرصيد_بعد_الحركة` |
| `invoiceId` | `invoice_id` | `الفاتورة` |
| `treasuryTxnId` | `treasury_txn_id` | `حركة_الخزنة` |

### TreasuryAccount / TreasuryTxn (الخزنة)
| Prisma | DB | عربي |
|---|---|---|
| `type` (enum) | `type` | `النوع` (إنستا_باي/نقدي/بنك/فودافون_كاش) |
| `balance` | `balance` | `الرصيد` |
| `minThreshold` | `min_threshold` | `الحد_الأدنى` |
| `kind` (enum إيراد/مصروف) | `kind` | `النوع` |
| `amount` | `amount` | `المبلغ` |
| `accountId` | `account_id` | `الحساب` |
| `method` | `method` | `طريقة_الدفع` |

### Cheque (الشيك)
| Prisma | DB | عربي |
|---|---|---|
| `drawerName` | `drawer_name` | `اسم_المدين` |
| `amount` | `amount` | `المبلغ` |
| `beneficiary` | `beneficiary` | `المستفيد` |
| `transferredFrom` | `transferred_from` | `محول_من` |
| `bankName` | `bank_name` | `اسم_البنك` |
| `dueDate` | `due_date` | `تاريخ_الاستحقاق` |
| `chequeNumber` | `cheque_number` | `رقم_الشيك` |
| `status` (enum) | `status` | `الحالة` (منتظر/محصّل/مرتجع) |
| `imageData` | `image_data` | `صورة_الشيك` |
| `ocrText` | `ocr_text` | `نص_OCR` |

## القيم الثابتة (Enums) — مفتاح ASCII ↔ تسمية عربية

| Enum | قيمة Prisma | تسمية عربية |
|---|---|---|
| Role | `ADMIN` / `ACCOUNTANT` / `READONLY` | مدير / محاسب / قراءة_فقط |
| PartyType | `CUSTOMER` / `SUPPLIER` | عميل / مورد |
| TreasuryAccountType | `INSTAPAY` / `CASH` / `BANK` / `VODAFONE` | إنستا باي / نقدي / بنك / فودافون كاش |
| TxnKind | `INCOME` / `EXPENSE` | إيراد / مصروف |
| ChequeStatus | `PENDING` / `COLLECTED` / `BOUNCED` | منتظر / محصّل / مرتجع |
| ActivityAction | `CREATE` / `UPDATE` / `DELETE` | إضافة / تعديل / حذف |

> تُخزَّن مفاتيح ASCII في القاعدة وتُعرض التسميات العربية في الواجهة عبر خرائط في `src/lib/enums.ts`.
