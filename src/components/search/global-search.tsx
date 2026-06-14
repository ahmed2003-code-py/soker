"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Search, Loader2 } from "lucide-react";
import { الحقل } from "@/components/ui/input";
import { استخدام_اللغة } from "@/components/providers/i18n-provider";

type عنصر = { id: number; عنوان: string; وصف: string; رابط: string };
type مجموعة = { النوع: string; العناصر: عنصر[] };

/** البحث الموحّد في الشريط العلوي: debounce + نتائج مجمّعة + تنقّل بلوحة المفاتيح. */
export function البحث_الموحد() {
  const router = useRouter();
  const { t } = استخدام_اللغة();
  const [q, setQ] = React.useState("");
  const [مجموعات, setG] = React.useState<مجموعة[]>([]);
  const [مفتوح, setOpen] = React.useState(false);
  const [جارٍ, setLoad] = React.useState(false);
  const [مؤشر, setIdx] = React.useState(-1);
  const حاوية = React.useRef<HTMLDivElement>(null);

  const مسطّحة = React.useMemo(() => مجموعات.flatMap((g) => g.العناصر), [مجموعات]);

  React.useEffect(() => {
    if (q.trim().length < 1) {
      setG([]);
      setOpen(false);
      return;
    }
    setLoad(true);
    const t = setTimeout(async () => {
      try {
        const res = await fetch(`/api/search?q=${encodeURIComponent(q)}`);
        const data = await res.json();
        setG(data.المجموعات ?? []);
        setOpen(true);
        setIdx(-1);
      } catch {
        setG([]);
      } finally {
        setLoad(false);
      }
    }, 300);
    return () => clearTimeout(t);
  }, [q]);

  React.useEffect(() => {
    function خارج(e: MouseEvent) {
      if (حاوية.current && !حاوية.current.contains(e.target as Node)) setOpen(false);
    }
    document.addEventListener("mousedown", خارج);
    return () => document.removeEventListener("mousedown", خارج);
  }, []);

  function انتقل(رابط: string) {
    setOpen(false);
    setQ("");
    router.push(رابط);
  }

  function مفاتيح(e: React.KeyboardEvent) {
    if (!مفتوح || مسطّحة.length === 0) return;
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setIdx((i) => Math.min(i + 1, مسطّحة.length - 1));
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setIdx((i) => Math.max(i - 1, 0));
    } else if (e.key === "Enter" && مؤشر >= 0) {
      e.preventDefault();
      انتقل(مسطّحة[مؤشر].رابط);
    } else if (e.key === "Escape") {
      setOpen(false);
    }
  }

  let عداد = -1;
  return (
    <div ref={حاوية} className="relative max-w-md">
      <Search className="absolute end-3 top-1/2 size-4 -translate-y-1/2 opacity-50" />
      {جارٍ && <Loader2 className="absolute start-3 top-1/2 size-4 -translate-y-1/2 animate-spin opacity-50" />}
      <الحقل
        value={q}
        onChange={(e) => setQ(e.target.value)}
        onKeyDown={مفاتيح}
        onFocus={() => مجموعات.length && setOpen(true)}
        placeholder={t("search.placeholder")}
        className="pe-9"
      />
      {مفتوح && (
        <div className="absolute inset-x-0 top-12 z-50 max-h-96 overflow-y-auto rounded-xl border border-border bg-card shadow-card">
          {مجموعات.length === 0 ? (
            <p className="p-4 text-center text-sm text-muted-foreground">{t("search.no_results")}</p>
          ) : (
            مجموعات.map((g) => (
              <div key={g.النوع} className="p-1">
                <p className="px-3 py-1.5 text-xs font-semibold text-muted-foreground">{g.النوع}</p>
                {g.العناصر.map((it) => {
                  عداد++;
                  const نشط = عداد === مؤشر;
                  return (
                    <button
                      key={`${g.النوع}-${it.id}`}
                      onClick={() => انتقل(it.رابط)}
                      className={`flex w-full flex-col items-start rounded-lg px-3 py-2 text-start text-sm ${نشط ? "bg-appgray" : "hover:bg-appgray"}`}
                    >
                      <span className="font-medium">{it.عنوان}</span>
                      {it.وصف && <span className="text-xs text-muted-foreground">{it.وصف}</span>}
                    </button>
                  );
                })}
              </div>
            ))
          )}
        </div>
      )}
    </div>
  );
}
