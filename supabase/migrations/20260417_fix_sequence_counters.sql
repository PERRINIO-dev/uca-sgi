-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260417_fix_sequence_counters
--
-- Root cause of duplicate DEV / VNT numbers:
--   set_sale_number() counted rows WHERE status = 'draft' (for DEV) or
--   status != 'draft' (for VNT). Cancelling a devis/sale reduced that count,
--   so the next insert re-used the same sequence number.
--
-- Fix:
--   Count by the existing prefix pattern instead of by status.
--   A cancelled DEV-2026-0001 still occupies slot 1 — the next devis gets 0002.
--
-- Parts:
--   1. Replace set_sale_number() with pattern-based sequence counting.
--   2. Replace confirm_quote() with pattern-based sequence counting.
--   3. Backfill: reassign all DEV numbers in chronological order to eliminate
--      any duplicates that were created by the old logic.
--      (Idempotent: correctly-numbered rows are not touched.)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Fix set_sale_number() ──────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION set_sale_number()
RETURNS trigger
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year TEXT;
  v_seq  BIGINT;
BEGIN
  v_year := TO_CHAR(NOW(), 'YYYY');

  IF NEW.status = 'draft' THEN
    -- Count ALL existing DEV numbers for this company/year, regardless of status.
    -- A cancelled devis still holds its slot — prevents reuse.
    SELECT COUNT(*) + 1 INTO v_seq
    FROM   sales
    WHERE  company_id   = NEW.company_id
      AND  quote_number LIKE 'DEV-' || v_year || '-%';

    NEW.quote_number := 'DEV-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
    NEW.sale_number  := '';
  ELSE
    -- Count ALL existing VNT numbers for this company/year, regardless of status.
    SELECT COUNT(*) + 1 INTO v_seq
    FROM   sales
    WHERE  company_id  = NEW.company_id
      AND  sale_number LIKE 'VNT-' || v_year || '-%';

    NEW.sale_number := 'VNT-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
  END IF;

  RETURN NEW;
END;
$$;

-- ── 2. Fix confirm_quote() ────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION confirm_quote(p_sale_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_year        TEXT;
  v_seq         BIGINT;
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

  -- Count ALL existing VNT numbers for this company/year, regardless of status.
  SELECT COUNT(*) + 1 INTO v_seq
  FROM   sales
  WHERE  company_id  = v_company_id
    AND  sale_number LIKE 'VNT-' || v_year || '-%';

  v_sale_number := 'VNT-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');

  UPDATE sales
  SET    status      = 'confirmed',
         sale_number = v_sale_number
  WHERE  id = p_sale_id;

  RETURN v_sale_number;
END;
$$;

-- ── 3. Backfill — eliminate existing duplicate DEV numbers ────────────────────
-- Reassign every DEV-YYYY-NNNN in strict chronological order per company/year.
-- Records that already hold the correct number are not updated (no-op rows).

WITH ranked AS (
  SELECT
    id,
    'DEV-' || TO_CHAR(created_at, 'YYYY') || '-'
      || LPAD(
           ROW_NUMBER() OVER (
             PARTITION BY company_id, TO_CHAR(created_at, 'YYYY')
             ORDER BY created_at
           )::TEXT,
           4, '0'
         ) AS correct_quote_number
  FROM sales
  WHERE quote_number LIKE 'DEV-%'
)
UPDATE sales s
SET    quote_number = r.correct_quote_number
FROM   ranked r
WHERE  s.id = r.id
  AND  s.quote_number IS DISTINCT FROM r.correct_quote_number;

COMMIT;
