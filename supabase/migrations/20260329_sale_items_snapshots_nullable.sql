-- ═══════════════════════════════════════════════════════════════════════════════
-- UCA SGI — Make tile snapshot columns nullable in sale_items
--
-- tile_area_m2_snapshot and tiles_per_carton_snapshot were NOT NULL in the
-- original schema (tile-only world). Non-tile products (unit, linear_m, bag,
-- liter) have no tile dimensions — these snapshots must be nullable.
-- Existing tile sale_items already have values; no data is lost.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE sale_items
  ALTER COLUMN tile_area_m2_snapshot     DROP NOT NULL,
  ALTER COLUMN tiles_per_carton_snapshot DROP NOT NULL;

COMMIT;
