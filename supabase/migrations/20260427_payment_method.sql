-- T1.1 — Mode de règlement
-- Add payment_method to sale_payments. DEFAULT 'especes' covers all existing rows.

ALTER TABLE sale_payments
  ADD COLUMN IF NOT EXISTS payment_method TEXT NOT NULL DEFAULT 'especes'
    CHECK (payment_method IN ('especes', 'mobile_money', 'virement', 'cheque', 'autre'));
