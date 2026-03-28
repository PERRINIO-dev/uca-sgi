-- ═══════════════════════════════════════════════════════════════════════════════
-- UCA SGI — Platform Operator Account (company-less)
-- ═══════════════════════════════════════════════════════════════════════════════
--
-- Separates the platform operator from the UCA tenant:
--   • users.company_id becomes nullable — platform operator accounts have no company
--   • audit_logs.company_id becomes nullable — platform-level actions have no tenant
--   • Revokes is_platform_admin from the UCA owner — UCA is now a plain client tenant
--
-- After running this migration, create the platform operator account manually:
--   1. Supabase Dashboard → Authentication → Users → Add user
--      Email: <your email>, Password: <strong password>, Auto Confirm: ON
--   2. Copy the new user's UUID, then run:
--      INSERT INTO public.users (id, email, full_name, role, company_id, is_active, is_platform_admin)
--      VALUES ('<uuid>', '<email>', 'Administrateur Plateforme', 'owner', NULL, TRUE, TRUE);
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

-- ─────────────────────────────────────────────────────────────────────────────
-- 1. Allow company-less accounts (platform operator)
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE users      ALTER COLUMN company_id DROP NOT NULL;
ALTER TABLE audit_logs ALTER COLUMN company_id DROP NOT NULL;

-- ─────────────────────────────────────────────────────────────────────────────
-- 2. Revoke platform-admin from UCA owner — UCA is now a plain client tenant
-- ─────────────────────────────────────────────────────────────────────────────

UPDATE users
SET    is_platform_admin = FALSE
WHERE  role       = 'owner'
  AND  company_id = '00000000-0000-0000-0000-000000000001';

COMMIT;
