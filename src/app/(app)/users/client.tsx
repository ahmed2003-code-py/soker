"use client";
import * as React from "react";
import { UserPlus, KeyRound, Pencil, Power } from "lucide-react";
import { Role } from "@prisma/client";
import { الزر } from "@/components/ui/button";
import { الحقل } from "@/components/ui/input";
import { العنوان } from "@/components/ui/label";
import {
  الحوار,
  محتوى_الحوار,
  رأس_الحوار,
  عنوان_الحوار,
  تذييل_الحوار,
} from "@/components/ui/dialog";
import { قائمة_اختيار } from "@/components/combobox";
import { جدول_بيانات, type عمود } from "@/components/data-table";
import { شارة_حالة } from "@/components/status-badge";
import { الشارة } from "@/components/ui/badge";
import { سجل_التغييرات } from "@/components/record-history";
import { useإشعار } from "@/components/ui/toast";
import { تسمية_الدور, خيارات_من } from "@/lib/enums";
import {
  إنشاء_مستخدم,
  تعديل_مستخدم,
  تبديل_تفعيل_مستخدم,
  إعادة_تعيين_كلمة,
} from "./actions";

type صف = {
  id: number;
  الاسم: string;
  اسم_المستخدم: string;
  الدور: Role;
  نشط: boolean;
  يجب_تغيير_الكلمة: boolean;
};

export function قائمة_المستخدمين({ البيانات }: { البيانات: صف[] }) {
  const إشعار = useإشعار();
  const [نموذج, تعيين_نموذج] = React.useState<{ وضع: "إضافة" | "تعديل"; صف?: صف } | null>(
    null
  );
  const [كلمة, تعيين_كلمة] = React.useState<{ صف: صف } | null>(null);

  const أعمدة: عمود<صف>[] = [
    { المفتاح: "الاسم", العنوان: "الاسم", قابل_للفرز: true },
    {
      المفتاح: "اسم_المستخدم",
      العنوان: "اسم المستخدم",
      خلية: (ص) => <span className="ltr-nums">{ص.اسم_المستخدم}</span>,
    },
    {
      المفتاح: "الدور",
      العنوان: "الدور",
      خلية: (ص) => <الشارة variant="navy">{تسمية_الدور[ص.الدور]}</الشارة>,
    },
    {
      المفتاح: "نشط",
      العنوان: "الحالة",
      خلية: (ص) => <شارة_حالة الحالة={ص.نشط ? "نشط" : "متوقف"} />,
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <الزر onClick={() => تعيين_نموذج({ وضع: "إضافة" })}>
          <UserPlus className="size-4" /> إضافة مستخدم
        </الزر>
      </div>

      <جدول_بيانات
        الأعمدة={أعمدة}
        البيانات={البيانات}
        مفتاح_الصف={(ص) => ص.id}
        إجراءات_الصف={(ص) => (
          <div className="flex justify-end gap-1">
            <سجل_التغييرات النوع="المستخدم" المعرف={ص.id} تسمية="السجل" />
            <الزر size="sm" variant="ghost" onClick={() => تعيين_نموذج({ وضع: "تعديل", صف: ص })}>
              <Pencil className="size-4" />
            </الزر>
            <الزر size="sm" variant="ghost" onClick={() => تعيين_كلمة({ صف: ص })}>
              <KeyRound className="size-4" />
            </الزر>
            <الزر
              size="sm"
              variant="ghost"
              onClick={async () => {
                const r = await تبديل_تفعيل_مستخدم(ص.id);
                r.نجاح ? إشعار.نجاح(r.رسالة!) : إشعار.خطأ(r.رسالة);
              }}
            >
              <Power className={ص.نشط ? "size-4 text-danger" : "size-4 text-success"} />
            </الزر>
          </div>
        )}
      />

      {نموذج && (
        <حوار_مستخدم
          الوضع={نموذج.وضع}
          الصف={نموذج.صف}
          عند_الإغلاق={() => تعيين_نموذج(null)}
        />
      )}
      {كلمة && (
        <حوار_إعادة_كلمة الصف={كلمة.صف} عند_الإغلاق={() => تعيين_كلمة(null)} />
      )}
    </>
  );
}

function حوار_مستخدم({
  الوضع,
  الصف,
  عند_الإغلاق,
}: {
  الوضع: "إضافة" | "تعديل";
  الصف?: صف;
  عند_الإغلاق: () => void;
}) {
  const إشعار = useإشعار();
  const [الاسم, تعيين_الاسم] = React.useState(الصف?.الاسم ?? "");
  const [اسم_المستخدم, تعيين_اسم] = React.useState(الصف?.اسم_المستخدم ?? "");
  const [كلمة_المرور, تعيين_كلمة] = React.useState("");
  const [الدور, تعيين_الدور] = React.useState<Role>(الصف?.الدور ?? "ACCOUNTANT");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);

  async function حفظ() {
    تعيين_جارٍ(true);
    const res =
      الوضع === "إضافة"
        ? await إنشاء_مستخدم({ الاسم, اسم_المستخدم, كلمة_المرور, الدور })
        : await تعديل_مستخدم(الصف!.id, { الاسم, الدور });
    تعيين_جارٍ(false);
    if (!res.نجاح) return إشعار.خطأ(res.رسالة);
    إشعار.نجاح(res.رسالة!);
    عند_الإغلاق();
  }

  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإغلاق()}>
      <محتوى_الحوار>
        <رأس_الحوار>
          <عنوان_الحوار>{الوضع === "إضافة" ? "إضافة مستخدم" : "تعديل مستخدم"}</عنوان_الحوار>
        </رأس_الحوار>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <العنوان مطلوب>الاسم</العنوان>
            <الحقل autoFocus value={الاسم} onChange={(e) => تعيين_الاسم(e.target.value)} />
          </div>
          {الوضع === "إضافة" && (
            <>
              <div className="space-y-1.5">
                <العنوان مطلوب>اسم المستخدم</العنوان>
                <الحقل
                  className="ltr-nums"
                  value={اسم_المستخدم}
                  onChange={(e) => تعيين_اسم(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <العنوان مطلوب>كلمة المرور المؤقتة</العنوان>
                <الحقل
                  type="password"
                  value={كلمة_المرور}
                  onChange={(e) => تعيين_كلمة(e.target.value)}
                />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <العنوان مطلوب>الدور</العنوان>
            <قائمة_اختيار
              الخيارات={خيارات_من(تسمية_الدور)}
              القيمة={الدور}
              عند_التغيير={(v) => تعيين_الدور(v as Role)}
              قابل_للبحث={false}
            />
          </div>
        </div>
        <تذييل_الحوار>
          <الزر variant="success" onClick={حفظ} disabled={جارٍ}>
            {جارٍ ? "جارٍ الحفظ…" : "حفظ"}
          </الزر>
          <الزر variant="outline" onClick={عند_الإغلاق}>
            إلغاء
          </الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}

function حوار_إعادة_كلمة({
  الصف,
  عند_الإغلاق,
}: {
  الصف: صف;
  عند_الإغلاق: () => void;
}) {
  const إشعار = useإشعار();
  const [كلمة, تعيين_كلمة] = React.useState("");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);
  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإغلاق()}>
      <محتوى_الحوار className="max-w-md">
        <رأس_الحوار>
          <عنوان_الحوار>إعادة تعيين كلمة مرور {الصف.الاسم}</عنوان_الحوار>
        </رأس_الحوار>
        <div className="space-y-1.5">
          <العنوان مطلوب>كلمة المرور الجديدة</العنوان>
          <الحقل
            type="password"
            autoFocus
            value={كلمة}
            onChange={(e) => تعيين_كلمة(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            سيُطلب من المستخدم تغييرها عند أول دخول.
          </p>
        </div>
        <تذييل_الحوار>
          <الزر
            variant="success"
            disabled={جارٍ}
            onClick={async () => {
              تعيين_جارٍ(true);
              const r = await إعادة_تعيين_كلمة(الصف.id, كلمة);
              تعيين_جارٍ(false);
              if (!r.نجاح) return إشعار.خطأ(r.رسالة);
              إشعار.نجاح(r.رسالة!);
              عند_الإغلاق();
            }}
          >
            حفظ
          </الزر>
          <الزر variant="outline" onClick={عند_الإغلاق}>
            إلغاء
          </الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}
