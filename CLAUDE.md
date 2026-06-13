# CLAUDE.md — Soker ERP (المخ المشترك / Shared Brain)

> Save target of the Master Prompt from `docs/ERP-Build-Plan.md`. Re-read before every phase.
> User-facing language: **Arabic (RTL)**. Code identifiers: **Arabic**. Physical DB names: **English** via `@map`/`@@map`.

You will build a complete Business Management / ERP system, end to end, in phases, as ONE Next.js project deployed on Railway. Follow this file in every phase. Re-read it before each phase.

==================================================
## 1) THE BUSINESS & THE IDEA
==================================================
This is for a trading business (textile/yarn-style: goods identified by COLOR and a CATEGORY/type such as "14×1", "28×2", "برج", tracked by both COUNT (العدد/الكمية) and WEIGHT (الوزن, kg)). Today they work on paper invoices + separate Excel files. We are replacing all of that with one Arabic (RTL) web ERP.

Four interconnected modules + shared features:
1. Cheques — standalone, with an OCR auto-fill feature (upload a cheque image -> extract fields).
2. Treasury — 4 independent accounts (InstaPay / Cash / Bank / Vodafone Cash) + a total balance.
3. Invoices — line items with auto-grouping by category, print/PDF, matching the paper layout.
4. Customers & Suppliers — a running account ledger per party with balance and payments.

Shared: main dashboard, unified search, reports (PDF/Excel), users & roles, activity log, settings.
The detailed requirements live in `docs/requirements.docx` — source of truth; re-check it for any field or rule.

==================================================
## 2) DOMAIN MODEL & BUSINESS RULES
==================================================
LEDGER (party account) uses two columns: مدين (debit) and دائن (credit), plus a running الرصيد_بعد_الحركة.

**CUSTOMER convention:**
- An invoice posts its monetary value into مدين (the customer now owes us more).
- A payment received posts into دائن (reduces what they owe).
- balance = Σ(مدين) − Σ(دائن). POSITIVE balance = customer owes us (مديونية).

**SUPPLIER convention (mirror):**
- A purchase/bill posts into دائن (we now owe them more).
- A payment we make posts into مدين (reduces what we owe).
- payable = Σ(دائن) − Σ(مدين). POSITIVE = we owe the supplier (مستحق للمورد).

Always recompute الرصيد_بعد_الحركة in chronological order; never trust a stale stored balance after edits/deletes — recompute the affected party's chain.

**TREASURY:**
- Each account has its own running balance. INCOME (إيراد) adds; EXPENSE (مصروف) subtracts.
- Total balance = sum of the four accounts, shown live.
- Store الرصيد_بعد_الحركة per treasury transaction; recompute the account's chain on edit/delete.

**AUTOMATIC LINKING (the heart — every case = ONE atomic Prisma `$transaction` + an activity-log entry):**
- **A) Invoice → Customer:** saving an invoice creates a مدين ledger entry on the customer for the invoice value, linked to the invoice number, carrying category/qty/weight context; updates the customer balance.
- **B) Treasury → Customer (collection):** recording a customer payment X atomically: add INCOME X to the chosen treasury account (+X to account & total); add دائن X ledger entry on the customer (balance −X); save date + method (+ optional invoice link).
- **C) Treasury → Supplier (disbursement):** paying a supplier Y atomically: add EXPENSE Y (−Y); add مدين Y ledger entry on the supplier (payable −Y); save date (+ method).
- **D) Edit/Delete** of any linked entry must reverse/adjust ALL linked sides and recompute balances; never leave data inconsistent. Policy = **reverse-then-reapply**.

**WORKED EXAMPLE (must hold true end to end):**
- Customer "أحمد" starts at balance 0.
- Issue invoice #5651 worth 185,000 → ledger مدين 185,000 → أحمد balance = 185,000.
- أحمد pays 50,000 via Bank → Treasury Bank +50,000; ledger دائن 50,000 → balance = 135,000.
- Dashboard "إجمالي مديونية العملاء" includes أحمد's 135,000. Treasury total +50,000. Activity log shows both.

**MONEY & NUMBERS:**
- All money is Prisma `Decimal`; do all math with a Decimal/"Money" helper (NEVER JS float). Round to 2 decimals for display, keep full precision in storage. Weight/qty may have decimals (Decimal).
- Currency EGP. Display Western digits with thousands separators, e.g. `1,250,475.00`. Accept input with or without separators.

**DATES:** Store as DateTime/Date; default new entries to today; show dd/mm/yyyy. Cheques sort by تاريخ_الاستحقاق.

==================================================
## 2b) USERS & ACCOUNTABILITY (two owners)
==================================================
Operated by TWO owners, each with FULL access (add/edit/delete anything):
- **أحمد سكر** (username `ahmed`)
- **محمود سكر** (the father, username `mahmoud`)

Seed both as ADMIN. Temporary password `Soker@2026` — **FLAGGED to be changed**. Keep the role model (مدير/محاسب/قراءة_فقط) so staff can be added later.

Accountability is TOP priority — the two owners must see exactly who did what:
- Every business record (الطرف, الفاتورة, بند_الفاتورة, حركة_الحساب, حركة_الخزنة, الشيك, الإعدادات) stores: أنشئ_بواسطة (createdBy → المستخدم) + تاريخ_الإنشاء, and عُدّل_بواسطة (updatedBy → المستخدم) + تاريخ_التعديل.
- The actor is ALWAYS taken from the authenticated session, never the client. No action without a logged-in user.
- Show on each record: "أضيف بواسطة: [الاسم] — [التاريخ/الوقت]" and "آخر تعديل: [الاسم] — [التاريخ/الوقت]". Lists show a small "بواسطة" indicator.
- Write an ActivityLog row for every create/update/delete (who, when, what, before/after where useful).
- Per-record HISTORY view + `/activity-log` page filterable by PERSON (أحمد / محمود), entity type, date range.

==================================================
## 3) TECH STACK (ONE project)
==================================================
- Next.js 14+ (App Router) + TypeScript (strict). Logic via Server Actions; route handlers for OCR and search.
- Tailwind CSS + shadcn/ui (Select/Combobox, Dialog, Table, Tabs, etc.).
- Prisma ORM + PostgreSQL (Railway). Auth.js (NextAuth) credentials + bcrypt; roles ADMIN/ACCOUNTANT/READONLY.
- Zod for validation (shared client+server schemas). Recharts for charts. SheetJS (xlsx) for Excel. date-fns for dates.
- OCR pluggable: default Tesseract.js (ara+eng); optional cloud (Google Vision / OCR.space) via env.
- Arabic font (Cairo or IBM Plex Sans Arabic) via next/font.

==================================================
## 4) CODE LANGUAGE RULE
==================================================
- ALL TypeScript identifiers in **ARABIC**: Prisma fields, types/interfaces, variables, function names, component props, enum values. Multi-word with underscores: `اسم_المدين`, `تاريخ_الاستحقاق`, `حركة_الحساب`.
- ENGLISH/ASCII only for: physical DB table/column names (`@map`/`@@map`), route/URL paths (`/api/...`), and file names.
- JSON over the wire uses the Arabic property names, so types match end to end.
- ONE glossary (`docs/glossary.md`) — reuse the same identifier for the same concept everywhere.
- All USER-FACING text is Arabic.

==================================================
## 5) UI / UX STANDARDS
==================================================
- Comboboxes for every fixed-choice selector (searchable when long): treasury type, payment method, treasury account, party type, invoice category (inline add-new), cheque status, user role, all report filters.
- Add flow: "إضافة" opens a clear form showing ALL agreed fields at once — Dialog for short forms, full page for invoices. Required marks, inline Arabic validation, autofocus first field, Save/Cancel. SAME form reused for Edit (prefilled).
- Fast entry: autofocus, Enter adds a new invoice row, numeric select-on-focus, sensible tab order, date pickers default to today.
- Every list: search, sort, pagination (20/page), EmptyState, loading skeleton, error state. Tables → cards on mobile.
- ConfirmDialog on destructive actions. Toast after every mutation. MoneyText + DateText components.

==================================================
## 6) DESIGN SYSTEM (white theme)
==================================================
- Background `#FFFFFF` / app gray `#F8FAFC`. Cards white, border `#E5E7EB`, soft shadow, rounded-xl. Primary navy `#1F3864` / blue `#2563EB`. Status: green income, red expense/overdue, amber warning. Generous spacing, strong contrast.
- RTL by default (`<html dir="rtl" lang="ar">`), English text/numbers LTR inline.
- Responsive: desktop = collapsible RIGHT sidebar + top bar (unified search + user menu); mobile = drawer/hamburger + optional bottom nav.

==================================================
## 7) QUALITY BAR, SECURITY & CONVENTIONS
==================================================
- TypeScript strict, no `any`. Validate EVERY input on the server with the shared Zod schema. Authorize EVERY mutation server-side via a single `can(user, action)` helper, regardless of UI.
- Layered: `app/` routes; `components/ui` (shadcn) + `components/` (project: Combobox/DataTable/KpiCard); `lib/` (prisma, auth, money, date, validation, ocr); server actions colocated; `prisma/`.
- All multi-write ops inside `prisma.$transaction`. Consistent result type `{ نجاح, رسالة, بيانات }`.
- Activity log is append-only.
- Secrets only from env (DATABASE_URL, NEXTAUTH_SECRET, NEXTAUTH_URL, OCR keys). Railway FS is ephemeral — cheque images stored in Postgres (bytes/base64).
- Performance: index search/sort/filter fields; paginate everything; avoid N+1.

==================================================
## 8) HOW WE WORK
==================================================
- Phases 0 → 13, in order. End each phase with a Phase Summary in EXACTLY this format → `docs/summaries/phase-XX.md`:
  ```
  ### ✅ Phase [n] Summary: [name]
  - What was done:
  - Files added/changed:
  - How to run & test (commands + click-path):
  - Business rules / decisions / assumptions:  (قرارات اتخذتها)
  - Missing / deferred:
  - Questions I need answered before continuing:
  ```
- `git commit` after each phase: `Phase XX: <name>`.

==================================================
## 9) PRE-APPROVED DECISIONS (standing approval — never stop for these)
==================================================
- **Owners:** seed أحمد سكر (`ahmed`) + محمود سكر (`mahmoud`), both ADMIN, temp password `Soker@2026` (FLAG to change). Stamp createdBy/updatedBy on every record.
- **Invoice pricing:** price **BY WEIGHT** → line total = السعر × الوزن(kg); invoice total = Σ line totals; total posts as مدين on the customer. (Switch to by-count only if owner says so later.)
- **Balance:** STORED balance updated inside each transaction, PLUS a `recompute()` to rebuild/verify a party's or account's chain after edits/deletes.
- **DB names:** physical table/column names English (`@map`/`@@map`); all code identifiers Arabic.
- **Cheque image storage:** store image in Postgres (bytes/base64) so it persists on Railway.
- **Treasury negative balance:** allow but show a warning.
- **Invoice & transaction edit/delete:** allowed; always reverse-then-reapply linked ledger/treasury entries; log it.

==================================================
## 10) LOCAL DEV / TEST ENVIRONMENT NOTE
==================================================
- No Docker/Postgres on the build machine and no Railway URL provided → local self-tests run against a **real local PostgreSQL** started via the `embedded-postgres` npm package (genuine PG binary; same Decimal semantics). Connection string lands in `.env` as `DATABASE_URL`. Production swaps in the Railway URL — schema identical. See `scripts/` and `docs/DEPLOY.md`.
