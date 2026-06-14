"use client";
import * as React from "react";
import Link from "next/link";
import { signOut } from "next-auth/react";
import { Menu, PanelRightClose, PanelRightOpen, LogOut, KeyRound, ChevronDown, UserCircle2 } from "lucide-react";
import type { Role } from "@prisma/client";
import { الزر } from "@/components/ui/button";
import { الشارة } from "@/components/ui/badge";
import {
  قائمة_منسدلة,
  مشغل_منسدلة,
  محتوى_منسدلة,
  عنصر_منسدلة,
  فاصل_منسدلة,
} from "@/components/ui/dropdown-menu";
import { البحث_الموحد } from "@/components/search/global-search";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";
import { زر_المظهر, زر_اللغة } from "./toggles";

export function الشريط_العلوي({
  المستخدم,
  عند_طي_الجانبي,
  عند_فتح_الدرج,
  مطوي,
}: {
  المستخدم: { name: string; role: Role };
  عند_طي_الجانبي: () => void;
  عند_فتح_الدرج: () => void;
  مطوي: boolean;
}) {
  const { t } = استخدام_اللغة();
  return (
    <header className="glass-panel sticky top-0 z-30 flex h-16 items-center gap-2 border-b px-4">
      <الزر variant="ghost" size="icon" className="lg:hidden" onClick={عند_فتح_الدرج} title={t("topbar.open_menu")}>
        <Menu className="size-5" />
      </الزر>
      <الزر
        variant="ghost"
        size="icon"
        className="hidden lg:inline-flex"
        onClick={عند_طي_الجانبي}
        title={t("topbar.toggle_sidebar")}
      >
        {مطوي ? <PanelRightOpen className="size-5" /> : <PanelRightClose className="size-5" />}
      </الزر>

      <div className="flex-1">
        <البحث_الموحد />
      </div>

      <زر_اللغة />
      <زر_المظهر />

      <قائمة_منسدلة>
        <مشغل_منسدلة asChild>
          <الزر variant="outline" className="gap-2">
            <UserCircle2 className="size-5" />
            <span className="hidden sm:inline">{المستخدم.name}</span>
            <ChevronDown className="size-4 opacity-60" />
          </الزر>
        </مشغل_منسدلة>
        <محتوى_منسدلة className="min-w-56">
          <div className="px-3 py-2">
            <p className="text-sm font-medium">{المستخدم.name}</p>
            <الشارة variant="navy" className="mt-1">
              {t(`role.${المستخدم.role}` as `role.${Role}`)}
            </الشارة>
          </div>
          <فاصل_منسدلة />
          <عنصر_منسدلة asChild>
            <Link href="/change-password">
              <KeyRound className="size-4" /> {t("topbar.change_password")}
            </Link>
          </عنصر_منسدلة>
          <عنصر_منسدلة خطر onSelect={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="size-4" /> {t("topbar.logout")}
          </عنصر_منسدلة>
        </محتوى_منسدلة>
      </قائمة_منسدلة>
    </header>
  );
}
