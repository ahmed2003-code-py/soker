"use client";
import * as React from "react";
import * as ToastPrimitive from "@radix-ui/react-toast";
import { DirectionProvider } from "@radix-ui/react-direction";
import { CheckCircle2, AlertCircle, X, Info } from "lucide-react";
import { cn } from "@/lib/utils";

const DURATION = 4000; // ms — toast auto-dismiss

type نوع_الإشعار = "نجاح" | "خطأ" | "معلومة";
type إشعار = { id: number; العنوان: string; الوصف?: string; النوع: نوع_الإشعار };

type سياق = {
  أظهر: (إشعار: Omit<إشعار, "id">) => void;
  نجاح: (العنوان: string, الوصف?: string) => void;
  خطأ: (العنوان: string, الوصف?: string) => void;
};

const سياق_الإشعارات = React.createContext<سياق | null>(null);

export function useإشعار() {
  const ctx = React.useContext(سياق_الإشعارات);
  if (!ctx) throw new Error("useإشعار خارج مزود_الإشعارات");
  return ctx;
}

export function مزود_الإشعارات({ children }: { children: React.ReactNode }) {
  const [قائمة, تعيين] = React.useState<إشعار[]>([]);
  const عداد = React.useRef(0);

  const أزل = React.useCallback((id: number) => {
    تعيين((س) => س.filter((x) => x.id !== id));
  }, []);

  const أظهر = React.useCallback(
    (e: Omit<إشعار, "id">) => {
      const id = ++عداد.current;
      تعيين((س) => [...س, { ...e, id }]);
      // Guaranteed removal after DURATION regardless of Radix hover-pause behaviour
      setTimeout(() => أزل(id), DURATION + 300);
    },
    [أزل]
  );

  const القيمة = React.useMemo<سياق>(
    () => ({
      أظهر,
      نجاح: (العنوان, الوصف) => أظهر({ العنوان, الوصف, النوع: "نجاح" }),
      خطأ: (العنوان, الوصف) => أظهر({ العنوان, الوصف, النوع: "خطأ" }),
    }),
    [أظهر]
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
          <ToastPrimitive.Viewport className="fixed bottom-4 left-4 z-[100] flex w-80 max-w-[100vw] flex-col gap-2 outline-none" />
        </ToastPrimitive.Provider>
      </DirectionProvider>
    </سياق_الإشعارات.Provider>
  );
}
