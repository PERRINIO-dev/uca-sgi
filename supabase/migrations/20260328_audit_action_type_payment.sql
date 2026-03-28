-- Add PAYMENT_RECORDED to the audit_action_type enum.
-- The action_type column on audit_logs is a strict PostgreSQL ENUM;
-- any value not listed here causes the insert to fail with error 22P02.
--
-- Run this in the Supabase SQL editor (one-time, no redeploy needed).

ALTER TYPE audit_action_type ADD VALUE IF NOT EXISTS 'PAYMENT_RECORDED';
