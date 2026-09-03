import {
  LayoutDashboard,
  FileText,
  Users,
  Truck,
  Wallet,
  Receipt,
  PiggyBank,
  Boxes,
  BarChart3,
  UserCog,
  ScrollText,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@prisma/client";
import type { مفتاح_ترجمة } from "@/lib/i18n";

export type عنصر_تنقل = {
  المفتاح: مفتاح_ترجمة;
  المسار: string;
  الأيقونة: LucideIcon;
  مديرون_فقط?: boolean;
  ضمن_الشريط_السفلي?: boolean;
};

export const عناصر_التنقل: عنصر_تنقل[] = [
  { المفتاح: "nav.dashboard", المسار: "/dashboard", الأيقونة: LayoutDashboard, ضمن_الشريط_السفلي: true },
  { المفتاح: "nav.invoices", المسار: "/invoices", الأيقونة: FileText, ضمن_الشريط_السفلي: true },
  { المفتاح: "nav.customers", المسار: "/customers", الأيقونة: Users, ضمن_الشريط_السفلي: true },
  { المفتاح: "nav.treasury", المسار: "/treasury", الأيقونة: Wallet, ضمن_الشريط_السفلي: true },
  { المفتاح: "nav.cheques", المسار: "/cheques", الأيقونة: Receipt, ضمن_الشريط_السفلي: true },
  { المفتاح: "nav.suppliers", المسار: "/suppliers", الأيقونة: Truck },
  { المفتاح: "nav.expenses", المسار: "/monthly-expenses", الأيقونة: PiggyBank },
  { المفتاح: "nav.reports", المسار: "/reports", الأيقونة: BarChart3 },
  { المفتاح: "nav.users", المسار: "/users", الأيقونة: UserCog, مديرون_فقط: true },
  { المفتاح: "nav.activity", المسار: "/activity-log", الأيقونة: ScrollText, مديرون_فقط: true },
  { المفتاح: "nav.settings", المسار: "/settings", الأيقونة: Settings, مديرون_فقط: true },
];

/** عنصر المخزن — يظهر فقط لما يكون مفعّلاً من الإعدادات */
const عنصر_المخزن: عنصر_تنقل = { المفتاح: "nav.inventory", المسار: "/inventory", الأيقونة: Boxes };

export function عناصر_مرئية(الدور: Role, مخزن_مفعّل = false): عنصر_تنقل[] {
  const الكل = مخزن_مفعّل
    ? [
        ...عناصر_التنقل.slice(0, عناصر_التنقل.findIndex((ع) => ع.المسار === "/reports")),
        عنصر_المخزن,
        ...عناصر_التنقل.slice(عناصر_التنقل.findIndex((ع) => ع.المسار === "/reports")),
      ]
    : عناصر_التنقل;
  return الكل.filter((ع) => !ع.مديرون_فقط || الدور === "ADMIN");
}
