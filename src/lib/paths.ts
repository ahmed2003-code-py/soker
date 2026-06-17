import { PartyType } from "@prisma/client";

/**
 * مسارات صفحات الطرف — موحّدة لتفادي تكرار التعبير
 * `type === CUSTOMER ? "customers" : "suppliers"` في عدة actions.
 */

/** مسار قائمة الطرف: /customers أو /suppliers */
export function مسار_قائمة_الطرف(النوع: PartyType): string {
  return النوع === PartyType.CUSTOMER ? "/customers" : "/suppliers";
}

/** مسار صفحة طرف محدد: /customers/{id} أو /suppliers/{id} */
export function مسار_صفحة_الطرف(النوع: PartyType, id: number): string {
  return `${مسار_قائمة_الطرف(النوع)}/${id}`;
}
