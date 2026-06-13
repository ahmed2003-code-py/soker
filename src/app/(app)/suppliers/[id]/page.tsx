import { تفاصيل_الطرف } from "../../_parties/detail";

export default function صفحة_مورد({ params }: { params: { id: string } }) {
  return <تفاصيل_الطرف المعرف={Number(params.id)} النوع="SUPPLIER" />;
}
