-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260416_find_or_create_product_category
--
-- Replaces the fragile JS-side slug computation in ensureProductCategory with
-- a single SECURITY DEFINER RPC that runs entirely in PostgreSQL.
--
-- Root cause of the previous bug: JavaScript's normalizeCategorySlug did not
-- match PostgreSQL's unaccent() for all characters (e.g. Œ→oe, Æ→ae, ß→ss).
-- The JS-computed slug was used to query the DB, but the DB stored slugs via
-- the set_category_slug trigger (which calls normalize_category_slug / unaccent).
-- This mismatch caused:
--   - SELECT to find nothing (slug "acier-gros œuvre" ≠ DB "acier-gros oeuvre")
--   - INSERT to fail with UNIQUE violation (slug already existed from 1st attempt)
--   - Fallback SELECT also failed (same wrong slug) → null → "La catégorie est requise."
--
-- This RPC uses normalize_category_slug (the exact same function the trigger
-- uses), so there is zero possibility of a JS/DB normalization mismatch.
-- ON CONFLICT DO UPDATE makes the operation fully atomic and race-condition safe.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION find_or_create_product_category(
  p_company_id   UUID,
  p_product_type TEXT,
  p_name         TEXT
)
RETURNS TABLE(id UUID, name TEXT)
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_slug TEXT;
  v_id   UUID;
  v_name TEXT;
BEGIN
  -- Trim first; empty name is not allowed
  p_name := trim(p_name);
  IF p_name = '' THEN
    RETURN;  -- returns 0 rows → caller treats as null → "La catégorie est requise."
  END IF;

  v_slug := normalize_category_slug(p_name);

  -- Upsert: insert the category if it does not exist, or bump usage_count if it does.
  -- ON CONFLICT fires AFTER the BEFORE INSERT trigger sets slug = normalize_category_slug(name),
  -- so the conflict target correctly matches the trigger-generated slug.
  INSERT INTO product_categories (company_id, product_type, name, usage_count)
  VALUES (p_company_id, p_product_type, p_name, 1)
  ON CONFLICT (company_id, product_type, slug)
    DO UPDATE SET usage_count = product_categories.usage_count + 1
  RETURNING product_categories.id, product_categories.name
  INTO v_id, v_name;

  RETURN QUERY SELECT v_id, v_name;
END;
$$;

-- Grant to service_role so adminSupabase can call it from server actions
GRANT EXECUTE
  ON FUNCTION find_or_create_product_category(UUID, TEXT, TEXT)
  TO service_role;
