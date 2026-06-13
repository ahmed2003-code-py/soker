"use client";
import * as React from "react";
import { Check, ChevronsUpDown, Plus, Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { منبثقة, مشغل_منبثقة, محتوى_منبثقة } from "@/components/ui/popover";
import { الحقل } from "@/components/ui/input";

export type خيار = { القيمة: string; التسمية: string };

type الخصائص = {
  الخيارات: خيار[];
  القيمة?: string | null;
  عند_التغيير: (القيمة: string) => void;
  نص_بديل?: string;
  نص_البحث?: string;
  قابل_للبحث?: boolean;
  /** إتاحة "إضافة جديد" داخل القائمة */
  عند_الإضافة?: (نص: string) => void | Promise<void>;
  تسمية_الإضافة?: string;
  className?: string;
  disabled?: boolean;
};

/** قائمة منسدلة قابلة للبحث مع خيار إضافة عنصر جديد */
export function قائمة_اختيار({
  الخيارات,
  القيمة,
  عند_التغيير,
  نص_بديل = "اختر…",
  نص_البحث = "ابحث…",
  قابل_للبحث = true,
  عند_الإضافة,
  تسمية_الإضافة = "إضافة",
  className,
  disabled,
}: الخصائص) {
  const [مفتوح, تعيين_مفتوح] = React.useState(false);
  const [بحث, تعيين_بحث] = React.useState("");

  const المختار = الخيارات.find((x) => x.القيمة === القيمة);
  const مُصفّاة = بحث
    ? الخيارات.filter((x) => x.التسمية.toLowerCase().includes(بحث.toLowerCase()))
    : الخيارات;

  const يمكن_الإضافة =
    عند_الإضافة &&
    بحث.trim() &&
    !الخيارات.some((x) => x.التسمية.trim() === بحث.trim());

  return (
    <منبثقة open={مفتوح} onOpenChange={تعيين_مفتوح}>
      <مشغل_منبثقة asChild>
        <button
          type="button"
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-input bg-white px-3 py-2 text-sm shadow-soft focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
            className
          )}
        >
          <span className={cn(!المختار && "text-muted-foreground")}>
            {المختار ? المختار.التسمية : نص_بديل}
          </span>
          <ChevronsUpDown className="size-4 opacity-60" />
        </button>
      </مشغل_منبثقة>
      <محتوى_منبثقة className="w-[--radix-popover-trigger-width] min-w-56 p-0">
        {قابل_للبحث && (
          <div className="flex items-center gap-2 border-b border-border px-3 py-2">
            <Search className="size-4 opacity-50" />
            <input
              autoFocus
              value={بحث}
              onChange={(e) => تعيين_بحث(e.target.value)}
              placeholder={نص_البحث}
              className="h-7 w-full bg-transparent text-sm outline-none"
            />
          </div>
        )}
        <div className="max-h-60 overflow-y-auto p-1">
          {مُصفّاة.length === 0 && !يمكن_الإضافة && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">
              لا نتائج
            </p>
          )}
          {مُصفّاة.map((x) => (
            <button
              key={x.القيمة}
              type="button"
              onClick={() => {
                عند_التغيير(x.القيمة);
                تعيين_مفتوح(false);
                تعيين_بحث("");
              }}
              className="flex w-full items-center justify-between rounded-lg px-3 py-2 text-sm hover:bg-appgray"
            >
              <span>{x.التسمية}</span>
              {x.القيمة === القيمة && <Check className="size-4 text-primary-blue" />}
            </button>
          ))}
          {يمكن_الإضافة && (
            <button
              type="button"
              onClick={async () => {
                await عند_الإضافة!(بحث.trim());
                تعيين_مفتوح(false);
                تعيين_بحث("");
              }}
              className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-sm text-primary-blue hover:bg-appgray"
            >
              <Plus className="size-4" />
              {تسمية_الإضافة} «{بحث.trim()}»
            </button>
          )}
        </div>
      </محتوى_منبثقة>
    </منبثقة>
  );
}
