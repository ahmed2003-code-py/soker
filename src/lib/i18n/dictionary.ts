/**
 * قاموس الترجمة المركزي (عربي/إنجليزي).
 * كل نص واجهة أساسي يمر من هنا. المفاتيح ثابتة عبر اللغتين.
 * نبدأ بالأساسيات (مصادقة + الهيكل + الداشبورد) ونوسّع تدريجيًا.
 */
export const القاموس = {
  ar: {
    /* ─── العلامة ─── */
    "app.name": "سُكر",
    "app.tagline": "نظام إدارة الأعمال",

    /* ─── التنقّل ─── */
    "nav.dashboard": "الرئيسية",
    "nav.invoices": "الفواتير",
    "nav.customers": "العملاء",
    "nav.suppliers": "الموردون",
    "nav.treasury": "الخزنة",
    "nav.cheques": "الشيكات",
    "nav.reports": "التقارير",
    "nav.users": "المستخدمون",
    "nav.activity": "سجل العمليات",
    "nav.settings": "الإعدادات",

    /* ─── الشريط العلوي / المستخدم ─── */
    "topbar.change_password": "تغيير كلمة المرور",
    "topbar.logout": "تسجيل الخروج",
    "topbar.toggle_sidebar": "طيّ/فتح الشريط الجانبي",
    "topbar.open_menu": "فتح القائمة",
    "topbar.theme_toggle": "تغيير المظهر (فاتح / داكن)",
    "topbar.lang_toggle": "تغيير اللغة",

    /* ─── الأدوار ─── */
    "role.ADMIN": "مدير",
    "role.ACCOUNTANT": "محاسب",
    "role.READONLY": "قراءة فقط",

    /* ─── شائع ─── */
    "common.save": "حفظ",
    "common.cancel": "إلغاء",
    "common.loading": "جارٍ التحميل…",
    "common.required": "مطلوب",
    "common.search": "بحث",
    "common.view": "عرض",
    "common.edit": "تعديل",
    "common.delete": "حذف",
    "common.history": "السجل",

    /* ─── الجدول ─── */
    "dt.search": "ابحث…",
    "dt.empty": "لا توجد سجلات",
    "dt.actions": "إجراءات",
    "dt.records_page": "{count} سجل — صفحة {current} من {total}",
    "dt.prev": "السابق",
    "dt.next": "التالي",

    /* ─── الفواتير ─── */
    "inv.title": "الفواتير",
    "inv.subtitle": "إنشاء وإدارة الفواتير",
    "inv.new": "فاتورة جديدة",
    "inv.col.number": "رقم الفاتورة",
    "inv.col.customer": "العميل",
    "inv.col.date": "التاريخ",
    "inv.col.total_weight": "إجمالي الوزن",
    "inv.col.total": "الإجمالي",
    "inv.kg": "كجم",
    "inv.search": "ابحث برقم الفاتورة أو العميل…",
    "inv.empty": "لا توجد فواتير بعد",
    "inv.delete_title": "حذف الفاتورة {number}",
    "inv.delete_desc": "سيتم عكس قيد العميل المرتبط بهذه الفاتورة.",

    /* ─── تسجيل الدخول ─── */
    "login.title": "تسجيل الدخول",
    "login.username": "اسم المستخدم",
    "login.password": "كلمة المرور",
    "login.submit": "دخول",
    "login.submitting": "جارٍ الدخول…",
    "login.error": "اسم المستخدم أو كلمة المرور غير صحيحة",
    "login.owners_hint": "للمالكَين: ahmed / mahmoud",
    "login.forgot": "نسيت كلمة المرور؟ اطلب من المالك الآخر إعادة تعيينها.",

    /* ─── تغيير كلمة المرور ─── */
    "cpw.title": "تغيير كلمة المرور",
    "cpw.must_change": "كلمة المرور الحالية مؤقتة — يجب تغييرها قبل المتابعة.",
    "cpw.current": "كلمة المرور الحالية",
    "cpw.new": "كلمة المرور الجديدة",
    "cpw.confirm": "تأكيد كلمة المرور",
    "cpw.submit": "تغيير كلمة المرور",

    /* ─── الداشبورد ─── */
    "dash.title": "لوحة التحكم",
    "dash.subtitle": "ملخّص حيّ لكامل النشاط",
    "dash.kpi.treasury_total": "إجمالي الخزنة",
    "dash.kpi.customer_debt": "مديونية العملاء",
    "dash.kpi.supplier_payable": "مستحقات الموردين",
    "dash.kpi.month_sales": "مبيعات هذا الشهر",
    "dash.customers_count": "{count} عميل مدين",
    "dash.suppliers_count": "{count} مورد",
    "dash.invoices_count_month": "{count} فاتورة",
    "dash.under_threshold": "تحت الحد الأدنى",
    "dash.alerts": "مركز التنبيهات",
    "dash.cheque_overdue": "{count} شيك متأخر",
    "dash.cheque_due7": "{count} شيك يستحق خلال 7 أيام",
    "dash.account_under": "حساب {name} تحت الحد الأدنى",
    "dash.credit_over": "العميل {name} تجاوز حد الائتمان",
    "dash.invoices_today": "فواتير اليوم",
    "dash.sales_label": "مبيعات: {amount}",
    "dash.cheques_due_month": "شيكات تستحق هذا الشهر",
    "dash.cheques_overdue": "شيكات متأخرة",
    "dash.cheques_total_due": "إجمالي الشيكات المستحقة",
    "dash.top_customers": "أعلى 10 عملاء مديونية",
    "dash.top_suppliers": "أعلى 10 موردين مستحقات",
    "dash.none": "لا يوجد.",

    /* ─── الرسوم البيانية ─── */
    "chart.monthly_sales": "المبيعات الشهرية (آخر 12 شهراً)",
    "chart.monthly_collections": "التحصيلات الشهرية",
    "chart.monthly_expenses": "المصروفات الشهرية",
    "chart.income_vs_expense": "الإيرادات مقابل المصروفات",
    "chart.income": "إيرادات",
    "chart.expenses": "مصروفات",
  },
  en: {
    /* ─── brand ─── */
    "app.name": "Soker",
    "app.tagline": "Business Management System",

    /* ─── nav ─── */
    "nav.dashboard": "Dashboard",
    "nav.invoices": "Invoices",
    "nav.customers": "Customers",
    "nav.suppliers": "Suppliers",
    "nav.treasury": "Treasury",
    "nav.cheques": "Cheques",
    "nav.reports": "Reports",
    "nav.users": "Users",
    "nav.activity": "Activity Log",
    "nav.settings": "Settings",

    /* ─── topbar / user ─── */
    "topbar.change_password": "Change password",
    "topbar.logout": "Sign out",
    "topbar.toggle_sidebar": "Collapse/expand sidebar",
    "topbar.open_menu": "Open menu",
    "topbar.theme_toggle": "Toggle theme (light / dark)",
    "topbar.lang_toggle": "Switch language",

    /* ─── roles ─── */
    "role.ADMIN": "Admin",
    "role.ACCOUNTANT": "Accountant",
    "role.READONLY": "Read only",

    /* ─── common ─── */
    "common.save": "Save",
    "common.cancel": "Cancel",
    "common.loading": "Loading…",
    "common.required": "required",
    "common.search": "Search",
    "common.view": "View",
    "common.edit": "Edit",
    "common.delete": "Delete",
    "common.history": "History",

    /* ─── data table ─── */
    "dt.search": "Search…",
    "dt.empty": "No records",
    "dt.actions": "Actions",
    "dt.records_page": "{count} records — page {current} of {total}",
    "dt.prev": "Previous",
    "dt.next": "Next",

    /* ─── invoices ─── */
    "inv.title": "Invoices",
    "inv.subtitle": "Create and manage invoices",
    "inv.new": "New invoice",
    "inv.col.number": "Invoice #",
    "inv.col.customer": "Customer",
    "inv.col.date": "Date",
    "inv.col.total_weight": "Total weight",
    "inv.col.total": "Total",
    "inv.kg": "kg",
    "inv.search": "Search by invoice # or customer…",
    "inv.empty": "No invoices yet",
    "inv.delete_title": "Delete invoice {number}",
    "inv.delete_desc": "The linked customer ledger entry will be reversed.",

    /* ─── login ─── */
    "login.title": "Sign in",
    "login.username": "Username",
    "login.password": "Password",
    "login.submit": "Sign in",
    "login.submitting": "Signing in…",
    "login.error": "Incorrect username or password",
    "login.owners_hint": "Owners: ahmed / mahmoud",
    "login.forgot": "Forgot your password? Ask the other owner to reset it.",

    /* ─── change password ─── */
    "cpw.title": "Change password",
    "cpw.must_change": "Your current password is temporary — change it before continuing.",
    "cpw.current": "Current password",
    "cpw.new": "New password",
    "cpw.confirm": "Confirm password",
    "cpw.submit": "Change password",

    /* ─── dashboard ─── */
    "dash.title": "Dashboard",
    "dash.subtitle": "Live overview of all activity",
    "dash.kpi.treasury_total": "Total treasury",
    "dash.kpi.customer_debt": "Customer receivables",
    "dash.kpi.supplier_payable": "Supplier payables",
    "dash.kpi.month_sales": "This month's sales",
    "dash.customers_count": "{count} customers in debt",
    "dash.suppliers_count": "{count} suppliers",
    "dash.invoices_count_month": "{count} invoices",
    "dash.under_threshold": "Below minimum",
    "dash.alerts": "Alerts center",
    "dash.cheque_overdue": "{count} overdue cheques",
    "dash.cheque_due7": "{count} cheques due within 7 days",
    "dash.account_under": "Account {name} is below minimum",
    "dash.credit_over": "Customer {name} exceeded credit limit",
    "dash.invoices_today": "Today's invoices",
    "dash.sales_label": "Sales: {amount}",
    "dash.cheques_due_month": "Cheques due this month",
    "dash.cheques_overdue": "Overdue cheques",
    "dash.cheques_total_due": "Total cheques due",
    "dash.top_customers": "Top 10 customers by debt",
    "dash.top_suppliers": "Top 10 suppliers by payable",
    "dash.none": "None.",

    /* ─── charts ─── */
    "chart.monthly_sales": "Monthly sales (last 12 months)",
    "chart.monthly_collections": "Monthly collections",
    "chart.monthly_expenses": "Monthly expenses",
    "chart.income_vs_expense": "Income vs expenses",
    "chart.income": "Income",
    "chart.expenses": "Expenses",
  },
} as const;

/** مفاتيح الترجمة المتاحة (مشتقّة من العربية كمصدر للحقيقة). */
export type مفتاح_ترجمة = keyof (typeof القاموس)["ar"];
