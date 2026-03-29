-- ═══════════════════════════════════════════════════════════════════════════════
-- UCA SGI — Make tile-specific columns nullable
--
-- The original schema had width_cm, height_cm, tiles_per_carton, tile_area_m2,
-- carton_area_m2 as NOT NULL (tile-only world). With the multi-type model,
-- non-tile products do not provide these values — the NOT NULL constraint must
-- be relaxed. Existing tile products already have values; no data is lost.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE products
  ALTER COLUMN width_cm         DROP NOT NULL,
  ALTER COLUMN height_cm        DROP NOT NULL,
  ALTER COLUMN tiles_per_carton DROP NOT NULL,
  ALTER COLUMN tile_area_m2     DROP NOT NULL,
  ALTER COLUMN carton_area_m2   DROP NOT NULL;

COMMIT;
