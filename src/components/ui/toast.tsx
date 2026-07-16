"use client";
import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { DirectionProvider } from "@radix-ui/react-direction";
import { CheckCircle2, AlertCircle, X, Info, Trash2, RotateCcw } from "lucide-react";
import { cn } from "@/lib/utils";

const DURATION = 4000; // ms — toast auto-dismiss
const UNDO_DURATION = 5000; // ms — undo window

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

/** toast مع عداد تنازلي وزر تراجع */
function توست_تراجع({
  عند_التراجع,
  عند_الإغلاق,
}: {
  عند_التراجع: () => void;
  عند_الإغلاق: () => void;
}) {
  const [ثوان, تعيين_ثوان] = React.useState(5);

  React.useEffect(() => {
    const interval = setInterval(() => {
      تعيين_ثوان((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => clearInterval(interval);
  }, []);

  return (
    <ToastPrimitive.Root
      duration={UNDO_DURATION + 500}
      onOpenChange={(o) => { if (!o) عند_الإغلاق(); }}
      className="card-soft flex items-center gap-3 p-4 border-danger/20"
    >
      <Trash2 className="size-5 shrink-0 text-danger/70" />
      <div className="flex-1 min-w-0">
        <ToastPrimitive.Title className="text-sm font-semibold">
          تم الحذف
        </ToastPrimitive.Title>
        <ToastPrimitive.Description className="mt-0.5 text-xs text-muted-foreground">
          يمكنك التراجع خلال {ثوان} {ثوان === 1 ? "ثانية" : "ثوان"}
        </ToastPrimitive.Description>
      </div>
      <ToastPrimitive.Action
        altText="تراجع عن الحذف"
        onClick={() => { عند_التراجع(); عند_الإغلاق(); }}
        className="flex items-center gap-1.5 rounded-lg border border-border bg-card px-3 py-1.5 text-xs font-semibold hover:bg-appgray transition-colors shrink-0"
      >
        <RotateCcw className="size-3" />
        تراجع
      </ToastPrimitive.Action>
      <ToastPrimitive.Close onClick={عند_الإغلاق} className="opacity-50 hover:opacity-100 shrink-0">
        <X className="size-4" />
      </ToastPrimitive.Close>
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
          {قائمة.map((e) => (
            <ToastPrimitive.Root
              key={e.id}
              duration={DURATION}
              onOpenChange={(o) => {
                if (!o) أزل(e.id);
              }}
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
          {تراجعات.map((e) => (
            <توست_تراجع
              key={e.id}
              عند_التراجع={e.عند_التراجع}
              عند_الإغلاق={() => أزل_تراجع(e.id)}
            />
          ))}
          <ToastPrimitive.Viewport className="fixed bottom-4 left-4 z-[100] flex w-80 max-w-[100vw] flex-col gap-2 outline-none" />
        </ToastPrimitive.Provider>
      </DirectionProvider>
    </سياق_الإشعارات.Provider>
  );
}
