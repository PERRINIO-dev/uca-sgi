-- ─────────────────────────────────────────────────────────────────────────────
-- REFONTE RÔLES — Phase 1 : renommage + nouvelles tables
-- admin  → manager  (sémantique terrain)
-- vendor → seller   (cohérence + précision)
-- +6 nouveaux rôles : cashier, delivery, accountant, field_agent
-- ─────────────────────────────────────────────────────────────────────────────

-- ── 1. Renommer les rôles existants ──────────────────────────────────────────
UPDATE users      SET role                = 'manager' WHERE role                = 'admin';
UPDATE users      SET role                = 'seller'  WHERE role                = 'vendor';
UPDATE audit_logs SET user_role_snapshot  = 'manager' WHERE user_role_snapshot  = 'admin';
UPDATE audit_logs SET user_role_snapshot  = 'seller'  WHERE user_role_snapshot  = 'vendor';

-- ── 2. Table d'assignation boutiques pour les managers ──────────────────────
-- Un manager peut être assigné à plusieurs boutiques.
-- L'ancienne colonne users.boutique_id reste pour compatibilité (boutique principale).
CREATE TABLE IF NOT EXISTS user_boutique_assignments (
  user_id     UUID NOT NULL REFERENCES users(id)     ON DELETE CASCADE,
  boutique_id UUID NOT NULL REFERENCES boutiques(id) ON DELETE CASCADE,
  company_id  UUID NOT NULL REFERENCES companies(id) ON DELETE CASCADE,
  assigned_at TIMESTAMPTZ NOT NULL DEFAULT now(),
  PRIMARY KEY (user_id, boutique_id)
);

ALTER TABLE user_boutique_assignments ENABLE ROW LEVEL SECURITY;

CREATE POLICY "uba_select" ON user_boutique_assignments FOR SELECT
  USING (company_id = get_my_company_id());

CREATE POLICY "uba_manage" ON user_boutique_assignments FOR ALL
  USING  (company_id = get_my_company_id() AND get_my_role() = 'owner')
  WITH CHECK (company_id = get_my_company_id() AND get_my_role() = 'owner');

-- Migrer les boutique_id existants des managers
INSERT INTO user_boutique_assignments (user_id, boutique_id, company_id)
SELECT id, boutique_id, company_id
FROM   users
WHERE  role = 'manager'
  AND  boutique_id IS NOT NULL
ON CONFLICT DO NOTHING;

-- ── 3. Colonne assigned_delivery_id sur orders ───────────────────────────────
ALTER TABLE orders
  ADD COLUMN IF NOT EXISTS assigned_delivery_id UUID REFERENCES users(id);

CREATE INDEX IF NOT EXISTS orders_delivery_idx
  ON orders (assigned_delivery_id, company_id)
  WHERE assigned_delivery_id IS NOT NULL;

-- ── 4. Mettre à jour la fonction get_my_boutique_ids() ──────────────────────
-- Utilisée dans les policies RLS pour les managers multi-boutiques.
CREATE OR REPLACE FUNCTION get_my_boutique_ids()
RETURNS UUID[]
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT ARRAY(
    SELECT DISTINCT boutique_id
    FROM   user_boutique_assignments
    WHERE  user_id = auth.uid()
    UNION
    SELECT boutique_id
    FROM   users
    WHERE  id = auth.uid()
      AND  boutique_id IS NOT NULL
  );
$$;

GRANT EXECUTE ON FUNCTION get_my_boutique_ids() TO authenticated;
