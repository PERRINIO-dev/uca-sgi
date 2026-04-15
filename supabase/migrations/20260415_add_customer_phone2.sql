-- ─────────────────────────────────────────────────────────────────────────────
-- Migration: 20260415_add_customer_phone2
--
-- Add an optional second phone number on sales / quotes.
-- Used when the contact person has a secondary number (e.g., WhatsApp vs voice).
-- The column is nullable — existing rows are not affected.
-- ─────────────────────────────────────────────────────────────────────────────

ALTER TABLE sales ADD COLUMN IF NOT EXISTS customer_phone2 TEXT;
