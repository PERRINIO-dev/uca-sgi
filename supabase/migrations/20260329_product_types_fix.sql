-- ═══════════════════════════════════════════════════════════════════════════════
-- UCA SGI — Product types fix migration
--
-- Context: 20260330_product_types.sql failed with "column product_type already
-- exists" because the column was added in a previous (interrupted) session.
-- PostgreSQL rolled back the full transaction, so all other columns are missing.
-- 20260329_product_categories.sql ran successfully (uses product_type which existed).
--
-- This migration adds only the missing columns, each with IF NOT EXISTS.
-- The product_type column and product_categories table already exist — skipped.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ── Ensure product_type has the correct CHECK constraint ──────────────────────
-- The column may exist without the constraint if it was added manually.
-- ALTER TABLE ... ADD CONSTRAINT IF NOT EXISTS is available in PG 9.6+

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'products_product_type_check'
      AND conrelid = 'products'::regclass
  ) THEN
    ALTER TABLE products
      ADD CONSTRAINT products_product_type_check
        CHECK (product_type IN ('tile', 'unit', 'linear_m', 'bag', 'liter'));
  END IF;
END $$;

-- ── Display labels ────────────────────────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS unit_label    TEXT NOT NULL DEFAULT 'm²',
  ADD COLUMN IF NOT EXISTS package_label TEXT NOT NULL DEFAULT 'carton';

-- ── Generic pricing (non-tile types) ─────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS floor_price_per_unit     NUMERIC CHECK (floor_price_per_unit     >= 0),
  ADD COLUMN IF NOT EXISTS reference_price_per_unit NUMERIC CHECK (reference_price_per_unit >= 0);

-- ── Type-specific physical attributes ────────────────────────────────────────

ALTER TABLE products
  ADD COLUMN IF NOT EXISTS piece_length_m     NUMERIC CHECK (piece_length_m     > 0),
  ADD COLUMN IF NOT EXISTS container_volume_l NUMERIC CHECK (container_volume_l > 0),
  ADD COLUMN IF NOT EXISTS bag_weight_kg      NUMERIC CHECK (bag_weight_kg      > 0),
  ADD COLUMN IF NOT EXISTS pieces_per_package INTEGER CHECK (pieces_per_package > 0);

-- ── Backfill existing tile products ──────────────────────────────────────────

UPDATE products SET
  unit_label    = 'm²',
  package_label = 'carton'
WHERE product_type = 'tile'
  AND (unit_label IS NULL OR unit_label = '');

-- ── Index ─────────────────────────────────────────────────────────────────────

CREATE INDEX IF NOT EXISTS idx_products_type ON products (company_id, product_type);

COMMIT;
