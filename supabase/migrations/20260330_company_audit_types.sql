-- ═══════════════════════════════════════════════════════════════════════════════
-- UCA SGI — Platform-level company audit action types
-- Replaces BOUTIQUE_ACTIVATED / BOUTIQUE_DEACTIVATED for company-level actions
-- performed by the platform admin (not tenant boutique operations).
-- ═══════════════════════════════════════════════════════════════════════════════

BEGIN;

ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'COMPANY_ACTIVATED';
ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'COMPANY_DEACTIVATED';

COMMIT;
