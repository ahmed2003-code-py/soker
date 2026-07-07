"use client";
import * as React from "react";
import { Check, ChevronsUpDown, Plus, Search, Pencil, X } from "lucide-react";
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
  عند_الإضافة?: (نص: string) => void | Promise<void>;
  تسمية_الإضافة?: string;
  /** callback بعد اختيار خيار — يُستخدم للانتقال للحقل التالي */
  عند_الاختيار?: () => void;
  /** ref للزر المُشغِّل — للتركيز الخارجي */
  triggerRef?: React.RefCallback<HTMLButtonElement>;
  /** تعديل خيار موجود: (قديم، جديد) */
  عند_التعديل?: (قديم: string, جديد: string) => void;
  /** حذف خيار موجود */
  عند_الحذف?: (قيمة: string) => void;
  className?: string;
  disabled?: boolean;
};

export function قائمة_اختيار({
  الخيارات,
  القيمة,
  عند_التغيير,
  نص_بديل = "اختر…",
  نص_البحث = "ابحث…",
  قابل_للبحث = true,
  عند_الإضافة,
  تسمية_الإضافة = "إضافة",
  عند_الاختيار,
  triggerRef,
  عند_التعديل,
  عند_الحذف,
  className,
  disabled,
}: الخصائص) {
  const [مفتوح, تعيين_مفتوح] = React.useState(false);
  const [بحث, تعيين_بحث] = React.useState("");
  const [تعديل_نشط, تعيين_تعديل_نشط] = React.useState<string | null>(null);
  const [نص_التعديل, تعيين_نص_التعديل] = React.useState("");
  const searchRef = React.useRef<HTMLInputElement>(null);
  const itemButtonsRef = React.useRef<HTMLButtonElement[]>([]);

  // عند الفتح: ركّز على أول عنصر مباشرة
  React.useEffect(() => {
    if (مفتوح) {
      requestAnimationFrame(() => {
        const أول = itemButtonsRef.current[0];
        if (أول) أول.focus();
        else searchRef.current?.focus();
      });
    } else {
      تعيين_بحث("");
    }
  }, [مفتوح]);

  const المختار = الخيارات.find((x) => x.القيمة === القيمة);
  const مُصفّاة = بحث
    ? الخيارات.filter((x) => x.التسمية.toLowerCase().includes(بحث.toLowerCase()))
    : الخيارات;

  const يمكن_الإضافة =
    عند_الإضافة &&
    بحث.trim() &&
    !الخيارات.some((x) => x.التسمية.trim() === بحث.trim());

  function اختر(x: خيار) {
    عند_التغيير(x.القيمة);
    تعيين_مفتوح(false);
    تعيين_بحث("");
    // أبلغ الأب بعد إغلاق القائمة
    setTimeout(() => عند_الاختيار?.(), 20);
  }

  function ابدأ_التعديل(x: خيار) {
    تعيين_تعديل_نشط(x.القيمة);
    تعيين_نص_التعديل(x.التسمية);
  }

  function أكمل_التعديل(قيمة_قديمة: string) {
    const جديد = نص_التعديل.trim();
    if (جديد && عند_التعديل) عند_التعديل(قيمة_قديمة, جديد);
    تعيين_تعديل_نشط(null);
    تعيين_نص_التعديل("");
  }

  const يملك_أدوات = !!(عند_التعديل || عند_الحذف);

  // صفّر مصفوفة الأزرار قبل كل render — تُملأ بعد الـ commit عبر ref callbacks
  itemButtonsRef.current = [];

  return (
    <منبثقة open={مفتوح} onOpenChange={تعيين_مفتوح}>
      <مشغل_منبثقة asChild>
        <button
          type="button"
          ref={triggerRef}
          disabled={disabled}
          className={cn(
            "flex h-10 w-full items-center justify-between gap-2 rounded-xl border border-input bg-card px-3 py-2 text-sm shadow-soft focus:outline-none focus:ring-2 focus:ring-ring disabled:cursor-not-allowed disabled:opacity-50",
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
              ref={searchRef}
              value={بحث}
              onChange={(e) => تعيين_بحث(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "ArrowDown") {
                  e.preventDefault();
                  itemButtonsRef.current[0]?.focus();
                }
              }}
              placeholder={نص_البحث}
              className="h-7 w-full bg-transparent text-sm outline-none"
            />
          </div>
        )}

        <div
          className="max-h-60 overflow-y-auto overscroll-contain p-1"
          onWheel={(e) => e.stopPropagation()}
          onKeyDown={(e) => {
            const أزرار = itemButtonsRef.current.filter(Boolean);
            const المُركّز = document.activeElement as HTMLButtonElement;
            const الفهرس = أزرار.indexOf(المُركّز);

            if (e.key === "ArrowDown") {
              e.preventDefault();
              const التالي = أزرار[الفهرس + 1];
              if (التالي) التالي.focus();
            } else if (e.key === "ArrowUp") {
              e.preventDefault();
              if (الفهرس <= 0) searchRef.current?.focus();
              else أزرار[الفهرس - 1]?.focus();
            } else if (e.key.length === 1 && !e.ctrlKey && !e.metaKey && !e.altKey) {
              // أي حرف → افتح البحث وابدأ الكتابة
              // preventDefault يمنع الحرف من الانتقال للـ input بعد focus() ويمنع التضاعف
              e.preventDefault();
              تعيين_بحث((prev) => prev + e.key);
              searchRef.current?.focus();
            }
          }}
        >
          {مُصفّاة.length === 0 && !يمكن_الإضافة && (
            <p className="px-3 py-4 text-center text-sm text-muted-foreground">لا نتائج</p>
          )}

          {مُصفّاة.map((x) =>
            تعديل_نشط === x.القيمة ? (
              /* وضع التعديل */
              <div
                key={x.القيمة}
                className="flex items-center gap-1 rounded-lg px-2 py-1"
                onClick={(e) => e.stopPropagation()}
              >
                <input
                  autoFocus
                  value={نص_التعديل}
                  onChange={(e) => تعيين_نص_التعديل(e.target.value)}
                  onKeyDown={(e) => {
                    e.stopPropagation();
                    if (e.key === "Enter") { e.preventDefault(); أكمل_التعديل(x.القيمة); }
                    if (e.key === "Escape") تعيين_تعديل_نشط(null);
                  }}
                  className="h-7 flex-1 rounded border border-ring bg-card px-2 text-sm outline-none"
                />
                <button
                  type="button"
                  onClick={() => أكمل_التعديل(x.القيمة)}
                  className="size-6 flex items-center justify-center rounded text-success hover:bg-success/10"
                >
                  <Check className="size-3" />
                </button>
                <button
                  type="button"
                  onClick={() => تعيين_تعديل_نشط(null)}
                  className="size-6 flex items-center justify-center rounded text-muted-foreground hover:bg-appgray"
                >
                  <X className="size-3" />
                </button>
              </div>
            ) : (
              /* الوضع العادي */
              <div key={x.القيمة} className="group flex items-center gap-0.5 rounded-lg hover:bg-primary-blue/10 focus-within:bg-primary-blue/10">
                <button
                  type="button"
                  ref={(el) => { if (el) itemButtonsRef.current.push(el); }}
                  onClick={() => اختر(x)}
                  className="flex flex-1 items-center justify-between px-3 py-2 text-sm focus:outline-none focus:text-primary-blue"
                >
                  <span>{x.التسمية}</span>
                  {x.القيمة === القيمة && <Check className="size-4 text-primary-blue" />}
                </button>

                {يملك_أدوات && (
                  <div className="flex items-center gap-0.5 px-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    {عند_التعديل && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); ابدأ_التعديل(x); }}
                        className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-foreground hover:bg-border"
                        title="تعديل"
                      >
                        <Pencil className="size-3" />
                      </button>
                    )}
                    {عند_الحذف && (
                      <button
                        type="button"
                        onClick={(e) => { e.stopPropagation(); عند_الحذف(x.القيمة); }}
                        className="size-6 flex items-center justify-center rounded text-muted-foreground hover:text-danger hover:bg-danger/10"
                        title="حذف"
                      >
                        <X className="size-3" />
                      </button>
                    )}
                  </div>
                )}
              </div>
            )
          )}

          {يمكن_الإضافة && (
            <button
              type="button"
              onClick={async () => {
                await عند_الإضافة!(بحث.trim());
                تعيين_مفتوح(false);
                تعيين_بحث("");
                setTimeout(() => عند_الاختيار?.(), 20);
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
