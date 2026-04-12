-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: devis (quotes)
--
-- 1. Add quote_number column to sales
-- 2. Replace set_sale_number() — draft status → DEV prefix, confirmed → VNT prefix
-- 3. Add confirm_quote() RPC — called when converting a devis to a confirmed sale
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Column
ALTER TABLE sales ADD COLUMN IF NOT EXISTS quote_number TEXT;

-- 2. Replace set_sale_number
--    Before: counts ALL sales for the company/year (drafts included).
--    After : drafts get DEV-YYYY-NNNN, confirmed sales get VNT-YYYY-NNNN.
--    The two sequences are independent — no gaps, no cross-contamination.
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
    -- Count existing DRAFT sales only (devis sequence)
    SELECT COUNT(*) + 1 INTO v_seq
    FROM   sales
    WHERE  company_id                = NEW.company_id
      AND  TO_CHAR(created_at, 'YYYY') = v_year
      AND  status                    = 'draft';

    NEW.quote_number := 'DEV-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
    NEW.sale_number  := '';  -- VNT number assigned only when confirmed
  ELSE
    -- Count non-draft sales only (VNT sequence)
    SELECT COUNT(*) + 1 INTO v_seq
    FROM   sales
    WHERE  company_id                = NEW.company_id
      AND  TO_CHAR(created_at, 'YYYY') = v_year
      AND  status                    != 'draft';

    NEW.sale_number := 'VNT-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');
  END IF;

  RETURN NEW;
END;
$$;

-- 3. confirm_quote — generates the VNT number and confirms the sale atomically.
--    Called via adminSupabase.rpc('confirm_quote', { p_sale_id }) from the server action.
--    Uses SECURITY DEFINER so the count query runs without RLS interference.
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

  -- Next VNT sequence (non-draft sales for this company/year)
  SELECT COUNT(*) + 1 INTO v_seq
  FROM   sales
  WHERE  company_id                = v_company_id
    AND  TO_CHAR(created_at, 'YYYY') = v_year
    AND  status                    != 'draft';

  v_sale_number := 'VNT-' || v_year || '-' || LPAD(v_seq::TEXT, 4, '0');

  UPDATE sales
  SET    status      = 'confirmed',
         sale_number = v_sale_number
  WHERE  id = p_sale_id;

  RETURN v_sale_number;
END;
$$;
