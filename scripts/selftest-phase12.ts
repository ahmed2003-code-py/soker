/**
 * اختبار ذاتي للمرحلة 12: التقارير.
 * يستدعي مباشرة دوال lib/reports.ts (لا حاجة للخادم) للتحقق من تطابق
 * أرقام التقارير مع الوحدات وصحة الفلاتر.
 */
import { PrismaClient } from "@prisma/client";
import {
  تقرير_كشف_حساب,
  تقرير_خزنة_حركات,
  تقرير_أرصدة_الخزنة,
  تقرير_فواتير_يومية,
  تقرير_فواتير_شهرية,
  تقرير_فواتير_حسب_العميل,
  تقرير_شيكات_مستحقة,
  تقرير_شيكات_متأخرة,
  تقرير_شيكات_شهرية,
} from "../src/lib/reports";

const prisma = new PrismaClient();

function تحقق(ش: boolean, ر: string) {
  if (!ش) throw new Error("فشل: " + ر);
  console.log("✓ " + ر);
}

async function main() {
  // ----- كشف حساب عميل -----
  const عميل = await prisma.party.findFirst({
    where: { type: "CUSTOMER" },
    orderBy: { id: "asc" },
  });
  if (عميل) {
    const ك = await تقرير_كشف_حساب(عميل.id);
    تحقق(!!ك, "كشف حساب عميل: يُحسب بنجاح");

    // الرصيد المُحسب يطابق رصيد الطرف المخزّن
    const فرق = Math.abs((ك?.الرصيد_الختامي ?? 0) - Number(عميل.balance));
    تحقق(فرق < 0.01, `الرصيد المُحسب يطابق الرصيد المخزّن (فارق ${فرق.toFixed(4)})`);
  } else {
    console.log("⊘ تخطّي كشف العميل (لا يوجد عملاء)");
  }

  // ----- أرصدة الخزنة -----
  const أرصدة = await تقرير_أرصدة_الخزنة();
  const حسابات = await prisma.treasuryAccount.findMany();
  const إجمالي_فعلي = حسابات.reduce((س, h) => س + Number(h.balance), 0);
  تحقق(
    Math.abs(أرصدة.الإجمالي - إجمالي_فعلي) < 0.01,
    `أرصدة الخزنة: الإجمالي = ${أرصدة.الإجمالي.toFixed(2)} يطابق الواقع`
  );

  // ----- إيرادات/مصروفات الخزنة -----
  const إيرادات = await تقرير_خزنة_حركات("INCOME", {});
  const مصروفات = await تقرير_خزنة_حركات("EXPENSE", {});
  const مجموع_دخل_فعلي = await prisma.treasuryTxn.aggregate({
    where: { kind: "INCOME" },
    _sum: { amount: true },
  });
  const مجموع_صرف_فعلي = await prisma.treasuryTxn.aggregate({
    where: { kind: "EXPENSE" },
    _sum: { amount: true },
  });
  تحقق(
    Math.abs(إيرادات.الإجمالي - Number(مجموع_دخل_فعلي._sum.amount ?? 0)) < 0.01,
    `إيرادات الخزنة: ${إيرادات.الإجمالي.toFixed(2)} = الواقع`
  );
  تحقق(
    Math.abs(مصروفات.الإجمالي - Number(مجموع_صرف_فعلي._sum.amount ?? 0)) < 0.01,
    `مصروفات الخزنة: ${مصروفات.الإجمالي.toFixed(2)} = الواقع`
  );

  // ----- الفواتير اليومية / الشهرية / حسب العميل -----
  const يومية = await تقرير_فواتير_يومية({});
  const شهرية = await تقرير_فواتير_شهرية({});
  const حسب_العميل = await تقرير_فواتير_حسب_العميل({});
  const إجمالي_فواتير_فعلي = await prisma.invoice.aggregate({ _sum: { totalAmount: true } });
  const ف = Number(إجمالي_فواتير_فعلي._sum.totalAmount ?? 0);
  تحقق(Math.abs(يومية.الإجمالي_العام - ف) < 0.01, `الفواتير اليومية: ${يومية.الإجمالي_العام.toFixed(2)} = الواقع`);
  تحقق(Math.abs(شهرية.الإجمالي_العام - ف) < 0.01, `الفواتير الشهرية: مجموع = الواقع`);
  تحقق(Math.abs(حسب_العميل.الإجمالي_العام - ف) < 0.01, `الفواتير حسب العميل: مجموع = الواقع`);

  // ----- الشيكات -----
  const مستحقة = await تقرير_شيكات_مستحقة({});
  const متأخرة = await تقرير_شيكات_متأخرة();
  const شهرية_شيك = await تقرير_شيكات_شهرية({});
  تحقق(Array.isArray(مستحقة.الصفوف), "تقرير شيكات مستحقة يعمل");
  تحقق(Array.isArray(متأخرة.الصفوف), "تقرير شيكات متأخرة يعمل");
  تحقق(Array.isArray(شهرية_شيك.الصفوف), "تقرير الشيكات الشهرية يعمل");

  // ----- فلتر تاريخ يقلّص النتائج -----
  const عينة_فواتير = await prisma.invoice.findFirst({ orderBy: { date: "asc" }, select: { date: true } });
  if (عينة_فواتير) {
    const الأقدم = عينة_فواتير.date;
    const قبل = new Date(الأقدم.getFullYear(), الأقدم.getMonth(), الأقدم.getDate() - 1);
    const حتى_البدء = await تقرير_فواتير_يومية({ إلى: قبل });
    تحقق(
      حتى_البدء.الصفوف.length === 0,
      `فلتر "إلى" قبل أقدم فاتورة يُخرج صفر صفوف (= ${حتى_البدء.الصفوف.length})`
    );
  }
}

main()
  .then(() => {
    console.log("\n✅ نجح اختبار المرحلة 12");
    process.exit(0);
  })
  .catch((e) => {
    console.error("\n❌ فشل اختبار المرحلة 12:", e.message);
    process.exit(1);
  })
  .finally(() => prisma.$disconnect());
