-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260415_drop_sale_reservation_trigger
--
-- The original schema had a trigger on the `sales` table that reserved stock
-- automatically when a sale was inserted or its status updated to 'confirmed'.
-- The application code (createSale / convertQuote) ALSO calls the
-- reserve_stock_on_sale() RPC explicitly — resulting in 2× the expected
-- reservation (2N units reserved for a sale of N units).
--
-- This migration removes the DB-level trigger so that stock reservation is
-- managed exclusively by the application via the reserve_stock_on_sale RPC.
-- The RPC uses SELECT FOR UPDATE to prevent concurrent race conditions,
-- making the trigger redundant and harmful.
--
-- Complementary clean-up: run 20260414_reserved_tiles_correction.sql first
-- (or after) to reset any reserved_tiles values corrupted by the double count.
-- ─────────────────────────────────────────────────────────────────────────────

-- Drop the reservation trigger and its backing function.
-- Both are harmless to drop even if they don't exist (IF EXISTS).

DROP TRIGGER IF EXISTS on_sale_status_change       ON sales;
DROP TRIGGER IF EXISTS trg_reserve_stock_on_sale   ON sales;
DROP TRIGGER IF EXISTS reserve_stock_on_sale_insert ON sales;

DROP FUNCTION IF EXISTS reserve_stock_on_sale_insert() CASCADE;
DROP FUNCTION IF EXISTS handle_sale_status_change()    CASCADE;
