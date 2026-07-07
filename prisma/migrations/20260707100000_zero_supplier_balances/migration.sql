-- حذف كل حركات دفتر الأستاذ للموردين وتصفير أرصدتهم
DELETE FROM ledger_entries
WHERE party_id IN (SELECT id FROM parties WHERE type = 'SUPPLIER');

UPDATE parties
SET balance = 0, opening_balance = 0
WHERE type = 'SUPPLIER';
