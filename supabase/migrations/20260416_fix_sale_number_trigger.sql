-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260416_fix_sale_number_trigger
--
-- Root cause: the BEFORE INSERT trigger on `sales` was wired to call
-- generate_sale_number() — the original function from the initial schema —
-- instead of set_sale_number(), which is the function all subsequent migrations
-- have been updating.
--
-- Because of this wiring mismatch:
--   • draft inserts called generate_sale_number() → got a VNT-YYYY-NNNN number
--   • quote_number was never written → stayed NULL → UI showed "—"
--   • set_sale_number() had the correct draft/DEV logic all along, but was
--     never invoked.
--
-- Fix:
--   1. Drop the mis-wired trigger and recreate it pointing to set_sale_number().
--   2. Backfill every draft/cancelled record that received a wrong VNT number:
--      clear sale_number and assign the correct DEV-YYYY-NNNN quote_number.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Rewire the trigger ─────────────────────────────────────────────────────
-- NOTE: if you already ran the DROP/CREATE trigger manually, these two
-- statements are idempotent (DROP IF EXISTS is safe; CREATE recreates it).

DROP TRIGGER IF EXISTS set_sale_number ON sales;

CREATE TRIGGER set_sale_number
  BEFORE INSERT ON sales
  FOR EACH ROW
  EXECUTE FUNCTION set_sale_number();

-- ── 2. Fix the UNIQUE constraint on sale_number ───────────────────────────────
-- The full UNIQUE constraint on sale_number prevents multiple draft rows from
-- sharing sale_number = '' (drafts have no VNT number yet, only quote_number).
-- Replace it with a partial unique index that enforces uniqueness only for
-- actual VNT/DEV numbers (non-empty values), leaving '' unrestricted.

ALTER TABLE sales DROP CONSTRAINT IF EXISTS sales_sale_number_key;

CREATE UNIQUE INDEX IF NOT EXISTS sales_sale_number_unique
  ON sales (sale_number)
  WHERE sale_number IS NOT NULL AND sale_number != '';

-- ── 3. Backfill affected rows ─────────────────────────────────────────────────
-- Target: draft or cancelled records where quote_number is NULL and sale_number
-- starts with 'VNT-' (signature of the broken trigger on a draft insert).
-- Assigns sequential DEV-YYYY-NNNN numbers ordered by created_at per company/year.
-- Clears the spurious VNT sale_number (now safe — partial index allows '').

UPDATE sales s
SET
  sale_number  = '',
  quote_number = sub.new_quote_number
FROM (
  SELECT
    id,
    'DEV-' || TO_CHAR(created_at, 'YYYY') || '-'
      || LPAD(
           ROW_NUMBER() OVER (
             PARTITION BY company_id, TO_CHAR(created_at, 'YYYY')
             ORDER BY created_at
           )::TEXT,
           4, '0'
         ) AS new_quote_number
  FROM   sales
  WHERE  quote_number IS NULL
    AND  sale_number  LIKE 'VNT-%'
    AND  status       IN ('draft', 'cancelled')
) sub
WHERE s.id = sub.id;

COMMIT;
