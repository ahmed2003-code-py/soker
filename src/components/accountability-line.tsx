import { نص_تاريخ } from "@/components/date-text";

type الخصائص = {
  أنشأ?: string | null;
  تاريخ_الإنشاء?: Date | string | null;
  عدّل?: string | null;
  تاريخ_التعديل?: Date | string | null;
};

/** سطر المساءلة: "أضيف بواسطة … — التاريخ" و"آخر تعديل بواسطة …" */
export function سطر_المساءلة({
  أنشأ,
  تاريخ_الإنشاء,
  عدّل,
  تاريخ_التعديل,
}: الخصائص) {
  return (
    <div className="flex flex-wrap gap-x-6 gap-y-1 text-xs text-muted-foreground">
      {أنشأ && (
        <span>
          أُضيف بواسطة: <span className="font-medium text-foreground">{أنشأ}</span>
          {تاريخ_الإنشاء && (
            <>
              {" — "}
              <نص_تاريخ القيمة={تاريخ_الإنشاء} مع_الوقت />
            </>
          )}
        </span>
      )}
      {عدّل && (
        <span>
          آخر تعديل بواسطة:{" "}
          <span className="font-medium text-foreground">{عدّل}</span>
          {تاريخ_التعديل && (
            <>
              {" — "}
              <نص_تاريخ القيمة={تاريخ_التعديل} مع_الوقت />
            </>
          )}
        </span>
      )}
    </div>
  );
}
