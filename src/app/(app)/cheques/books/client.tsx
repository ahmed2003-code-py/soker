"use client";
import * as React from "react";
import { useRouter } from "next/navigation";
import { Plus, Pencil, Trash2, Archive, ArchiveRestore, BookOpen, Wallet } from "lucide-react";
import { ChequeDirection } from "@prisma/client";
import { الزر } from "@/components/ui/button";
import { الحقل, منطقة_نص } from "@/components/ui/input";
import { العنوان } from "@/components/ui/label";
import { قائمة_اختيار } from "@/components/combobox";
import { الشارة } from "@/components/ui/badge";
import { نص_مبلغ } from "@/components/money-text";
import { حوار_تأكيد } from "@/components/confirm-dialog";
import { useإشعار } from "@/components/ui/toast";
import {
  الحوار, محتوى_الحوار, رأس_الحوار, عنوان_الحوار, تذييل_الحوار,
} from "@/components/ui/dialog";
import type { دفتر_معروض } from "@/lib/cheque-books";
import { أنشئ_دفتر, تعديل_دفتر, بدّل_تفعيل_دفتر, احذف_دفتر } from "./actions";

export function شاشة_الدفاتر({ الدفاتر }: { الدفاتر: دفتر_معروض[] }) {
  const router = useRouter();
  const إشعار = useإشعار();
  const [نموذج, تعيين_نموذج] = React.useState<{ دفتر?: دفتر_معروض } | null>(null);
  const [حذف, تعيين_حذف] = React.useState<دفتر_معروض | null>(null);

  const دفاتر_صادرة = الدفاتر.filter((d) => d.الاتجاه === "OUTGOING");
  const حافظات_واردة = الدفاتر.filter((d) => d.الاتجاه === "INCOMING");

  async function بدّل(id: number) {
    const r = await بدّل_تفعيل_دفتر(id);
    r.نجاح ? إشعار.نجاح(r.رسالة!) : إشعار.خطأ(r.رسالة);
    if (r.نجاح) router.refresh();
  }

  async function نفّذ_الحذف() {
    if (!حذف) return;
    const r = await احذف_دفتر(حذف.id);
    r.نجاح ? إشعار.نجاح(r.رسالة!) : إشعار.خطأ(r.رسالة);
    تعيين_حذف(null);
    if (r.نجاح) router.refresh();
  }

  function بطاقة(د: دفتر_معروض) {
    return (
      <div key={د.id} className={`rounded-xl border p-4 ${د.نشط ? "border-border bg-card" : "border-dashed border-border bg-appgray/40 opacity-70"}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex items-center gap-2">
              <span className="font-semibold">{د.الاسم}</span>
              {!د.نشط && <الشارة variant="outline">مؤرشف</الشارة>}
            </div>
            <div className="mt-0.5 text-[12px] text-muted-foreground">
              {د.اسم_البنك || "— بدون بنك —"}
              {د.من_رقم != null && د.إلى_رقم != null && (
                <span className="ltr-nums"> · أرقام {د.من_رقم}–{د.إلى_رقم}</span>
              )}
            </div>
          </div>
          <div className="flex items-center gap-1">
            <الزر size="sm" variant="ghost" onClick={() => تعيين_نموذج({ دفتر: د })} title="تعديل"><Pencil className="size-4" /></الزر>
            <الزر size="sm" variant="ghost" onClick={() => بدّل(د.id)} title={د.نشط ? "أرشفة" : "تفعيل"}>
              {د.نشط ? <Archive className="size-4" /> : <ArchiveRestore className="size-4 text-success" />}
            </الزر>
            <الزر size="sm" variant="ghost" onClick={() => تعيين_حذف(د)} title="حذف"><Trash2 className="size-4 text-danger" /></الزر>
          </div>
        </div>
        <div className="mt-3 grid grid-cols-3 gap-2 text-center text-sm">
          <div className="rounded-lg bg-appgray p-2"><div className="text-[11px] text-muted-foreground">عدد الشيكات</div><div className="font-semibold ltr-nums">{د.عدد_الشيكات}</div></div>
          <div className="rounded-lg bg-appgray p-2"><div className="text-[11px] text-muted-foreground">إجمالي القيمة</div><div className="font-semibold"><نص_مبلغ القيمة={د.إجمالي_القيمة} /></div></div>
          <div className="rounded-lg bg-appgray p-2"><div className="text-[11px] text-muted-foreground">أوراق متبقّية</div><div className="font-semibold ltr-nums">{د.متبقّي_الأوراق != null ? `${د.متبقّي_الأوراق} / ${د.سعة_الأوراق}` : "—"}</div></div>
        </div>
        {د.ملاحظات && <p className="mt-2 text-[12px] text-muted-foreground">{د.ملاحظات}</p>}
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="flex justify-end">
        <الزر onClick={() => تعيين_نموذج({})}><Plus className="size-4" /> دفتر / حافظة جديدة</الزر>
      </div>

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground"><BookOpen className="size-4" /> دفاتر الشيكات الصادرة</h2>
        {دفاتر_صادرة.length === 0
          ? <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">لا توجد دفاتر صادرة بعد.</p>
          : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{دفاتر_صادرة.map(بطاقة)}</div>}
      </section>

      <section>
        <h2 className="mb-2 flex items-center gap-2 text-sm font-semibold text-muted-foreground"><Wallet className="size-4" /> حافظات الشيكات الواردة</h2>
        {حافظات_واردة.length === 0
          ? <p className="rounded-xl border border-dashed border-border p-6 text-center text-sm text-muted-foreground">لا توجد حافظات واردة بعد.</p>
          : <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{حافظات_واردة.map(بطاقة)}</div>}
      </section>

      {نموذج && (
        <حوار_دفتر
          دفتر={نموذج.دفتر}
          عند_الإغلاق={() => { تعيين_نموذج(null); router.refresh(); }}
        />
      )}
      {حذف && (
        <حوار_تأكيد
          مفتوح={!!حذف}
          عند_التغيير={(o) => !o && تعيين_حذف(null)}
          العنوان="حذف الدفتر/الحافظة"
          الوصف={`سيتم حذف «${حذف.الاسم}» نهائياً. متأكد؟`}
          عند_التأكيد={نفّذ_الحذف}
        />
      )}
    </div>
  );
}

function حوار_دفتر({ دفتر, عند_الإغلاق }: { دفتر?: دفتر_معروض; عند_الإغلاق: () => void }) {
  const إشعار = useإشعار();
  const [ق, تعيين] = React.useState({
    الاسم: دفتر?.الاسم ?? "",
    الاتجاه: (دفتر?.الاتجاه ?? "OUTGOING") as ChequeDirection,
    اسم_البنك: دفتر?.اسم_البنك ?? "",
    من_رقم: دفتر?.من_رقم != null ? String(دفتر.من_رقم) : "",
    إلى_رقم: دفتر?.إلى_رقم != null ? String(دفتر.إلى_رقم) : "",
    ملاحظات: دفتر?.ملاحظات ?? "",
  });
  const [جارٍ, تعيين_جارٍ] = React.useState(false);
  const صادر = ق.الاتجاه === "OUTGOING";

  async function احفظ() {
    if (!ق.الاسم.trim()) return إشعار.خطأ("اسم الدفتر/الحافظة مطلوب");
    تعيين_جارٍ(true);
    const مدخلات = {
      الاسم: ق.الاسم,
      الاتجاه: ق.الاتجاه,
      اسم_البنك: ق.اسم_البنك || null,
      من_رقم: ق.من_رقم ? Number(ق.من_رقم) : null,
      إلى_رقم: ق.إلى_رقم ? Number(ق.إلى_رقم) : null,
      ملاحظات: ق.ملاحظات || null,
    };
    const r = دفتر ? await تعديل_دفتر(دفتر.id, مدخلات) : await أنشئ_دفتر(مدخلات);
    تعيين_جارٍ(false);
    if (!r.نجاح) return إشعار.خطأ(r.رسالة);
    إشعار.نجاح(r.رسالة!);
    عند_الإغلاق();
  }

  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإغلاق()}>
      <محتوى_الحوار className="max-w-md">
        <رأس_الحوار>
          <عنوان_الحوار>{دفتر ? "تعديل دفتر/حافظة" : "دفتر / حافظة جديدة"}</عنوان_الحوار>
        </رأس_الحوار>
        <div className="space-y-3">
          <div className="space-y-1">
            <العنوان>النوع</العنوان>
            <قائمة_اختيار
              قابل_للبحث={false}
              الخيارات={[
                { القيمة: "OUTGOING", التسمية: "دفتر شيكات صادرة (بنك)" },
                { القيمة: "INCOMING", التسمية: "حافظة شيكات واردة" },
              ]}
              القيمة={ق.الاتجاه}
              عند_التغيير={(v) => تعيين((س) => ({ ...س, الاتجاه: v as ChequeDirection }))}
            />
          </div>
          <div className="space-y-1">
            <العنوان>الاسم <span className="text-danger">*</span></العنوان>
            <الحقل autoFocus value={ق.الاسم} onChange={(e) => تعيين((س) => ({ ...س, الاسم: e.target.value }))} placeholder={صادر ? "مثال: دفتر البنك الأهلي" : "مثال: حافظة شيكات العملاء"} />
          </div>
          <div className="space-y-1">
            <العنوان>البنك</العنوان>
            <الحقل value={ق.اسم_البنك} onChange={(e) => تعيين((س) => ({ ...س, اسم_البنك: e.target.value }))} placeholder="اختياري" />
          </div>
          {صادر && (
            <div className="flex gap-2">
              <div className="flex-1 space-y-1"><العنوان>من رقم</العنوان><الحقل selectOnFocus className="ltr-nums" value={ق.من_رقم} onChange={(e) => تعيين((س) => ({ ...س, من_رقم: e.target.value.replace(/[^\d]/g, "") }))} placeholder="0" /></div>
              <div className="flex-1 space-y-1"><العنوان>إلى رقم</العنوان><الحقل selectOnFocus className="ltr-nums" value={ق.إلى_رقم} onChange={(e) => تعيين((س) => ({ ...س, إلى_رقم: e.target.value.replace(/[^\d]/g, "") }))} placeholder="0" /></div>
            </div>
          )}
          <div className="space-y-1">
            <العنوان>ملاحظات</العنوان>
            <منطقة_نص value={ق.ملاحظات} onChange={(e) => تعيين((س) => ({ ...س, ملاحظات: e.target.value }))} rows={2} />
          </div>
        </div>
        <تذييل_الحوار>
          <الزر variant="outline" onClick={عند_الإغلاق}>إلغاء</الزر>
          <الزر onClick={احفظ} disabled={جارٍ}>حفظ</الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}
