-- ═══════════════════════════════════════════════════════════════════════════════
-- UCA SGI — Platform Administration
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Adds a platform-admin tier that sits above individual companies:
--   • is_platform_admin BOOLEAN on users — grants cross-company management access
--   • is_active BOOLEAN on companies — allows suspending a tenant
--   • is_platform_admin() SECURITY DEFINER helper for RLS policies
--   • Updated companies RLS: platform admins can see and create all companies
--   • COMPANY_CREATED added to audit_action_type enum
--
-- The UCA owner (role = 'owner' in company 00000000-...-0001) is seeded as
-- the first platform admin automatically.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Extend users with platform-admin flag
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE users ADD COLUMN IF NOT EXISTS is_platform_admin BOOLEAN NOT NULL DEFAULT FALSE;

-- Seed: the UCA owner is the first platform admin
UPDATE users
SET    is_platform_admin = TRUE
WHERE  role       = 'owner'
  AND  company_id = '00000000-0000-0000-0000-000000000001';

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Add is_active to companies (tenant suspension support)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE companies ADD COLUMN IF NOT EXISTS is_active BOOLEAN NOT NULL DEFAULT TRUE;

-- ─────────────────────────────────────────────────────────────────────────────
-- 3. SECURITY DEFINER helper — used in RLS USING clauses
-- ─────────────────────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION is_platform_admin()
RETURNS BOOLEAN
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT COALESCE(
    (SELECT is_platform_admin FROM users WHERE id = auth.uid()),
    FALSE
  );
$$;

GRANT EXECUTE ON FUNCTION is_platform_admin() TO authenticated;

-- ─────────────────────────────────────────────────────────────────────────────
-- 4. Update companies RLS policies
-- ─────────────────────────────────────────────────────────────────────────────

-- SELECT: own company OR platform admin sees all
DROP POLICY IF EXISTS companies_select ON companies;
CREATE POLICY companies_select ON companies
  FOR SELECT TO authenticated
  USING (
    id = get_my_company_id()
    OR is_platform_admin()
  );

-- INSERT: only platform admins create new companies
-- (the action also uses the service-role client, but defense-in-depth)
DROP POLICY IF EXISTS companies_insert ON companies;
CREATE POLICY companies_insert ON companies
  FOR INSERT TO authenticated
  WITH CHECK (is_platform_admin());

-- UPDATE: platform admins can toggle is_active etc.
DROP POLICY IF EXISTS companies_update ON companies;
CREATE POLICY companies_update ON companies
  FOR UPDATE TO authenticated
  USING    (is_platform_admin())
  WITH CHECK (is_platform_admin());

-- ─────────────────────────────────────────────────────────────────────────────
-- 5. Add COMPANY_CREATED to the audit_action_type enum
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'COMPANY_CREATED';

COMMIT;
