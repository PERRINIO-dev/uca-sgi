-- ─────────────────────────────────────────────────────────────────────────────
-- Échéancier de paiement (plan de versements planifiés)
-- Séparé de sale_payments : on ne mélange pas prévu et encaissé.
-- Le trigger sync_sale_payment_totals() n'est pas affecté.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE sale_payment_schedules (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  sale_id     UUID NOT NULL REFERENCES sales(id)     ON DELETE CASCADE,
  due_date    DATE NOT NULL,
  amount      NUMERIC(12, 0) NOT NULL
                CONSTRAINT sps_amount_positive CHECK (amount > 0),
  label       TEXT,
  is_paid     BOOLEAN NOT NULL DEFAULT false,
  paid_at     TIMESTAMPTZ,
  created_by  UUID REFERENCES auth.users(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT now()
);

ALTER TABLE sale_payment_schedules ENABLE ROW LEVEL SECURITY;

CREATE POLICY "sps_select" ON sale_payment_schedules FOR SELECT
  USING (company_id = get_my_company_id());

CREATE POLICY "sps_insert" ON sale_payment_schedules FOR INSERT
  WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "sps_update" ON sale_payment_schedules FOR UPDATE
  USING (company_id = get_my_company_id());

CREATE POLICY "sps_delete" ON sale_payment_schedules FOR DELETE
  USING (company_id = get_my_company_id());

-- Index for dashboard overdue query
CREATE INDEX sps_overdue_idx
  ON sale_payment_schedules (company_id, is_paid, due_date)
  WHERE is_paid = false;
