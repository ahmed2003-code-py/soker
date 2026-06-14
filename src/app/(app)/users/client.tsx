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
import { استخدام_اللغة } from "@/components/providers/i18n-provider";
import {
  إنشاء_مستخدم,
  تعديل_مستخدم,
  تبديل_تفعيل_مستخدم,
  إعادة_تعيين_كلمة,
} from "./actions";

const الأدوار = ["ADMIN", "ACCOUNTANT", "READONLY"] as const;

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
  const { t } = استخدام_اللغة();
  const [نموذج, تعيين_نموذج] = React.useState<{ وضع: "إضافة" | "تعديل"; صف?: صف } | null>(
    null
  );
  const [كلمة, تعيين_كلمة] = React.useState<{ صف: صف } | null>(null);

  const أعمدة: عمود<صف>[] = [
    { المفتاح: "الاسم", العنوان: t("party.col.name"), قابل_للفرز: true },
    {
      المفتاح: "اسم_المستخدم",
      العنوان: t("login.username"),
      خلية: (ص) => <span className="ltr-nums">{ص.اسم_المستخدم}</span>,
    },
    {
      المفتاح: "الدور",
      العنوان: t("users.col.role"),
      خلية: (ص) => <الشارة variant="navy">{t(`role.${ص.الدور}` as const)}</الشارة>,
    },
    {
      المفتاح: "نشط",
      العنوان: t("users.col.status"),
      خلية: (ص) => (
        <شارة_حالة
          الحالة={ص.نشط ? t("users.status.active") : t("users.status.inactive")}
          متغيّر={ص.نشط ? "success" : "default"}
        />
      ),
    },
  ];

  return (
    <>
      <div className="mb-4 flex justify-end">
        <الزر onClick={() => تعيين_نموذج({ وضع: "إضافة" })}>
          <UserPlus className="size-4" /> {t("users.add")}
        </الزر>
      </div>

      <جدول_بيانات
        الأعمدة={أعمدة}
        البيانات={البيانات}
        مفتاح_الصف={(ص) => ص.id}
        إجراءات_الصف={(ص) => (
          <div className="flex justify-end gap-1">
            <سجل_التغييرات النوع="المستخدم" المعرف={ص.id} />
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
  const { t } = استخدام_اللغة();
  const خيارات_الأدوار = الأدوار.map((r) => ({ القيمة: r, التسمية: t(`role.${r}` as const) }));
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
          <عنوان_الحوار>{الوضع === "إضافة" ? t("users.add") : t("users.dlg.edit")}</عنوان_الحوار>
        </رأس_الحوار>
        <div className="space-y-3">
          <div className="space-y-1.5">
            <العنوان مطلوب>{t("party.col.name")}</العنوان>
            <الحقل autoFocus value={الاسم} onChange={(e) => تعيين_الاسم(e.target.value)} />
          </div>
          {الوضع === "إضافة" && (
            <>
              <div className="space-y-1.5">
                <العنوان مطلوب>{t("login.username")}</العنوان>
                <الحقل
                  className="ltr-nums"
                  value={اسم_المستخدم}
                  onChange={(e) => تعيين_اسم(e.target.value)}
                />
              </div>
              <div className="space-y-1.5">
                <العنوان مطلوب>{t("users.f.temp_password")}</العنوان>
                <الحقل
                  type="password"
                  value={كلمة_المرور}
                  onChange={(e) => تعيين_كلمة(e.target.value)}
                />
              </div>
            </>
          )}
          <div className="space-y-1.5">
            <العنوان مطلوب>{t("users.col.role")}</العنوان>
            <قائمة_اختيار
              الخيارات={خيارات_الأدوار}
              القيمة={الدور}
              عند_التغيير={(v) => تعيين_الدور(v as Role)}
              قابل_للبحث={false}
            />
          </div>
        </div>
        <تذييل_الحوار>
          <الزر variant="success" onClick={حفظ} disabled={جارٍ}>
            {جارٍ ? t("common.saving") : t("common.save")}
          </الزر>
          <الزر variant="outline" onClick={عند_الإغلاق}>
            {t("common.cancel")}
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
  const { t } = استخدام_اللغة();
  const [كلمة, تعيين_كلمة] = React.useState("");
  const [جارٍ, تعيين_جارٍ] = React.useState(false);
  return (
    <الحوار open onOpenChange={(o) => !o && عند_الإغلاق()}>
      <محتوى_الحوار className="max-w-md">
        <رأس_الحوار>
          <عنوان_الحوار>{t("users.reset_title", { name: الصف.الاسم })}</عنوان_الحوار>
        </رأس_الحوار>
        <div className="space-y-1.5">
          <العنوان مطلوب>{t("cpw.new")}</العنوان>
          <الحقل
            type="password"
            autoFocus
            value={كلمة}
            onChange={(e) => تعيين_كلمة(e.target.value)}
          />
          <p className="text-xs text-muted-foreground">
            {t("users.reset_hint")}
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
            {t("common.save")}
          </الزر>
          <الزر variant="outline" onClick={عند_الإغلاق}>
            {t("common.cancel")}
          </الزر>
        </تذييل_الحوار>
      </محتوى_الحوار>
    </الحوار>
  );
}
