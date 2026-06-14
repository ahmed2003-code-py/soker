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
    "dash.subtitle": "نظرة عامة على الأعمال",
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
    "dash.subtitle": "Business overview",
  },
} as const;

/** مفاتيح الترجمة المتاحة (مشتقّة من العربية كمصدر للحقيقة). */
export type مفتاح_ترجمة = keyof (typeof القاموس)["ar"];
