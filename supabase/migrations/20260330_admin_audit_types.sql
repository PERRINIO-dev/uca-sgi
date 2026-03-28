-- ═══════════════════════════════════════════════════════════════════════════════
-- UCA SGI — Platform admin audit action types
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'PLATFORM_USER_SUSPENDED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'PLATFORM_USER_REACTIVATED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'PLATFORM_USER_PASSWORD_RESET';

COMMIT;
