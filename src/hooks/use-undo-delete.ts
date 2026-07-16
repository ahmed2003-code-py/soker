"use client";
import { useCallback, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useإشعار } from "@/components/ui/toast";

type نتيجة_حذف = { نجاح: boolean; رسالة?: string };

/**
 * يُخفي العنصر فوراً ويُشغّل مؤقت 5 ثوان.
 * لو الـ user ضغط "تراجع" → العنصر يرجع.
 * لو انتهى الوقت → يُستدعى الحذف الفعلي.
 */
export function استخدم_تراجع_الحذف() {
  const [معلقة, تعيين_معلقة] = useState<Set<number>>(new Set());
  const مؤقتات = useRef<Map<number, ReturnType<typeof setTimeout>>>(new Map());
  const { تراجع, خطأ } = useإشعار();
  const router = useRouter();

  const احذف = useCallback(
    (id: number, دالة_الحذف: () => Promise<نتيجة_حذف>) => {
      // إخفاء فوري من الواجهة
      تعيين_معلقة((s) => new Set([...s, id]));

      const مؤقت = setTimeout(async () => {
        مؤقتات.current.delete(id);
        تعيين_معلقة((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
        const r = await دالة_الحذف();
        if (!r.نجاح) خطأ(r.رسالة ?? "فشل الحذف");
        router.refresh();
      }, 5000);

      مؤقتات.current.set(id, مؤقت);

      // إظهار toast مع زر التراجع
      تراجع(() => {
        const t = مؤقتات.current.get(id);
        if (t) clearTimeout(t);
        مؤقتات.current.delete(id);
        تعيين_معلقة((s) => {
          const n = new Set(s);
          n.delete(id);
          return n;
        });
      });
    },
    [تراجع, خطأ, router]
  );

  return { احذف, معلقة };
}
