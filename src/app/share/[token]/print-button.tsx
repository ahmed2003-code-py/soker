"use client";
import { Printer } from "lucide-react";

export function زر_طباعة() {
  return (
    <button
      onClick={() => window.print()}
      className="flex items-center gap-1.5 rounded-lg border border-gray-300 bg-white px-3 py-1.5 text-sm font-medium text-gray-700 shadow-sm hover:bg-gray-50"
    >
      <Printer className="size-4" />
      طباعة / تحميل PDF
    </button>
  );
}
