import {
  LayoutDashboard,
  FileText,
  Users,
  Truck,
  Wallet,
  Receipt,
  BarChart3,
  UserCog,
  ScrollText,
  Settings,
  type LucideIcon,
} from "lucide-react";
import type { Role } from "@prisma/client";

export type عنصر_تنقل = {
  العنوان: string;
  المسار: string;
  الأيقونة: LucideIcon;
  مديرون_فقط?: boolean;
  ضمن_الشريط_السفلي?: boolean;
};

export const عناصر_التنقل: عنصر_تنقل[] = [
  { العنوان: "الرئيسية", المسار: "/dashboard", الأيقونة: LayoutDashboard, ضمن_الشريط_السفلي: true },
  { العنوان: "الفواتير", المسار: "/invoices", الأيقونة: FileText, ضمن_الشريط_السفلي: true },
  { العنوان: "العملاء", المسار: "/customers", الأيقونة: Users, ضمن_الشريط_السفلي: true },
  { العنوان: "الموردون", المسار: "/suppliers", الأيقونة: Truck, ضمن_الشريط_السفلي: true },
  { العنوان: "الخزنة", المسار: "/treasury", الأيقونة: Wallet },
  { العنوان: "الشيكات", المسار: "/cheques", الأيقونة: Receipt },
  { العنوان: "التقارير", المسار: "/reports", الأيقونة: BarChart3 },
  { العنوان: "المستخدمون", المسار: "/users", الأيقونة: UserCog, مديرون_فقط: true },
  { العنوان: "سجل العمليات", المسار: "/activity-log", الأيقونة: ScrollText, مديرون_فقط: true },
  { العنوان: "الإعدادات", المسار: "/settings", الأيقونة: Settings, مديرون_فقط: true },
];

export function عناصر_مرئية(الدور: Role): عنصر_تنقل[] {
  return عناصر_التنقل.filter((ع) => !ع.مديرون_فقط || الدور === "ADMIN");
}
