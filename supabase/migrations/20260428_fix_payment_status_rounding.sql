-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260428_fix_payment_status_rounding
--
-- Data correction for sales created before the float-rounding fix
-- (commit 9a1d9aa, 2026-04-28).
--
-- Root cause:
--   client-side cartTotal = m2 × price (unrounded float, e.g. 2116.8)
--   server-side serverTotal = Math.round(m2 × price) = 2117
--   → amountPaid (2116.8) < serverTotal (2117) → payment_status = 'partial'
--   The displayed balance rounded to 0, masking the 0.2-unit discrepancy.
--
-- Safe condition: discrepancy < 1 unit.
--   Any real-world partial payment leaves at least 1 unit outstanding.
--   Sub-unit discrepancies are always float noise, never intentional.
--
-- Fix: snap amount_paid up to total_amount and mark as paid.
--   This also closes the theoretical loophole where addPayment() could
--   record a 0.2-unit "final" payment on an already-complete sale.
-- ─────────────────────────────────────────────────────────────────────────────

BEGIN;

UPDATE sales
SET
  amount_paid    = total_amount,
  payment_status = 'paid'
WHERE payment_status  = 'partial'
  AND status         NOT IN ('cancelled', 'draft')
  AND total_amount - amount_paid > 0
  AND total_amount - amount_paid < 1;

COMMIT;
