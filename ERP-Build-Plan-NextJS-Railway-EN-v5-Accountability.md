# Build Plan v5 (Detailed) — Business Management System (ERP)
### Next.js (one project) — Prompt Pack for Claude Code → deploy on Railway

> Version 5.0 — 13 June 2026 — the comprehensive edition with full accountability.
> Same stack and goals as v4, with every prompt expanded (**Goal · Context · Detailed spec · Business rules · Validation & edge cases · UX · Testable acceptance criteria**) and the Master Prompt carrying the full **Domain & Business Rules** + worked numeric example.
>
> **New in v5 (accountability):** the system has **two owners — أحمد سكر and محمود سكر** — both ADMIN with full access. Every record stamps **who created it and who last edited it (name + date/time)**, shown on screen, with a per-record history and an activity log filterable by person — so the two of them can sit together and see exactly who did what. Database relationships and the money/invoice/balance linking are reinforced throughout. The "Add" flow always opens a clear form with all the agreed fields/options.

---

## How to use this file

1. Open Claude Code in an empty folder on VS Code. Put the SRS at `docs/requirements.docx`.
2. Before Prompt 0: create a Railway account, add a **PostgreSQL** service, copy its connection string (for `DATABASE_URL`).
3. Paste the **Master Prompt** first; ask Claude to save it as `CLAUDE.md` (it's the shared brain for every phase).
4. Paste execution prompts **one at a time**, in order (Prompt 0 → Prompt 13).
5. After each prompt, Claude writes a **Phase Summary** — send it to me to review before continuing.
6. One phase at a time. **Golden rule:** if anything is ambiguous, Claude asks before assuming, and records every assumption in the summary.

Phases: 0 setup · 1 schema · 2 auth · 3 shell · 4 customers/suppliers · 5 treasury · 6 invoices · 7 cheques · 8 cheque OCR · 9 integration · 10 dashboard · 11 search · 12 reports · 13 deploy on Railway.

---

# 🟦 Master Prompt (the shared brain — save as CLAUDE.md)

> Copy the entire block and paste it as your first message. This is long on purpose; it prevents wrong assumptions later.

```
You will build a complete Business Management / ERP system with me, end to end, in phases, as ONE Next.js project deployed on Railway. Save this whole message to CLAUDE.md at the repo root and follow it in every phase. Re-read it before each phase.

==================================================
1) THE BUSINESS & THE IDEA
==================================================
This is for a trading business (textile/yarn-style: goods identified by COLOR and a CATEGORY/type such as "14×1", "28×2", "برج", tracked by both COUNT (العدد/الكمية) and WEIGHT (الوزن, kg)). Today they work on paper invoices + separate Excel files. We are replacing all of that with one Arabic (RTL) web ERP.

Four interconnected modules + shared features:
1) Cheques — standalone, with an OCR auto-fill feature (upload a cheque image -> extract fields).
2) Treasury — 4 independent accounts (InstaPay / Cash / Bank / Vodafone Cash) + a total balance.
3) Invoices — line items with auto-grouping by category, print/PDF, matching the paper layout.
4) Customers & Suppliers — a running account ledger per party with balance and payments.
Shared: main dashboard, unified search, reports (PDF/Excel), users & roles, activity log, settings.
The detailed requirements live in docs/requirements.docx — it is the source of truth; re-check it for any field or rule.

==================================================
2) DOMAIN MODEL & BUSINESS RULES (read carefully)
==================================================
LEDGER (party account) uses two columns: مدين (debit) and دائن (credit), plus a running الرصيد_بعد_الحركة.

CUSTOMER convention:
- An invoice posts its monetary value into مدين (the customer now owes us more).
- A payment received posts into دائن (reduces what they owe).
- balance = Σ(مدين) − Σ(دائن). POSITIVE balance = customer owes us (مديونية).

SUPPLIER convention (mirror):
- A purchase/bill posts into دائن (we now owe them more).
- A payment we make to them posts into مدين (reduces what we owe).
- payable = Σ(دائن) − Σ(مدين). POSITIVE = we owe the supplier (مستحق للمورد).

Always recompute الرصيد_بعد_الحركة in chronological order; never trust a stale stored balance after edits/deletes — recompute the affected party's chain.

TREASURY:
- Each account has its own running balance. INCOME (إيراد) adds to the chosen account; EXPENSE (مصروف) subtracts.
- Total balance = sum of the four accounts, shown live.
- Store الرصيد_بعد_الحركة per treasury transaction; recompute the account's chain on edit/delete.

AUTOMATIC LINKING (the heart — every case must be ONE atomic Prisma $transaction + an activity-log entry):
A) Invoice -> Customer: saving an invoice creates a مدين ledger entry on the customer for the invoice value, linked to the invoice number, carrying category/qty/weight context; updates the customer balance.
B) Treasury -> Customer (collection): recording a customer payment of amount X does, atomically:
   - add INCOME X to the chosen treasury account (+X to that account and the total),
   - add a دائن ledger entry X on the customer (customer balance −X),
   - save the date + payment method (+ link the invoice number if given).
C) Treasury -> Supplier (disbursement): paying a supplier amount Y does, atomically:
   - add EXPENSE Y to the chosen treasury account (−Y),
   - add a مدين ledger entry Y on the supplier (payable −Y),
   - save the date (+ method).
D) Edit/Delete of any linked entry must reverse/adjust ALL linked sides and recompute balances; never leave the data inconsistent.

WORKED EXAMPLE (must hold true end to end):
- Customer "أحمد" starts at balance 0.
- We issue invoice #5651 worth 185,000 -> ledger مدين 185,000 -> أحمد balance = 185,000 (owes us).
- أحمد pays 50,000 via Bank: Treasury Bank +50,000; ledger دائن 50,000 -> أحمد balance = 135,000.
- Dashboard "إجمالي مديونية العملاء" includes أحمد's 135,000. Treasury total increased by 50,000. Activity log shows: invoice created, payment recorded.

MONEY & NUMBERS:
- All money is Prisma Decimal; do all math with a Decimal/“Money” helper (NEVER JS float). Round to 2 decimals for display, keep full precision in storage. Weight/qty may have decimals too (use Decimal).
- Currency EGP. Display Western digits with thousands separators, e.g. 1,250,475.00. Accept user input with or without separators.

DATES:
- Store as DateTime/Date; default new entries to today; show in a clear dd/mm/yyyy style. Cheques sort by تاريخ_الاستحقاق.

==================================================
2b) USERS & ACCOUNTABILITY (two owners)
==================================================
The system is operated by TWO owners who each have FULL access (add/edit/delete anything):
- أحمد سكر
- محمود سكر (the father)
Seed both as ADMIN users. Keep the role model (مدير/محاسب/قراءة_فقط) so staff can be added later, but these two are admins.

Accountability is a TOP priority — they must be able to sit together and see exactly who did what:
- Every business record (الطرف, الفاتورة, بند_الفاتورة, حركة_الحساب, حركة_الخزنة, الشيك, الإعدادات) stores:
  أنشئ_بواسطة (createdBy -> المستخدم) + تاريخ_الإنشاء, and عُدّل_بواسطة (updatedBy -> المستخدم) + تاريخ_التعديل.
- The actor is ALWAYS taken from the authenticated session, never from the client. No action without a logged-in user.
- Show on each record's view a clear line: "أضيف بواسطة: [الاسم] — [التاريخ/الوقت]" and "آخر تعديل: [الاسم] — [التاريخ/الوقت]". Lists may show a small "بواسطة" column/badge.
- In addition to createdBy/updatedBy, write an ActivityLog row for every create/update/delete (who, when, what, and before/after details where useful).
- Provide a per-record HISTORY (audit trail) view, and an /activity-log page filterable by PERSON (أحمد / محمود), entity type, and date range.

==================================================
3) TECH STACK (ONE project) — stick to it
==================================================
- Next.js 14+ (App Router) + TypeScript (strict). Logic via Server Actions; route handlers for OCR and search.
- Tailwind CSS + shadcn/ui (Select/Combobox, Dialog, Table, Tabs, etc.).
- Prisma ORM + PostgreSQL (Railway). Auth.js (NextAuth) credentials + bcrypt; roles ADMIN/ACCOUNTANT/READONLY.
- Zod for validation (shared schemas used on both client and server). Recharts for charts. SheetJS (xlsx) for Excel. date-fns for dates.
- OCR pluggable: default Tesseract.js (ara+eng); optional cloud (Google Vision / OCR.space) via env.
- Arabic font (Cairo or IBM Plex Sans Arabic) via next/font.

==================================================
4) CODE LANGUAGE RULE
==================================================
- ALL TypeScript identifiers in ARABIC: Prisma fields, types/interfaces, variables, function names, component props, enum values. Multi-word with underscores: اسم_المدين, تاريخ_الاستحقاق, حركة_الحساب.
- ENGLISH/ASCII only for: physical DB table/column names (@map/@@map), route/URL paths (/api/...), and file names.
- JSON over the wire uses the Arabic property names (Server Action returns / route payloads), so types match end to end.
- Keep ONE glossary (docs/glossary.md, created in Prompt 1) and reuse the same identifier for the same concept everywhere.
- All USER-FACING text is Arabic.

==================================================
5) UI / UX STANDARDS
==================================================
- Comboboxes: every fixed-choice selector uses shadcn Select/Combobox (searchable when long): treasury type (إيراد/مصروف), payment method (نقدي/إنستا باي/بنك/فودافون كاش — configurable), treasury account, party type (عميل/مورد), invoice category (with inline "add new"), cheque status, user role, all report filters.
- Add flow: clicking "إضافة" opens a clear input form showing ALL the agreed fields and their comboboxes/inputs at once — a Dialog for short forms (party, treasury transaction, cheque, payment) or a full page for long ones (invoice). Mark required fields, show inline Arabic validation, autofocus the first field, and provide Save/Cancel. The SAME form component is reused for Edit (prefilled).
- Fast data entry (accountants enter many rows): autofocus first field; Enter adds a new invoice row; numeric fields select-on-focus; sensible tab order; date pickers default to today; inline validation messages in Arabic.
- Every list/table has: search, sort, pagination (default 20/page), an EmptyState, a loading skeleton, and an error state. Tables collapse to cards on mobile.
- Confirm destructive actions with a ConfirmDialog. Show a success/error Toast after every mutation.
- Money shown via a MoneyText component (color-neutral, or green/red where it means income/expense). Dates via DateText.

==================================================
6) DESIGN SYSTEM (white theme)
==================================================
- Background #FFFFFF / app gray #F8FAFC. Cards: white, border #E5E7EB, soft shadow, rounded-xl. Primary navy #1F3864 / blue #2563EB. Status: green income, red expense/overdue, amber warning. Generous spacing, clear typography, strong contrast.
- RTL by default (<html dir="rtl" lang="ar">), English text/numbers LTR inline.
- Responsive: desktop = collapsible RIGHT sidebar + top bar (unified search + user menu); mobile = drawer/hamburger + optional bottom nav. Touch-friendly.

==================================================
7) QUALITY BAR, SECURITY & CONVENTIONS
==================================================
- TypeScript strict, no `any`. Validate EVERY input on the server (never trust the client) with the shared Zod schema. Authorize EVERY mutation server-side by role (a single can(user, action) helper) regardless of UI state.
- Layered structure: app/ routes & pages; components/ui (shadcn) + components/ (project, incl. Combobox/DataTable/KpiCard); lib/ (prisma, auth, money, date, validation, ocr); server actions colocated per feature; prisma/.
- All multi-write operations inside prisma.$transaction. Helpful errors; consistent result type ({ نجاح, رسالة, بيانات }).
- The activity log is append-only and records who/when/what for every create/update/delete of sensitive entities.
- Secrets only from env (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, OCR keys). Railway filesystem is ephemeral — do not store persistent files on local disk (decide cheque-image storage in Prompt 8).
- Performance: index fields used in search/sort/filter; paginate everything; avoid N+1 (use Prisma include/select deliberately).

==================================================
8) HOW WE WORK
==================================================
- Phases, in order. Do NOT start the next phase until I ask.
- End each phase with a "Phase Summary" in EXACTLY this format:
  ### ✅ Phase [n] Summary: [name]
  - What was done:
  - Files added/changed:
  - How to run & test (commands + click-path):
  - Business rules / decisions / assumptions:
  - Missing / deferred:
  - Questions I need answered before continuing:
- Never make a large assumption silently — ask me.

Confirm you understood, save this to CLAUDE.md, then wait for the Phase 0 prompt.
```

---

# 🟩 Execution Prompts (one at a time)

---

## Prompt 0 — Project Setup, Railway Postgres & Design System

```
PHASE 0
Goal: a running Next.js project connected to Railway Postgres, with the white RTL design system and reusable primitives in place.

Detailed spec:
1) Create Next.js 14 (App Router) + TypeScript (strict) + Tailwind.
2) Install/configure: shadcn/ui, Prisma (+ @prisma/client), Zod, date-fns, Recharts, xlsx, bcrypt, Auth.js, tesseract.js (prepare now, used later).
3) DB: configure Prisma datasource for PostgreSQL via DATABASE_URL (I will paste a Railway connection string). Add .env.example with DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL. Prove the connection with a trivial query in a temporary route or script, then remove it.
4) RTL + Arabic font via next/font (<html dir="rtl" lang="ar">).
5) Implement the white design system in tailwind.config + globals.css (color tokens, radius, shadow, spacing scale) exactly per CLAUDE.md.
6) Build the reusable primitives now (used everywhere): MoneyText, DateText, StatusBadge, KpiCard, PageHeader, EmptyState, ConfirmDialog, Toast setup, a Combobox wrapper (label + options + filter + optional add-new), and a generic DataTable (search/sort/paginate/empty/loading + collapses to cards on mobile).
7) Folder structure per CLAUDE.md. README with run steps + a note that deploy is on Railway.
8) A /style-guide page demonstrating every primitive above with Arabic sample data.

UX/quality: clean white look, RTL correct, everything responsive.

Acceptance criteria (testable):
- `npm run dev` runs with zero errors; Prisma connects to Railway Postgres.
- /style-guide shows all primitives, looks great on a phone width (≤400px) and desktop.

End with the "Phase 0 Summary".
```

---

## Prompt 1 — Database Schema (Prisma, Arabic identifiers + glossary)

```
PHASE 1
Goal: a complete, indexed, PostgreSQL-ready Prisma schema using Arabic identifiers, plus seed data.

First: create docs/glossary.md (concept -> Arabic identifier -> English DB name) and reuse it everywhere.

Models & key fields (keep consistent; add what the SRS implies):
- المستخدم: الاسم, اسم_المستخدم(unique), كلمة_المرور_المشفرة, الدور(enum مدير/محاسب/قراءة_فقط), نشط(bool), createdAt/updatedAt
- الطرف: الاسم, الهاتف, العنوان?, النوع(enum عميل/مورد), حد_الائتمان?(Decimal), الرصيد(Decimal default 0), ملاحظات?, timestamps  // index: النوع, الاسم
- الفاتورة: الرقم(Int unique, auto-sequential), العميل(rel الطرف), الهاتف?, التاريخ(Date), إجمالي_الكمية(Decimal), إجمالي_الوزن(Decimal), الإجمالي_المالي?(Decimal — see pricing decision), ملاحظات?, timestamps  // index: التاريخ, العميل
- بند_الفاتورة: الفاتورة(rel), اللون, الكمية(Decimal), الوزن(Decimal), التصنيف(String), السعر?(Decimal), ملاحظات?
- حركة_الحساب: الطرف(rel), التاريخ, رقم_المستند?, البيان, التصنيف?, الكمية?(Decimal), السعر?(Decimal), مدين(Decimal default 0), دائن(Decimal default 0), الرصيد_بعد_الحركة(Decimal), الفاتورة?(rel), حركة_الخزنة?(rel)  // index: الطرف+التاريخ
- حساب_الخزنة: النوع(enum إنستا_باي/نقدي/بنك/فودافون_كاش, unique), الرصيد(Decimal default 0), الحد_الأدنى?(Decimal)
- حركة_الخزنة: التاريخ, النوع(enum إيراد/مصروف), المبلغ(Decimal), الحساب(rel), البيان, الطرف?(rel), الفاتورة?(rel), الرصيد_بعد_الحركة(Decimal), طريقة_الدفع?, timestamps  // index: الحساب+التاريخ, النوع
- الشيك: اسم_المدين, المبلغ(Decimal), المستفيد, محول_من, اسم_البنك, تاريخ_الاستحقاق(Date), رقم_الشيك?, الحالة(enum منتظر/محصّل/مرتجع default منتظر), ملاحظات?, صورة_الشيك?(decided in Prompt 8), نص_OCR?, timestamps  // index: تاريخ_الاستحقاق, الحالة
- سجل_العمليات: المستخدم(rel), العملية(enum إضافة/تعديل/حذف), نوع_الكيان, معرف_الكيان?, التفاصيل(Json), createdAt  // index: createdAt
- الإعدادات: المفتاح(unique), القيمة  // company name, logo, default credit limit, per-account thresholds

Rules:
- ACCOUNTABILITY: every business entity (الطرف, الفاتورة, بند_الفاتورة, حركة_الحساب, حركة_الخزنة, الشيك, الإعدادات) stores أنشئ_بواسطة(rel المستخدم), عُدّل_بواسطة?(rel المستخدم), تاريخ_الإنشاء(createdAt), تاريخ_التعديل(updatedAt) — so we always know who created and who last edited each record.
- TS identifiers Arabic; physical DB names English via @map/@@map. CONFIRM this split with me before finalizing — ask if I want DB names Arabic too.
- Money/qty/weight = Decimal. Add the indexes noted. Define all relations + onDelete behavior (e.g. restrict deleting a party that has movements).
- prisma migrate dev against Railway Postgres. seed.ts: TWO ADMIN users — أحمد سكر and محمود سكر (ask me for their usernames/passwords; otherwise create users "ahmed" and "mahmoud" with a temporary password and flag it so I change it), the 4 treasury accounts, base settings.

Business rules to encode now:
- الرقم of invoices is sequential and unique (define how it's generated safely under concurrency).
- A party with existing حركة_الحساب cannot be hard-deleted (use soft handling or block with a clear message).

Acceptance criteria:
- migrate + seed succeed; glossary saved; schema reflects every SRS entity and the balance model.

End with the "Phase 1 Summary" + your decisions on: balance computed vs stored, invoice numbering strategy, DB-names language split, invoice pricing (is الإجمالي_المالي derived from السعر×الوزن/الكمية, entered manually, or deferred?). Ask me to confirm pricing.
```

---

## Prompt 2 — Auth, Roles & Activity Log

```
PHASE 2
Goal: secure login, role-based access enforced on the server, and a working append-only activity log.

Detailed spec:
1) Auth.js credentials provider + bcrypt. Arabic /login (clean white, validation, error messages). Session carries الدور. Middleware protects all internal routes; unauthenticated -> /login.
2) Authorization: a single can(user, action) helper. Enforce on EVERY Server Action by role, independent of UI. READONLY: no create/update/delete anywhere.
3) /users (ADMIN only): list + add/edit/deactivate users; role via combobox; never expose password hashes; allow password reset.
4) Activity & accountability:
   - On every create/update/delete: set أنشئ_بواسطة/عُدّل_بواسطة from the session AND call تسجيل_عملية(user, action, entityType, entityId, details) inside the SAME transaction.
   - Show on each record's detail view: "أضيف بواسطة: [الاسم] — [الوقت]" and "آخر تعديل: [الاسم] — [الوقت]". Lists show a small "بواسطة" indicator.
   - Per-record HISTORY view (who changed what, when), reachable from the record.
   - /activity-log page filterable by PERSON (أحمد سكر / محمود سكر), entity type, and date range, via comboboxes + DataTable. Visible to admins (both owners).

Goal of all this: the two owners can review together and know exactly who performed each change.

Edge cases: deactivated user cannot log in; last remaining ADMIN cannot be deactivated/deleted; failed logins show a generic Arabic error.

Acceptance criteria:
- Both owners (أحمد سكر / محمود سكر) log in as admins. A READONLY user (if created) sees no edit buttons AND any direct Server Action attempt is rejected server-side.
- Creating/editing/deleting anything sets أنشئ_بواسطة/عُدّل_بواسطة AND writes one activity-log row with correct who/when/what. A record's detail shows "أضيف/آخر تعديل بواسطة [الاسم]"; the activity log can be filtered to show only أحمد's or only محمود's actions.

End with the "Phase 2 Summary".
```

---

## Prompt 3 — App Shell, Layout & Navigation

```
PHASE 3
Goal: the full responsive shell and finalized shared components used by all modules.

Detailed spec:
1) Authenticated layout: desktop = collapsible RIGHT sidebar (الرئيسية, الفواتير, العملاء, الموردين, الخزنة, الشيكات, التقارير, المستخدمون, سجل_العمليات) with active-state styling + top bar (unified search field — UI only now — and a user menu with logout + the current role badge). Mobile = hamburger drawer + optional bottom nav for the top 4.
2) Wire role-based visibility into the nav (hide المستخدمون / سجل_العمليات for non-admins).
3) Finalize shared components from Phase 0 if anything is missing; ensure DataTable supports: server-side or client-side pagination, column sorting, a search box, row actions, empty/loading/error states, and mobile card mode.
4) Placeholder pages for each route with a PageHeader, so navigation is fully clickable.

Acceptance criteria:
- Navigation works on phone and desktop; role-based links hidden correctly; DataTable demoed with dummy data shows pagination/sort/search/empty/loading.

End with the "Phase 3 Summary".
```

---

## Prompt 4 — Customers & Suppliers

```
PHASE 4
Goal: full party management with an accurate running ledger and payments (party side now; treasury link in Phase 9).

Detailed spec:
1) /customers and /suppliers lists (DataTable: الاسم, الهاتف, الرصيد with debt/payable label + color, actions). Search + sort + pagination.
2) Add/edit/delete طرف (Server Action + shared Zod + can() + activity log). النوع via combobox. Block delete if movements exist (clear Arabic message).
3) Party page /customers/[id] (same template for suppliers):
   - Header with basic info + 3 KpiCards: إجمالي الفواتير/المشتريات, إجمالي المدفوعات, الرصيد الحالي (labeled مديونية for customer / مستحق for supplier).
   - Movements table (حركة_الحساب) columns: التاريخ, رقم الفاتورة/المستند, التصنيف/البيان, الكمية, السعر, مدين, دائن, الرصيد بعد الحركة — newest or chronological (state which), with running balance correct.
4) Record payment form: التاريخ (default today) + المبلغ + طريقة_الدفع (combobox) + حساب_الخزنة (combobox). For now implement the party-side ledger entry (customer: دائن; supplier: مدين) and balance update inside a $transaction. Leave a clearly marked integration point (TODO) for the Treasury side (Phase 9) — do not duplicate logic; structure it so Phase 9 just plugs in.
5) Implement the balance conventions EXACTLY as in CLAUDE.md (customer Σمدين−Σدائن; supplier Σدائن−Σمدين). Recompute الرصيد_بعد_الحركة for the whole chain on edit/delete.

Business rules / edge cases:
- Editing/deleting a past movement recomputes all later balances for that party.
- Payment amount must be > 0; warn (but allow) if it makes a customer balance negative (overpayment).

Acceptance criteria (use numbers):
- New customer balance 0 → add a manual مدين 185,000 → balance 185,000 → record payment 50,000 → balance 135,000, and the movements table shows the correct running balance. Responsive on mobile.

End with the "Phase 4 Summary".
```

---

## Prompt 5 — Treasury (4 Accounts)

```
PHASE 5
Goal: treasury with four live account balances and a consistent transaction ledger.

Detailed spec:
1) /treasury: 4 KpiCards (إنستا_باي / نقدي / بنك / فودافون_كاش) + a total-balance card, all live.
2) Record transaction (Server Action in $transaction): النوع (combobox إيراد/مصروف); income +account+total, expense −account−total; fields التاريخ(default today), النوع, المبلغ(>0), الحساب(combobox), البيان, الطرف?(combobox), رقم الفاتورة?. Compute/store الرصيد_بعد_الحركة for that account.
3) Transactions log (DataTable): filters الحساب/النوع/الفترة (comboboxes + date range), green income / red expense, search, pagination.
4) Edit/delete: recompute the affected account's chain + total + activity log.
5) Threshold alert: flag accounts whose الرصيد < الحد_الأدنى (used on dashboard later).

Edge cases: an expense that would drive an account negative → warn clearly (confirm: block or allow? ask me; default = allow with warning). Editing النوع or الحساب must move balances correctly between accounts.

Acceptance criteria (numbers):
- Bank starts 0 → income 50,000 → Bank 50,000, total +50,000 → expense 12,000 from Cash → Cash −12,000, total reflects both. Editing the 50,000 to 60,000 updates Bank and total correctly.

End with the "Phase 5 Summary".
```

---

## Prompt 6 — Invoices (auto-grouping + print/PDF)

```
PHASE 6
Goal: create electronic invoices matching the paper layout, with auto-grouping and a customer-ledger link.

Detailed spec:
1) /invoices (list: الرقم, العميل, التاريخ, الإجمالي, actions; search/sort/paginate), /invoices/new, /invoices/[id].
2) Header: auto sequential unique الرقم (display zero-padded like 0005651), العميل (combobox from customers OR free text — if free text, decide whether to create a customer; ask me), الهاتف, التاريخ(default today).
3) Line items (dynamic add/remove rows, fast keyboard entry): اللون, الكمية, الوزن, التصنيف (combobox + inline add-new), السعر? (per pricing decision), ملاحظات.
4) Auto-grouping by التصنيف: compute إجمالي_الوزن and إجمالي_الكمية per category and overall; show a grouping summary block at the bottom (like the paper invoice).
5) Layout matching the paper invoice: company logo + name on top (from الإعدادات), العميل/الهاتف/التاريخ, the items table (البيان/العدد/الوزن style), the grouping summary, and an "الإجمالي / فقط وقدره" area (amount in Arabic words if pricing is enabled).
6) Print via a dedicated @media print stylesheet (clean, no app chrome) + Save as PDF.
7) On save (in $transaction): create the customer مدين ledger entry for the invoice value (per pricing decision), linked to الرقم, carrying category/qty/weight context; update the customer balance. (Full integration hardening in Phase 9.)

Business rules / edge cases:
- الرقم must be unique and gap-safe under concurrent creates.
- Editing an invoice must update its linked ledger entry and the customer balance accordingly; deleting an invoice removes/reverses its ledger entry. (Confirm edit/delete policy with me.)

Acceptance criteria (numbers):
- Create an invoice with items in categories 14×1, 28×2, برج → grouping shows correct per-category totals and grand totals; a sequential number is assigned; the customer gets a مدين entry equal to the invoice value; print/PDF looks like the paper model on A4.

End with the "Phase 6 Summary".
```

---

## Prompt 7 — Cheques (CRUD + monthly grouping + alerts)

```
PHASE 7
Goal: full cheque management with monthly grouping, totals, and overdue highlighting. (OCR is Phase 8.)

Detailed spec:
1) /cheques DataTable: اسم_المدين, المبلغ, المستفيد, محول_من, اسم_البنك, تاريخ_الاستحقاق, رقم_الشيك, الحالة(combobox). Search by any field; pagination.
2) Add/edit/delete (manual form now) + can() + activity log. الحالة via combobox (منتظر/محصّل/مرتجع).
3) Sort by تاريخ_الاستحقاق (asc/desc).
4) Monthly grouping: group by month of تاريخ_الاستحقاق (Tabs or Accordion), each group shows عدد الشيكات + إجمالي القيمة.
5) Overdue (تاريخ_الاستحقاق < today AND الحالة = منتظر) highlighted red.
6) Alert computations exposed for the dashboard: due within 7 days, due within current month, total due value, overdue list.

Edge cases: cheques far in the future; same due date sorting stable; changing الحالة to محصّل removes it from "overdue".

Acceptance criteria:
- Add cheques across 2–3 months → correct monthly groups and per-month totals; an overdue منتظر cheque shows red; search/sort work.

End with the "Phase 7 Summary".
```

---

## Prompt 8 — Cheque OCR Auto-Fill

```
PHASE 8
Goal: when adding a cheque, upload its image, auto-extract fields via OCR, prefill what's found, leave the rest blank for manual entry, and store the image.

Decide first (ask me): cheque-image storage on Railway (ephemeral FS). Recommended: store the image in Postgres (bytes/base64 in صورة_الشيك) for small images, OR a Railway Volume / Cloudinary. Implement the chosen option.

Backend:
1) Migration: add صورة_الشيك + نص_OCR to الشيك per the storage decision.
2) Route handler POST /api/cheques/ocr (multipart image): run OCR (Arabic + English + digits) and return a structured object: for each of اسم_المدين, المبلغ, المستفيد, محول_من, اسم_البنك, تاريخ_الاستحقاق, رقم_الشيك → { القيمة, الثقة } or null if not detected. Also return نص_OCR (raw text).
3) Implement OCR behind an interface خدمة_OCR with a default Tesseract.js (ara+eng) impl; make it pluggable (env-selected) so Google Vision / OCR.space can replace it for better handwriting.
4) Parsing helpers: amount (digits and/or Arabic number words), date normalization (accept dd/mm/yyyy and yyyy-mm-dd), cheque-number-like token, best-effort اسم_البنك match against a known Egyptian banks list.
5) Resilient: on failure or low confidence return nulls; log the raw text; never block manual entry.

Frontend (cheque Add dialog):
1) On "Add", open a dialog with an image upload (drag-drop + camera capture on mobile) and a clear "تخطّي / إدخال يدوي" option.
2) After upload: brief loading state → call /api/cheques/ocr → PREFILL detected fields; leave undetected EMPTY; subtly mark auto-filled fields (e.g. a small "تم استخراجه" hint) so the user verifies them.
3) The user reviews/edits all fields, then saves normally. The stored image is viewable from the cheque row/details.

Acceptance criteria:
- Uploading a clear cheque image fills several fields automatically; undetected fields stay blank; the image is stored persistently (per decision) and viewable; manual entry/skip always works; low-quality images degrade gracefully without errors.

End with the "Phase 8 Summary" — note observed accuracy and exact steps to plug a cloud OCR engine.
```

---

## Prompt 9 — Cross-Module Integration (the core)

```
PHASE 9
Goal: complete and harden all automatic linking so balances stay perfectly consistent across modules. Each case = ONE $transaction + activity log. Implement exactly per the CLAUDE.md "Automatic Linking" rules and worked example.

Detailed spec:
1) Invoice -> Customer: confirm/finish that saving an invoice posts a مدين entry on the customer for the invoice value, linked to الرقم, with category/qty/weight context, updating balance.
2) Treasury -> Customer (collection): one unified "record collection" service: INCOME X to the chosen account + دائن X on the customer (balance −X) + date/method + optional invoice link — atomic.
3) Treasury -> Supplier (disbursement): one unified "record disbursement" service: EXPENSE Y + مدين Y on the supplier (payable −Y) + date/method — atomic.
4) Refactor Phase 4's payment form to call these unified services (no duplicated logic). The same services power Treasury-side entry too.
5) Cascading edit/delete: editing/deleting an invoice, a collection, or a disbursement reverses and recomputes BOTH sides (party ledger chain + treasury account chain) with no inconsistency. Define and implement the policy (reverse-then-reapply).

Acceptance criteria (run this exact scenario and report it):
- أحمد balance 0 → invoice 185,000 → balance 185,000 → collect 50,000 via Bank → Bank +50,000, total +50,000, أحمد balance 135,000 → edit the collection to 60,000 → Bank +60,000, أحمد balance 125,000 → delete the collection → fully reversed (Bank back, أحمد balance 185,000). Activity log shows every step. No orphaned/inconsistent rows.

End with the "Phase 9 Summary" describing the tested scenario and the edit/delete policy.
```

---

## Prompt 10 — Main Dashboard

```
PHASE 10
Goal: a real-data dashboard summarizing the whole business.

Detailed spec (all from live DB):
1) Treasury: four account balances + total.
2) Customers: إجمالي مديونية العملاء (sum of positive customer balances), count of customers with balance > 0, top 10 by debt (table with links).
3) Suppliers: إجمالي المستحقات (sum of positive payables), count with outstanding, top 10.
4) Invoices: count today / this month, total sales today / this month.
5) Cheques: count due within 7 days / this month, total due value, overdue count/list.
6) Charts (Recharts): monthly sales, monthly collections, monthly expenses, and income-vs-expenses comparison (last 12 months).
7) Alerts center: cheques due soon + accounts below الحد_الأدنى + customers over حد_الائتمان. Each alert links to the relevant page.

Acceptance criteria:
- Numbers reconcile with the modules (e.g. dashboard customer-debt total equals the sum on the customers list). Charts render and are responsive.

End with the "Phase 10 Summary".
```

---

## Prompt 11 — Unified Search

```
PHASE 11
Goal: one search box that finds anything fast.

Detailed spec:
1) Route handler GET /api/search?q= searching customers, suppliers, invoices (by الرقم/العميل), cheques (by names/bank/number), treasury transactions (by البيان/الطرف). Return results grouped by type, capped per group.
2) Top-bar search UI: debounced input, grouped results dropdown, each result links to its page; keyboard navigable.
3) Performance: rely on the indexes from Phase 1; limit results; supports Arabic text and numeric queries.

Acceptance criteria:
- Searching a customer name, an invoice number, and a bank name each returns correct grouped results within a snappy response; clicking a result opens the right page.

End with the "Phase 11 Summary".
```

---

## Prompt 12 — Reports & Export (PDF / Excel)

```
PHASE 12
Goal: a reports center with consistent filters and PDF/Excel export.

Detailed spec — /reports (filters: party/account/type via comboboxes + date range):
1) Customers: account statement (kashf), total sales, total payments, current balance.
2) Suppliers: account statement, total purchases, payments, balance.
3) Treasury: income report, expense report, account-balances report.
4) Invoices: daily, monthly, by customer.
5) Cheques: due, overdue, by month.
6) Each report: on-screen view + print + PDF export + Excel export (SheetJS). Build ONE reusable export utility + export buttons. Arabic headers, EGP formatting, totals rows.

Acceptance criteria:
- Each report filters correctly, totals are right and reconcile with the modules, and PDF/Excel exports open with proper Arabic + numbers.

End with the "Phase 12 Summary".
```

---

## Prompt 13 — Deploy on Railway + Final Polish

```
PHASE 13
Goal: a polished, production-ready app live on Railway.

Polish:
1) Responsive QA on phone + desktop; fix any layout breaks. Arabic validation/error messages everywhere. Empty/loading/error states on all lists. Confirm dialogs on destructive actions.
2) Realistic seed data for a full demo (customers, suppliers, invoices across categories, treasury transactions across accounts, cheques across months incl. one sample image).
3) Performance pass: indexes, pagination, remove N+1, compress cheque images.
4) /settings (ADMIN): company name, logo (used on invoices), per-account الحد_الأدنى, default حد_الائتمان, payment-method list.

Railway deployment (do it step by step and document):
5) Production readiness: all secrets from env; a release step that runs `prisma migrate deploy` before starting Next.js; ensure Prisma client is generated on build; set NEXTAUTH_URL to the Railway public URL.
6) Push the repo to GitHub.
7) On Railway: create the project, add the PostgreSQL plugin (reuse its DATABASE_URL), add a service from the GitHub repo; set env vars (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, OCR keys if cloud); build = next build, start = migrate-then-start.
8) Deploy; run the seed once; smoke-test on the live URL: login, create a customer, create an invoice, record a collection (verify treasury + balance), add a cheque with OCR.
9) Write docs/DEPLOY.md: exact Railway steps, env vars, migrate/seed commands, and backups (Railway Postgres backups + pg_dump export/restore).

Acceptance criteria:
- App is live on a Railway URL, connected to Railway Postgres, migrations applied, all core flows working; DEPLOY.md complete.

End with the "Phase 13 Summary" + a FINAL CHECKLIST mapping every SRS requirement to Done/Partial/Deferred.
```

---

## Notes for you (the owner)

- This v5 is intentionally detailed so Claude doesn't guess. The few **decision points** Claude will ask about: the two owners' usernames/passwords (أحمد سكر / محمود سكر), balance computed vs stored, invoice numbering, DB names Arabic vs English, **invoice pricing** (how the invoice's money value is set), invoice edit/delete policy, treasury-negative policy, and cheque-image storage. Have quick answers ready (or let Claude propose defaults).
- **Fast path:** phases 0→9 = a working, fully-linked system (incl. cheque OCR). 10→13 = dashboard, search, reports, and the live Railway deploy.
- After each phase summary, send it to me to review before the next.
- I can still add a **database ERD diagram** or a dedicated **Testing prompt** (unit + e2e) — just say the word.

— End of plan v5 —
