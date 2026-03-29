-- ═══════════════════════════════════════════════════════════════════════════════
-- UCA SGI — Make tile price columns nullable
--
-- floor_price_per_m2 and reference_price_per_m2 were NOT NULL in the original
-- schema (tile-only world). Non-tile products use floor_price_per_unit /
-- reference_price_per_unit instead — these must be nullable.
-- purchase_price may also be NOT NULL depending on original schema.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TABLE products
  ALTER COLUMN floor_price_per_m2     DROP NOT NULL,
  ALTER COLUMN reference_price_per_m2 DROP NOT NULL;

-- purchase_price: make nullable if constrained (safe no-op if already nullable)
ALTER TABLE products
  ALTER COLUMN purchase_price DROP NOT NULL;

COMMIT;
