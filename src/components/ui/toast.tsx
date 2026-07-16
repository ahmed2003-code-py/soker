"use client";
import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { DirectionProvider } from "@radix-ui/react-direction";
import { CheckCircle2, AlertCircle, X, Info, Trash2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const DURATION = 4000;
const UNDO_DURATION = 5000;

type نوع_الإشعار = "نجاح" | "خطأ" | "معلومة";
type إشعار = { id: number; العنوان: string; الوصف?: string; النوع: نوع_الإشعار };
type إشعار_تراجع = { id: number; عند_التراجع: () => void };

type سياق = {
  أظهر: (إشعار: Omit<إشعار, "id">) => void;
  نجاح: (العنوان: string, الوصف?: string) => void;
  خطأ: (العنوان: string, الوصف?: string) => void;
  تراجع: (عند_التراجع: () => void) => void;
};

const سياق_الإشعارات = React.createContext<سياق | null>(null);

export function useإشعار() {
  const ctx = React.useContext(سياق_الإشعارات);
  if (!ctx) throw new Error("useإشعار خارج مزود_الإشعارات");
  return ctx;
}

/** توست التراجع عن الحذف — بارز ومميز */
function توست_تراجع({
  عند_التراجع,
  عند_الإغلاق,
}: {
  عند_التراجع: () => void;
  عند_الإغلاق: () => void;
}) {
  const [ثوان, تعيين_ثوان] = React.useState(5);
  const [نسبة, تعيين_نسبة] = React.useState(100);

  React.useEffect(() => {
    // عداد الثواني
    const interval = setInterval(() => {
      تعيين_ثوان((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    // شريط التقدم بتحديث كل 50ms لحركة سلسة
    const start = Date.now();
    const bar = setInterval(() => {
      const elapsed = Date.now() - start;
      const remaining = Math.max(0, 1 - elapsed / UNDO_DURATION);
      تعيين_نسبة(remaining * 100);
    }, 50);
    return () => { clearInterval(interval); clearInterval(bar); };
  }, []);

  return (
    <ToastPrimitive.Root
      duration={UNDO_DURATION + 500}
      onOpenChange={(o) => { if (!o) عند_الإغلاق(); }}
      className="relative overflow-hidden rounded-2xl border-2 border-orange-300 bg-white shadow-2xl dark:border-orange-700 dark:bg-zinc-900 data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out"
    >
      {/* شريط العداد في الأسفل */}
      <div className="absolute bottom-0 right-0 h-1.5 bg-orange-200 dark:bg-orange-900/60 w-full" />
      <div
        className="absolute bottom-0 right-0 h-1.5 bg-orange-500 transition-all ease-linear"
        style={{ width: `${نسبة}%`, transitionDuration: "50ms" }}
      />

      <div className="flex items-center gap-3 p-4 pb-5">
        {/* أيقونة */}
        <div className="flex size-10 shrink-0 items-center justify-center rounded-full bg-orange-100 dark:bg-orange-900/60">
          <Trash2 className="size-5 text-orange-600 dark:text-orange-400" />
        </div>

        {/* النص */}
        <div className="flex-1 min-w-0">
          <ToastPrimitive.Title className="text-sm font-bold text-orange-900 dark:text-orange-100">
            تم الحذف
          </ToastPrimitive.Title>
          <ToastPrimitive.Description className="mt-0.5 text-xs text-orange-700/80 dark:text-orange-300/70">
            سيُحذف نهائياً خلال {ثوان} {ثوان === 1 ? "ثانية" : "ثوان"}
          </ToastPrimitive.Description>
        </div>

        {/* زر التراجع */}
        <ToastPrimitive.Action
          altText="تراجع عن الحذف"
          onClick={() => { عند_التراجع(); عند_الإغلاق(); }}
          className="flex items-center gap-2 rounded-xl bg-success px-4 py-2.5 text-sm font-bold text-white shadow-md hover:bg-success/90 active:scale-95 transition-all shrink-0"
        >
          <RotateCcw className="size-4" />
          تراجع
        </ToastPrimitive.Action>

        <ToastPrimitive.Close onClick={عند_الإغلاق} className="opacity-40 hover:opacity-80 shrink-0 transition-opacity">
          <X className="size-4 text-orange-700 dark:text-orange-300" />
        </ToastPrimitive.Close>
      </div>
    </ToastPrimitive.Root>
  );
}

export function مزود_الإشعارات({ children }: { children: React.ReactNode }) {
  const [قائمة, تعيين] = React.useState<إشعار[]>([]);
  const [تراجعات, تعيين_تراجعات] = React.useState<إشعار_تراجع[]>([]);
  const عداد = React.useRef(0);

  const أزل = React.useCallback((id: number) => {
    تعيين((س) => س.filter((x) => x.id !== id));
  }, []);

  const أزل_تراجع = React.useCallback((id: number) => {
    تعيين_تراجعات((س) => س.filter((x) => x.id !== id));
  }, []);

  const أظهر = React.useCallback(
    (e: Omit<إشعار, "id">) => {
      const id = ++عداد.current;
      تعيين((س) => [...س, { ...e, id }]);
      setTimeout(() => أزل(id), DURATION + 300);
    },
    [أزل]
  );

  const تراجع_fn = React.useCallback(
    (عند_التراجع: () => void) => {
      const id = ++عداد.current;
      تعيين_تراجعات((س) => [...س, { id, عند_التراجع }]);
      setTimeout(() => أزل_تراجع(id), UNDO_DURATION + 600);
    },
    [أزل_تراجع]
  );

  const القيمة = React.useMemo<سياق>(
    () => ({
      أظهر,
      نجاح: (العنوان, الوصف) => أظهر({ العنوان, الوصف, النوع: "نجاح" }),
      خطأ: (العنوان, الوصف) => أظهر({ العنوان, الوصف, النوع: "خطأ" }),
      تراجع: تراجع_fn,
    }),
    [أظهر, تراجع_fn]
  );

  return (
    <سياق_الإشعارات.Provider value={القيمة}>
      <DirectionProvider dir="rtl">
        <ToastPrimitive.Provider swipeDirection="right" duration={DURATION}>
          {children}

          {/* إشعارات عادية */}
          {قائمة.map((e) => (
            <ToastPrimitive.Root
              key={e.id}
              duration={DURATION}
              onOpenChange={(o) => { if (!o) أزل(e.id); }}
              className={cn(
                "card-soft flex items-start gap-3 p-4",
                "data-[state=open]:animate-fade-in data-[state=closed]:animate-fade-out",
                e.النوع === "نجاح" && "border-success/30",
                e.النوع === "خطأ" && "border-danger/30"
              )}
            >
              {e.النوع === "نجاح" && <CheckCircle2 className="size-5 shrink-0 text-success" />}
              {e.النوع === "خطأ" && <AlertCircle className="size-5 shrink-0 text-danger" />}
              {e.النوع === "معلومة" && <Info className="size-5 shrink-0 text-primary-blue" />}
              <div className="flex-1">
                <ToastPrimitive.Title className="text-sm font-semibold">
                  {e.العنوان}
                </ToastPrimitive.Title>
                {e.الوصف && (
                  <ToastPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
                    {e.الوصف}
                  </ToastPrimitive.Description>
                )}
              </div>
              <ToastPrimitive.Close className="opacity-60 hover:opacity-100">
                <X className="size-4" />
              </ToastPrimitive.Close>
            </ToastPrimitive.Root>
          ))}

          {/* إشعارات التراجع — تظهر فوق الإشعارات العادية */}
          {تراجعات.map((e) => (
            <توست_تراجع
              key={e.id}
              عند_التراجع={e.عند_التراجع}
              عند_الإغلاق={() => أزل_تراجع(e.id)}
            />
          ))}

          {/* تحديد الموضع — يمين أسفل مناسب للـ RTL */}
          <ToastPrimitive.Viewport className="fixed bottom-4 left-4 z-[200] flex w-[22rem] max-w-[calc(100vw-2rem)] flex-col gap-3 outline-none" />
        </ToastPrimitive.Provider>
      </DirectionProvider>
    </سياق_الإشعارات.Provider>
  );
}
