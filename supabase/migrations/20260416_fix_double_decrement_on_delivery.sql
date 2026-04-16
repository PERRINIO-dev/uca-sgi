-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260416_fix_double_decrement_on_delivery
--
-- Root cause: stock was being decremented TWICE on every delivery.
--
--   1. DB trigger `on_order_delivered` (BEFORE UPDATE on orders) fires when
--      orders.status → 'delivered' and calls deduct_stock_on_delivery().
--
--   2. Application code (warehouse/actions.ts) also calls the
--      decrement_stock_on_delivery() RPC explicitly after updating the order.
--
-- Result: each delivery deducted 2× the expected quantity from stock.
--
-- Fix: drop the DB-level trigger and its backing function so that stock
-- decrement is managed exclusively by the application via the
-- decrement_stock_on_delivery(UUID, NUMERIC, UUID) RPC.
--
-- Secondary clean-up: drop the orphaned INTEGER overload of
-- decrement_stock_on_delivery that was left behind when the NUMERIC version
-- was added via CREATE OR REPLACE (PostgreSQL treats different signatures as
-- separate overloads, not replacements).
-- ─────────────────────────────────────────────────────────────────────────────

-- 1. Drop the delivery trigger
DROP TRIGGER IF EXISTS on_order_delivered ON orders;

-- 2. Drop the trigger's backing function
DROP FUNCTION IF EXISTS deduct_stock_on_delivery() CASCADE;

-- 3. Drop the orphaned INTEGER overload of decrement_stock_on_delivery
--    (the NUMERIC + company_id version created by 20260415_fix_delivery_rpc.sql
--    is the authoritative one and must be kept)
DROP FUNCTION IF EXISTS decrement_stock_on_delivery(UUID, INTEGER);
