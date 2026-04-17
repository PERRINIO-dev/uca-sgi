-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260417_fix_sequence_max
--
-- Root cause of "duplicate key value violates unique constraint
-- sales_sale_number_unique" on confirm_quote():
--
--   Both set_sale_number() and confirm_quote() used COUNT(*)+1 to derive the
--   next sequence slot. COUNT breaks in two ways:
--     1. GAPS  — if a VNT-numbered row is deleted (not just cancelled), the
--                count is lower than the highest existing number, so the next
--                call regenerates an already-used slot.
--     2. RACES — two concurrent calls read the same count, both produce the
--                same number, and one of them fails the unique constraint.
--
-- Fix:
--   Replace COUNT(*)+1 with COALESCE(MAX(seq),0)+1, which always starts above
--   the highest number ever issued — gaps are skipped, not reused.
--   Add pg_advisory_xact_lock() to serialize concurrent calls per company+year.
--   Apply the same fix to set_sale_number() for consistency.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. set_sale_number() — MAX-based + advisory lock ─────────────────────────

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
    -- Serialize concurrent DEV inserts for this company+year
    PERFORM pg_advisory_xact_lock(
      hashtext(NEW.company_id::text || '-DEV-' || v_year)
    );

    SELECT COALESCE(
      MAX(CAST(SUBSTRING(quote_number FROM LENGTH('DEV-' || v_year || '-') + 1) AS INTEGER)),
      0
    ) + 1 INTO v_seq
    FROM   sales
    WHERE  company_id   = NEW.company_id
      AND  quote_number LIKE 'DEV-' || v_year || '-%';

    NEW.quote_number := 'DEV-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
    NEW.sale_number  := '';
  ELSE
    -- Serialize concurrent VNT inserts for this company+year
    PERFORM pg_advisory_xact_lock(
      hashtext(NEW.company_id::text || '-VNT-' || v_year)
    );

    SELECT COALESCE(
      MAX(CAST(SUBSTRING(sale_number FROM LENGTH('VNT-' || v_year || '-') + 1) AS INTEGER)),
      0
    ) + 1 INTO v_seq
    FROM   sales
    WHERE  company_id  = NEW.company_id
      AND  sale_number LIKE 'VNT-' || v_year || '-%';

    NEW.sale_number := 'VNT-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
  END IF;

  RETURN NEW;
END;
$$;

-- ── 2. confirm_quote() — MAX-based + advisory lock ────────────────────────────

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

  -- Serialize concurrent VNT assignments for this company+year
  PERFORM pg_advisory_xact_lock(
    hashtext(v_company_id::text || '-VNT-' || v_year)
  );

  -- MAX: skip over any gaps — never reuse a slot even if a row was deleted
  SELECT COALESCE(
    MAX(CAST(SUBSTRING(sale_number FROM LENGTH('VNT-' || v_year || '-') + 1) AS INTEGER)),
    0
  ) + 1 INTO v_seq
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

COMMIT;
