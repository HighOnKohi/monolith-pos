-- Migration 018: Table Layout Presets + Layout Position Columns
--
-- Adds:
--   1. Table_Layout_Presets — stores named floor-plan arrangements
--   2. LAYOUT_X / LAYOUT_Y on Restaurant_Tables — active layout positions (block coords)
--
-- Run in the Supabase SQL Editor AFTER migration 017.

-- ── Step 1: Create Table_Layout_Presets ───────────────────────────────────────

CREATE TABLE IF NOT EXISTS public."Table_Layout_Presets" (
  "PRESET_ID"            bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "PRESET_NAME"          text    NOT NULL,
  "DESCRIPTION"          text    NULL DEFAULT NULL,
  "FLOOR_WIDTH_BLOCKS"   integer NOT NULL DEFAULT 20,
  "FLOOR_HEIGHT_BLOCKS"  integer NOT NULL DEFAULT 16,
  "TABLE_SIZE_BLOCKS"    integer NOT NULL DEFAULT 2,
  "TABLE_SPACING_BLOCKS" integer NOT NULL DEFAULT 1,
  "SNAP_TO_GRID"         boolean NOT NULL DEFAULT true,
  "LAYOUT_DATA"          jsonb   NOT NULL DEFAULT '[]'::jsonb,
  "MERGE_GROUPS"         jsonb   NULL     DEFAULT '[]'::jsonb,
  "IS_ACTIVE"            boolean NOT NULL DEFAULT false,
  "CREATED_AT"           timestamptz NOT NULL DEFAULT now(),
  "UPDATED_AT"           timestamptz NOT NULL DEFAULT now(),
  "CREATED_BY"           text    NULL DEFAULT NULL
);

-- Index for quick active-preset lookup
CREATE INDEX IF NOT EXISTS idx_layout_presets_active
  ON public."Table_Layout_Presets" ("IS_ACTIVE")
  WHERE "IS_ACTIVE" = true;

-- ── Step 2: Add layout position columns to Restaurant_Tables ─────────────────

ALTER TABLE public."Restaurant_Tables"
  ADD COLUMN IF NOT EXISTS "LAYOUT_X" integer NULL DEFAULT NULL;

ALTER TABLE public."Restaurant_Tables"
  ADD COLUMN IF NOT EXISTS "LAYOUT_Y" integer NULL DEFAULT NULL;

-- ── Step 3: Enable Realtime for the new table ────────────────────────────────

ALTER PUBLICATION supabase_realtime ADD TABLE public."Table_Layout_Presets";

-- ── Step 4: RLS (permissive for authenticated users, matching project pattern) ─

ALTER TABLE public."Table_Layout_Presets" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'Table_Layout_Presets'
      AND policyname = 'Allow all for authenticated users'
  ) THEN
    CREATE POLICY "Allow all for authenticated users"
      ON public."Table_Layout_Presets"
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;
