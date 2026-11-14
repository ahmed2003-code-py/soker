-- إصلاح باج الترحيل في المصروفات الشهرية:
-- فتح شهر قديم في الواجهة كان بيولّد «بند شهر» لكل بند حتى قبل ما البند يتضاف،
-- بالمقرر كامل وبدون مدفوع ⇒ المتبقي الوهمي بيترحّل شهر ورا شهر لحد الشهر الحالي.
--
-- بداية كل بند = بند الشهر اللي اتعمل مع إضافة البند (أصغر id لنفس البند،
-- لأن إضافة البند بتعمل بند شهره في نفس الـ transaction).
-- نحذف أي بند شهر أقدم من البداية دي، بشرط ما يكونش مربوط بأي حركة خزنة سارية.
-- المرحَّل للشهور الباقية بيتعاد حسابه تلقائياً من الكود عند فتح الصفحة.

DELETE FROM "monthly_expense_periods" AS p
USING (
  SELECT DISTINCT ON ("item_id") "item_id", "year", "month"
  FROM "monthly_expense_periods"
  ORDER BY "item_id", "id" ASC
) AS f
WHERE p."item_id" = f."item_id"
  AND (p."year" * 12 + p."month") < (f."year" * 12 + f."month")
  AND NOT EXISTS (
    SELECT 1 FROM "treasury_txns" t
    WHERE t."monthly_expense_period_id" = p."id" AND t."deleted_at" IS NULL
  );
