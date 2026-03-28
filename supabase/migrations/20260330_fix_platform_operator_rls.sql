-- ═══════════════════════════════════════════════════════════════════════════════
-- UCA SGI — Fix users SELECT RLS for platform operator
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Problem: the platform operator account has company_id = NULL.
-- The existing users_select policy uses `company_id = get_my_company_id()`.
-- When company_id IS NULL, get_my_company_id() returns NULL, and
-- NULL = NULL evaluates to FALSE in SQL — so the operator cannot read
-- their own profile row, causing an infinite redirect loop on login.
--
-- Fix: add `id = auth.uid()` so every authenticated user can always
-- read their own row regardless of company membership.
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

DROP POLICY IF EXISTS users_select ON users;
CREATE POLICY users_select ON users
  FOR SELECT TO authenticated
  USING (
    id = auth.uid()                    -- always read own row (covers company-less accounts)
    OR company_id = get_my_company_id() -- read all members of same company
  );

COMMIT;
