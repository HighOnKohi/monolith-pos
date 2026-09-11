-- Migration 019: Link Events & Table Layouts, and Persistent Custom Table Templates
--
-- Adds:
--   1. PRESET_ID on Restaurant_Events (links an event to a Table_Layout_Presets row)
--   2. EVENT_ID on Table_Layout_Presets (links a preset to a Restaurant_Events row)
--   3. Custom_Table_Templates — stores custom table definitions permanently
--
-- Run in the Supabase SQL Editor AFTER migration 018.

-- ── Step 1: Link Restaurant_Events and Table_Layout_Presets ──────────────────

ALTER TABLE public."Restaurant_Events"
  ADD COLUMN IF NOT EXISTS "PRESET_ID" bigint NULL DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_restaurant_events_preset'
  ) THEN
    ALTER TABLE public."Restaurant_Events"
      ADD CONSTRAINT fk_restaurant_events_preset
      FOREIGN KEY ("PRESET_ID")
      REFERENCES public."Table_Layout_Presets"("PRESET_ID")
      ON DELETE SET NULL;
  END IF;
END
$$;

ALTER TABLE public."Table_Layout_Presets"
  ADD COLUMN IF NOT EXISTS "EVENT_ID" bigint NULL DEFAULT NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
    WHERE constraint_name = 'fk_table_layout_presets_event'
  ) THEN
    ALTER TABLE public."Table_Layout_Presets"
      ADD CONSTRAINT fk_table_layout_presets_event
      FOREIGN KEY ("EVENT_ID")
      REFERENCES public."Restaurant_Events"("EVENT_ID")
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_events_preset_id
  ON public."Restaurant_Events" ("PRESET_ID");

CREATE INDEX IF NOT EXISTS idx_presets_event_id
  ON public."Table_Layout_Presets" ("EVENT_ID");

-- ── Step 2: Create Custom_Table_Templates ────────────────────────────────────

CREATE TABLE IF NOT EXISTS public."Custom_Table_Templates" (
  "TEMPLATE_ID"   text PRIMARY KEY,
  "LABEL"         text NOT NULL,
  "SEATS"         integer NOT NULL CHECK ("SEATS" > 0),
  "WIDTH_BLOCKS"  integer NOT NULL DEFAULT 2,
  "HEIGHT_BLOCKS" integer NOT NULL DEFAULT 2,
  "IS_CUSTOM"     boolean NOT NULL DEFAULT true,
  "CREATED_AT"    timestamptz NOT NULL DEFAULT now(),
  "UPDATED_AT"    timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public."Custom_Table_Templates" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'Custom_Table_Templates'
      AND policyname = 'Allow all for custom table templates'
  ) THEN
    CREATE POLICY "Allow all for custom table templates"
      ON public."Custom_Table_Templates"
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

ALTER PUBLICATION supabase_realtime ADD TABLE public."Custom_Table_Templates";
