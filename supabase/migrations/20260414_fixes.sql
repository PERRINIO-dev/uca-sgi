-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260414_fixes
--
-- 1. Backfill quote_number for draft sales created before 20260412_quotes.sql
-- 2. Fix stock_view: guard against NULL tiles_per_carton / tile_area_m2
--    (non-tile products have these columns NULL → division would return NULL
--     making available_full_cartons/loose_tiles/available_m2 unusable)
-- 3. Extend sale_payments_insert RLS policy so vendors can record payments
--    on their own sales (server actions use adminSupabase already, but this
--    ensures the policy matches the intended access model)
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

-- ── 1. Backfill quote_number ──────────────────────────────────────────────────
-- Assign DEV-YYYY-NNNN to every draft sale that has no quote_number yet.
-- Uses a window function to assign sequential numbers per company × year,
-- ordered by creation date to preserve chronological order.

UPDATE sales s
SET    quote_number = sub.new_quote_number
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
  WHERE  status       = 'draft'
    AND  quote_number IS NULL
) sub
WHERE s.id = sub.id;

-- ── 2. Rebuild stock_view with NULL-safe expressions ─────────────────────────
-- For non-tile products, tiles_per_carton and tile_area_m2 are NULL.
-- NULLIF and COALESCE guard every division to return 0 instead of NULL.

DROP VIEW IF EXISTS stock_view;

CREATE VIEW stock_view
WITH (security_invoker = on)
AS
SELECT
  s.product_id,
  s.company_id,
  p.name                                                                   AS product_name,
  p.reference_code,
  p.product_type,
  p.unit_label,
  p.tiles_per_carton,
  p.tile_area_m2,
  s.total_tiles,
  s.reserved_tiles,

  -- Available stock (unreserved)
  (s.total_tiles - s.reserved_tiles)                                       AS available_tiles,

  -- Carton breakdown — only meaningful for tile products; 0 for others
  CASE
    WHEN p.tiles_per_carton IS NULL OR p.tiles_per_carton = 0 THEN 0
    ELSE FLOOR((s.total_tiles - s.reserved_tiles) / p.tiles_per_carton)
  END                                                                      AS available_full_cartons,

  CASE
    WHEN p.tiles_per_carton IS NULL OR p.tiles_per_carton = 0 THEN 0
    ELSE (
      (s.total_tiles - s.reserved_tiles)
      - FLOOR((s.total_tiles - s.reserved_tiles) / p.tiles_per_carton)
        * p.tiles_per_carton
    )
  END                                                                      AS loose_tiles,

  -- Available surface area — tile products only; 0 for others
  COALESCE((s.total_tiles - s.reserved_tiles) * p.tile_area_m2, 0)        AS available_m2,

  -- Total cartons in stock (ignores reservations) — for display
  CASE
    WHEN p.tiles_per_carton IS NULL OR p.tiles_per_carton = 0 THEN 0
    ELSE FLOOR(s.total_tiles / p.tiles_per_carton)
  END                                                                      AS full_cartons

FROM stock     s
JOIN products  p ON p.id = s.product_id;

GRANT SELECT ON stock_view TO authenticated;

-- ── 3. Allow vendors to insert sale_payments for their own sales ──────────────
-- The original policy only covered owner/admin. Vendors recording payments on
-- their own confirmed sales were blocked. The server actions use adminSupabase
-- already (fixing the immediate symptom), but the policy should match intent.

DROP POLICY IF EXISTS sale_payments_insert ON sale_payments;

CREATE POLICY sale_payments_insert ON sale_payments
  FOR INSERT TO authenticated
  WITH CHECK (
    company_id = get_my_company_id()
    AND (
      get_my_role() IN ('owner', 'admin')
      OR (
        get_my_role() = 'vendor'
        AND EXISTS (
          SELECT 1 FROM sales s
          WHERE s.id = sale_payments.sale_id
            AND s.vendor_id = auth.uid()
            AND s.company_id = get_my_company_id()
        )
      )
    )
  );

COMMIT;
