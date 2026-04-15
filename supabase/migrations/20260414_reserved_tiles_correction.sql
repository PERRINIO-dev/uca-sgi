-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260414_reserved_tiles_correction
--
-- Fixes data corruption in stock.reserved_tiles caused by a bug in cancelSale
-- where sale_items were fetched with the wrong Supabase client (authenticated
-- vs. service-role), causing release_stock_on_cancel to silently no-op on
-- cancellations. This left reserved_tiles inflated for cancelled sales.
--
-- Correction: recompute reserved_tiles for every product as the exact sum
-- of quantity_tiles across all sale_items for sales currently in an active
-- status (confirmed, preparing, ready). Cancelled and delivered sales must
-- NOT hold any reservation.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE stock s
SET    reserved_tiles = COALESCE(
  (
    SELECT SUM(si.quantity_tiles)
    FROM   sale_items si
    JOIN   sales      sa ON sa.id = si.sale_id
    WHERE  si.product_id  = s.product_id
      AND  sa.company_id  = s.company_id
      AND  sa.status      IN ('confirmed', 'preparing', 'ready')
  ),
  0
)
WHERE reserved_tiles != COALESCE(
  (
    SELECT SUM(si.quantity_tiles)
    FROM   sale_items si
    JOIN   sales      sa ON sa.id = si.sale_id
    WHERE  si.product_id  = s.product_id
      AND  sa.company_id  = s.company_id
      AND  sa.status      IN ('confirmed', 'preparing', 'ready')
  ),
  0
);

COMMIT;
