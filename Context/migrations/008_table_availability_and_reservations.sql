-- Migration 008: Add UNAVAILABLE status + reservation metadata to Restaurant_Tables
--
-- Run this in the Supabase SQL Editor AFTER migration 007.
--
-- Changes:
--   1. Extends STATUS check constraint to include 'UNAVAILABLE'
--   2. Adds RESERVATION_NAME, RESERVATION_PAX, RESERVATION_NOTES columns
--      (RESERVED_SINCE already exists and is reused as reservation datetime)

-- ── Step 1: Drop old STATUS check constraint ──────────────────────────────────
ALTER TABLE public."Restaurant_Tables"
  DROP CONSTRAINT IF EXISTS restaurant_tables_status_check;

-- ── Step 2: Add extended STATUS check (includes UNAVAILABLE) ─────────────────
ALTER TABLE public."Restaurant_Tables"
  ADD CONSTRAINT restaurant_tables_status_check
  CHECK ("STATUS" = ANY (ARRAY[
    'AVAILABLE'::text,
    'RESERVED'::text,
    'OCCUPIED'::text,
    'HAS_REQUEST'::text,
    'UNAVAILABLE'::text
  ]));

-- ── Step 3: Add reservation metadata columns ─────────────────────────────────
-- Guest name for the reservation (e.g. "John Doe")
ALTER TABLE public."Restaurant_Tables"
  ADD COLUMN IF NOT EXISTS "RESERVATION_NAME" text NULL DEFAULT NULL;

-- Number of guests in the reservation (validated against GUEST_CAPACITY)
ALTER TABLE public."Restaurant_Tables"
  ADD COLUMN IF NOT EXISTS "RESERVATION_PAX" bigint NULL DEFAULT NULL;

-- Optional notes (e.g. "Birthday dinner, requires high chair")
ALTER TABLE public."Restaurant_Tables"
  ADD COLUMN IF NOT EXISTS "RESERVATION_NOTES" text NULL DEFAULT NULL;

-- Note: RESERVED_SINCE (timestamp) already exists and is reused to store
-- the reservation date+time. No new column needed for that.
