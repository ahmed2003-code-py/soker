-- ربط معاملات السداد المركّب القديمة (اللي اتعملت قبل جدول settlement_batches).
--
-- المنطق: في السداد المركّب، الجزء النقدي (دفعة موزّعة) وتظهير الشيكات بيتكتبوا
-- في نفس الترانزاكشن على قاعدة البيانات ⇒ created_at بتاعهم متطابق تقريباً.
-- فبنجمع الدفعة الموزّعة مع الشيكات المُظهَّرة لنفس المورد اللي قيد تظهيرها
-- اتكتب في نفس اللحظة (± 30 ثانية) تحت «معاملة سداد» واحدة.
-- آمن: بيلمس الأعمدة الجديدة بس (settlement_batch_id) ولا يغيّر أي قيمة مالية،
-- وبيتخطى أي صف مربوط بالفعل ⇒ إعادة التشغيل ما تعملش تكرار.
DO $$
DECLARE
  r RECORD;
  batch_id INT;
BEGIN
  FOR r IN
    SELECT sp.id AS split_id,
           sp.created_at AS created_at,
           le.party_id   AS party_id,
           le.date       AS date,
           le.description AS description,
           le.created_by_id AS created_by_id
    FROM split_payments sp
    JOIN LATERAL (
      SELECT l.party_id, l.date, l.description, l.created_by_id
      FROM ledger_entries l
      WHERE l.split_payment_id = sp.id AND l.deleted_at IS NULL
      ORDER BY l.id
      LIMIT 1
    ) le ON TRUE
    JOIN parties p ON p.id = le.party_id
    WHERE sp.settlement_batch_id IS NULL
      AND sp.deleted_at IS NULL
      AND p.type = 'SUPPLIER'
    ORDER BY sp.id
  LOOP
    IF EXISTS (
      SELECT 1
      FROM cheques c
      JOIN ledger_entries el ON el.id = c.endorse_ledger_entry_id
      WHERE c.settlement_batch_id IS NULL
        AND c.endorsed_to_id = r.party_id
        AND el.deleted_at IS NULL
        AND el.created_at BETWEEN r.created_at - INTERVAL '30 seconds'
                              AND r.created_at + INTERVAL '30 seconds'
    ) THEN
      INSERT INTO settlement_batches (party_id, date, note, created_by_id, created_at)
      VALUES (r.party_id, r.date, r.description, r.created_by_id, r.created_at)
      RETURNING id INTO batch_id;

      UPDATE split_payments SET settlement_batch_id = batch_id WHERE id = r.split_id;

      UPDATE cheques c
      SET settlement_batch_id = batch_id
      FROM ledger_entries el
      WHERE el.id = c.endorse_ledger_entry_id
        AND c.settlement_batch_id IS NULL
        AND c.endorsed_to_id = r.party_id
        AND el.deleted_at IS NULL
        AND el.created_at BETWEEN r.created_at - INTERVAL '30 seconds'
                              AND r.created_at + INTERVAL '30 seconds';
    END IF;
  END LOOP;
END $$;
