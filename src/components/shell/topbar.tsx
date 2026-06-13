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
import { تسمية_الدور } from "@/lib/enums";
import { البحث_الموحد } from "@/components/search/global-search";

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
  return (
    <header className="sticky top-0 z-30 flex h-16 items-center gap-3 border-b border-border bg-white px-4">
      <الزر variant="ghost" size="icon" className="lg:hidden" onClick={عند_فتح_الدرج}>
        <Menu className="size-5" />
      </الزر>
      <الزر variant="ghost" size="icon" className="hidden lg:inline-flex" onClick={عند_طي_الجانبي}>
        {مطوي ? <PanelRightOpen className="size-5" /> : <PanelRightClose className="size-5" />}
      </الزر>

      <div className="flex-1">
        <البحث_الموحد />
      </div>

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
              {تسمية_الدور[المستخدم.role]}
            </الشارة>
          </div>
          <فاصل_منسدلة />
          <عنصر_منسدلة asChild>
            <Link href="/change-password">
              <KeyRound className="size-4" /> تغيير كلمة المرور
            </Link>
          </عنصر_منسدلة>
          <عنصر_منسدلة خطر onSelect={() => signOut({ callbackUrl: "/login" })}>
            <LogOut className="size-4" /> تسجيل الخروج
          </عنصر_منسدلة>
        </محتوى_منسدلة>
      </قائمة_منسدلة>
    </header>
  );
}
