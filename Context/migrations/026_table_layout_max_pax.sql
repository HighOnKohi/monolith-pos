-- Migration 026: Table Layout Max Pax and Table Capacity
--
-- Adds:
--   1. MAX_PAX column to tables."Table_Layout_Presets" (required positive integer constraint)
--   2. TABLE_CAPACITY column to tables."Table_Layout_Info" (stores configured base capacity)
--   3. Backfill existing presets without MAX_PAX to default to 50 pax.
--

-- ── Step 1: Add MAX_PAX to Table_Layout_Presets ──────────────────────────────
ALTER TABLE tables."Table_Layout_Presets"
  ADD COLUMN IF NOT EXISTS "MAX_PAX" bigint NULL;

-- Add check constraint for positive pax if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_table_layout_presets_max_pax'
  ) THEN
    ALTER TABLE tables."Table_Layout_Presets"
      ADD CONSTRAINT check_table_layout_presets_max_pax CHECK ("MAX_PAX" IS NULL OR "MAX_PAX" > 0);
  END IF;
END
$$;

-- Backfill existing presets with 50 pax if null
UPDATE tables."Table_Layout_Presets"
SET "MAX_PAX" = 50
WHERE "MAX_PAX" IS NULL;

-- ── Step 2: Add TABLE_CAPACITY to Table_Layout_Info ──────────────────────────
ALTER TABLE tables."Table_Layout_Info"
  ADD COLUMN IF NOT EXISTS "TABLE_CAPACITY" bigint NULL;

-- Add check constraint for positive capacity if not already present
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'check_table_layout_info_capacity'
  ) THEN
    ALTER TABLE tables."Table_Layout_Info"
      ADD CONSTRAINT check_table_layout_info_capacity CHECK ("TABLE_CAPACITY" IS NULL OR "TABLE_CAPACITY" > 0);
  END IF;
END
$$;
