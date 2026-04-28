-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260428_capture_payment_sync_trigger
--
-- Captures the sync_sale_payment_totals function + trigger that existed in
-- production but was never recorded in version control.
--
-- The trigger fires AFTER every INSERT on sale_payments and recalculates
-- sales.amount_paid (from SUM) and sales.payment_status from scratch.
-- This is the single authoritative place where payment status is derived —
-- all three write paths (createSale, addPayment, convertQuote) rely on it.
--
-- Changes vs the manually-created version:
--   - Added SECURITY DEFINER + SET search_path for hardened execution context
--   - DROP … IF EXISTS makes the migration idempotent (safe to re-run)
--   - Trigger recreated explicitly so the migration is self-contained
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

CREATE OR REPLACE FUNCTION sync_sale_payment_totals()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_total NUMERIC;
  v_paid  NUMERIC;
BEGIN
  SELECT total_amount
  INTO   v_total
  FROM   sales
  WHERE  id = NEW.sale_id;

  SELECT COALESCE(SUM(amount), 0)
  INTO   v_paid
  FROM   sale_payments
  WHERE  sale_id = NEW.sale_id;

  UPDATE sales
  SET
    amount_paid    = v_paid,
    payment_status = CASE
      WHEN v_paid >= v_total THEN 'paid'
      WHEN v_paid  > 0       THEN 'partial'
      ELSE                        'unpaid'
    END
  WHERE id = NEW.sale_id;

  RETURN NEW;
END;
$$;

-- Recreate the trigger so this migration is fully self-contained.
-- DROP … IF EXISTS makes it safe to re-run without error.
DROP TRIGGER IF EXISTS after_payment_insert ON sale_payments;

CREATE TRIGGER after_payment_insert
  AFTER INSERT ON sale_payments
  FOR EACH ROW
  EXECUTE FUNCTION sync_sale_payment_totals();

COMMIT;
