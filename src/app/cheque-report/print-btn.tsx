"use client";
import { Printer } from "lucide-react";

export function زر_طباعة_التقرير() {
  return (
    <button
      onClick={() => window.print()}
      className="no-print flex items-center gap-1.5 rounded-lg bg-[#1F3864] px-4 py-2 text-sm font-medium text-white shadow-sm hover:opacity-90"
    >
      <Printer className="size-4" />
      طباعة / تحميل PDF
    </button>
  );
}
