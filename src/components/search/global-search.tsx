"use client";
import * as React from "react";
import { Search } from "lucide-react";
import { الحقل } from "@/components/ui/input";

/**
 * حقل البحث الموحّد في الشريط العلوي.
 * في المرحلة 3 هو واجهة فقط؛ يُفعَّل فعلياً في المرحلة 11 (بحث موحّد عبر /api/search).
 */
export function البحث_الموحد() {
  return (
    <div className="relative max-w-md">
      <Search className="absolute end-3 top-1/2 size-4 -translate-y-1/2 opacity-50" />
      <الحقل placeholder="بحث موحّد… (عملاء، فواتير، شيكات)" className="pe-9" disabled />
    </div>
  );
}
