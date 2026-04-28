-- ─────────────────────────────────────────────────────────────────────────────
-- T4.1 — Caisse journalière
-- Tracks daily cash movements per boutique.
-- Espèces inflows are derived from sale_payments; this table covers outflows
-- (expenses, withdrawals) and optional opening cash entries.
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE cash_entries (
  id          UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id  UUID          NOT NULL REFERENCES companies(id),
  boutique_id UUID          NOT NULL REFERENCES boutiques(id),
  entry_date  DATE          NOT NULL,
  entry_type  TEXT          NOT NULL CHECK (entry_type IN ('expense', 'withdrawal', 'opening')),
  amount      NUMERIC(12,0) NOT NULL CHECK (amount > 0),
  description TEXT          NOT NULL CHECK (char_length(trim(description)) >= 2),
  created_by  UUID          NOT NULL REFERENCES users(id),
  created_at  TIMESTAMPTZ   NOT NULL DEFAULT now()
);

CREATE INDEX idx_cash_entries_boutique_date ON cash_entries (boutique_id, entry_date);
CREATE INDEX idx_cash_entries_company       ON cash_entries (company_id);

-- ─────────────────────────────────────────────────────────────────────────────
-- Daily closing records — one per boutique per day, immutable once created
-- ─────────────────────────────────────────────────────────────────────────────

CREATE TABLE cash_closings (
  id               UUID          NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  company_id       UUID          NOT NULL REFERENCES companies(id),
  boutique_id      UUID          NOT NULL REFERENCES boutiques(id),
  closing_date     DATE          NOT NULL,
  expected_amount  NUMERIC(12,0) NOT NULL,
  declared_amount  NUMERIC(12,0) NOT NULL,
  difference       NUMERIC(12,0) NOT NULL,  -- declared - expected, signed
  notes            TEXT,
  closed_by        UUID          NOT NULL REFERENCES users(id),
  closed_at        TIMESTAMPTZ   NOT NULL DEFAULT now(),
  UNIQUE (boutique_id, closing_date)
);

CREATE INDEX idx_cash_closings_boutique ON cash_closings (boutique_id, closing_date DESC);

-- ─────────────────────────────────────────────────────────────────────────────
-- RLS
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE cash_entries  ENABLE ROW LEVEL SECURITY;
ALTER TABLE cash_closings ENABLE ROW LEVEL SECURITY;

CREATE POLICY "cash_entries_tenant_select" ON cash_entries
  FOR SELECT USING (company_id = get_my_company_id());

CREATE POLICY "cash_entries_tenant_insert" ON cash_entries
  FOR INSERT WITH CHECK (company_id = get_my_company_id());

CREATE POLICY "cash_closings_tenant_select" ON cash_closings
  FOR SELECT USING (company_id = get_my_company_id());

CREATE POLICY "cash_closings_tenant_insert" ON cash_closings
  FOR INSERT WITH CHECK (company_id = get_my_company_id());
