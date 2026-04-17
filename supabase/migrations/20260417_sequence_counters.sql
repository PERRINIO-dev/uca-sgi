-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260417_sequence_counters
--
-- Supersedes: 20260417_fix_sequence_counters, 20260417_fix_sequence_max
-- (those were iterative patches; this is the complete, final solution)
--
-- Problem:
--   Every previous implementation derived the next sequence number by counting
--   or scanning existing rows (COUNT, MAX). That pattern has two failure modes:
--     1. GAPS     — hard-deleted rows lower the count, causing future inserts
--                   to regenerate numbers that are still in the table.
--     2. RACES    — two concurrent calls read the same aggregate, both produce
--                   the same number, one hits the unique constraint.
--
--   Additionally, the uniqueness constraints on sale_number and order_number
--   were global across all tenants, meaning two companies could not independently
--   hold the same number (e.g. VNT-2026-0001 and CMD-2026-0001 each).
--
-- Solution:
--   1. sequence_counters table — one row per (company_id, series).
--      INSERT ... ON CONFLICT DO UPDATE SET last_value = last_value + 1
--      RETURNING last_value  is a single atomic database operation.
--      No locks, no scans, no race conditions. Gaps in business data have
--      zero effect — the counter only moves forward.
--
--   2. Rewrite set_sale_number(), confirm_quote(), set_order_number() to
--      pull from sequence_counters instead of scanning rows.
--
--   3. Replace global unique constraints with per-tenant (company_id, number)
--      unique constraints so each company has its own independent namespace.
--
--   4. Backfill sequence_counters from current MAX values so numbering
--      continues seamlessly from the highest number ever issued.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. sequence_counters table ────────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS sequence_counters (
  company_id  UUID    NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  series      TEXT    NOT NULL,   -- e.g. 'DEV-2026', 'VNT-2026', 'CMD-2026'
  last_value  INTEGER NOT NULL DEFAULT 0,
  PRIMARY KEY (company_id, series)
);

-- Block direct access from client roles — all writes go through SECURITY
-- DEFINER functions (which run as the function owner and bypass RLS).
ALTER TABLE sequence_counters ENABLE ROW LEVEL SECURITY;

-- ── 2. set_sale_number() ──────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_sale_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_seq  INTEGER;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');

  IF NEW.status = 'draft' THEN
    INSERT INTO sequence_counters (company_id, series, last_value)
    VALUES (NEW.company_id, 'DEV-' || v_year, 1)
    ON CONFLICT (company_id, series)
    DO UPDATE SET last_value = sequence_counters.last_value + 1
    RETURNING last_value INTO v_seq;

    NEW.quote_number := 'DEV-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
    NEW.sale_number  := '';
  ELSE
    INSERT INTO sequence_counters (company_id, series, last_value)
    VALUES (NEW.company_id, 'VNT-' || v_year, 1)
    ON CONFLICT (company_id, series)
    DO UPDATE SET last_value = sequence_counters.last_value + 1
    RETURNING last_value INTO v_seq;

    NEW.sale_number := 'VNT-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
  END IF;

  RETURN NEW;
END;
$$;

-- ── 3. confirm_quote() ────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION confirm_quote(p_sale_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year        TEXT;
  v_seq         INTEGER;
  v_company_id  UUID;
  v_sale_number TEXT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');

  SELECT company_id INTO v_company_id
  FROM   sales
  WHERE  id = p_sale_id AND status = 'draft';

  IF NOT FOUND THEN
    RAISE EXCEPTION 'confirm_quote: devis introuvable ou déjà converti (id=%)', p_sale_id;
  END IF;

  INSERT INTO sequence_counters (company_id, series, last_value)
  VALUES (v_company_id, 'VNT-' || v_year, 1)
  ON CONFLICT (company_id, series)
  DO UPDATE SET last_value = sequence_counters.last_value + 1
  RETURNING last_value INTO v_seq;

  v_sale_number := 'VNT-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');

  UPDATE sales
  SET    status      = 'confirmed',
         sale_number = v_sale_number
  WHERE  id = p_sale_id;

  RETURN v_sale_number;
END;
$$;

-- ── 4. set_order_number() ─────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_order_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year       TEXT;
  v_seq        INTEGER;
  v_company_id UUID;
BEGIN
  SELECT company_id INTO v_company_id
  FROM   sales
  WHERE  id = NEW.sale_id;

  IF v_company_id IS NULL THEN
    RAISE EXCEPTION 'set_order_number: could not resolve company_id for sale_id=%', NEW.sale_id;
  END IF;

  NEW.company_id := v_company_id;
  v_year := TO_CHAR(NOW(), 'YYYY');

  INSERT INTO sequence_counters (company_id, series, last_value)
  VALUES (v_company_id, 'CMD-' || v_year, 1)
  ON CONFLICT (company_id, series)
  DO UPDATE SET last_value = sequence_counters.last_value + 1
  RETURNING last_value INTO v_seq;

  NEW.order_number := 'CMD-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
  RETURN NEW;
END;
$$;

-- ── 5. Per-tenant uniqueness constraints ──────────────────────────────────────

-- sales: sale_number — was a partial index on (sale_number) only
DROP INDEX IF EXISTS sales_sale_number_unique;
CREATE UNIQUE INDEX sales_sale_number_unique
  ON sales (company_id, sale_number)
  WHERE sale_number IS NOT NULL AND sale_number != '';

-- orders: order_number — was a global UNIQUE column constraint
ALTER TABLE orders DROP CONSTRAINT IF EXISTS orders_order_number_key;
ALTER TABLE orders ADD CONSTRAINT orders_company_order_number_unique
  UNIQUE (company_id, order_number);

-- ── 6. Backfill sequence_counters from current data ───────────────────────────
-- Seeds each counter to the MAX value ever issued so numbering resumes
-- above the highest existing number. Idempotent — ON CONFLICT GREATEST
-- ensures a re-run only raises values, never lowers them.

-- DEV counters (from quote_number column)
INSERT INTO sequence_counters (company_id, series, last_value)
SELECT
  company_id,
  'DEV-' || SUBSTRING(quote_number FROM 5 FOR 4),
  MAX(CAST(SUBSTRING(quote_number FROM 10) AS INTEGER))
FROM   sales
WHERE  quote_number ~ '^DEV-\d{4}-\d{4}$'
GROUP  BY company_id, SUBSTRING(quote_number FROM 5 FOR 4)
ON CONFLICT (company_id, series)
DO UPDATE SET last_value = GREATEST(sequence_counters.last_value, EXCLUDED.last_value);

-- VNT counters (from sale_number column)
INSERT INTO sequence_counters (company_id, series, last_value)
SELECT
  company_id,
  'VNT-' || SUBSTRING(sale_number FROM 5 FOR 4),
  MAX(CAST(SUBSTRING(sale_number FROM 10) AS INTEGER))
FROM   sales
WHERE  sale_number ~ '^VNT-\d{4}-\d{4}$'
GROUP  BY company_id, SUBSTRING(sale_number FROM 5 FOR 4)
ON CONFLICT (company_id, series)
DO UPDATE SET last_value = GREATEST(sequence_counters.last_value, EXCLUDED.last_value);

-- CMD counters (from order_number column)
-- With current data MAX = 107, so next order gets CMD-2026-0108.
INSERT INTO sequence_counters (company_id, series, last_value)
SELECT
  company_id,
  'CMD-' || SUBSTRING(order_number FROM 5 FOR 4),
  MAX(CAST(SUBSTRING(order_number FROM 10) AS INTEGER))
FROM   orders
WHERE  order_number ~ '^CMD-\d{4}-\d{4}$'
GROUP  BY company_id, SUBSTRING(order_number FROM 5 FOR 4)
ON CONFLICT (company_id, series)
DO UPDATE SET last_value = GREATEST(sequence_counters.last_value, EXCLUDED.last_value);

COMMIT;
