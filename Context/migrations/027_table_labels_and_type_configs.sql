-- ==============================================================================
-- Migration 027: Table Labels, Table Type Configs, and Layout Protection
--
-- Adds:
--   1. tables."Table_Labels" — Hierarchical label definitions (VIP, Gold, etc.)
--   2. tables."Table_Type_Configs" — Configurable table type capacity & count limits
--   3. LABEL_ID column on tables."Restaurant_Tables" (FK → Table_Labels)
--   4. LABEL_ID column on tables."Table_Layout_Info" (FK → Table_Labels, for preset snapshots)
--   5. IS_PROTECTED column on tables."Table_Layout_Presets" (marks Default Layout as undeletable)
--
-- Run in the Supabase SQL Editor AFTER migration 026.
-- ==============================================================================

-- ── Step 1: Create Table_Labels ──────────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tables."Table_Labels" (
  "LABEL_ID"    bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "NAME"        text    NOT NULL,
  "COLOR"       text    NOT NULL DEFAULT '#6B7280',
  "PRIORITY"    integer NOT NULL DEFAULT 100,
  "IS_ACTIVE"   boolean NOT NULL DEFAULT true,
  "CREATED_AT"  timestamptz NOT NULL DEFAULT now(),
  "UPDATED_AT"  timestamptz NOT NULL DEFAULT now()
);

-- Index for priority ordering
CREATE INDEX IF NOT EXISTS idx_table_labels_priority
  ON tables."Table_Labels" ("PRIORITY" ASC, "LABEL_ID" ASC);

-- RLS
ALTER TABLE tables."Table_Labels" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'Table_Labels'
      AND policyname = 'Allow all for table labels'
  ) THEN
    CREATE POLICY "Allow all for table labels"
      ON tables."Table_Labels"
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'tables'
      AND tablename = 'Table_Labels'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tables."Table_Labels";
  END IF;
END
$$;

-- Seed 5 default labels
INSERT INTO tables."Table_Labels" ("NAME", "COLOR", "PRIORITY", "IS_ACTIVE")
VALUES
  ('VIP',          '#8B0000', 1, true),
  ('Gold',         '#DAA520', 2, true),
  ('Priority',     '#1E90FF', 3, true),
  ('Regular',      '#6B7280', 4, true),
  ('Low Priority', '#A3A3A3', 5, true)
ON CONFLICT DO NOTHING;


-- ── Step 2: Create Table_Type_Configs ────────────────────────────────────────

CREATE TABLE IF NOT EXISTS tables."Table_Type_Configs" (
  "TYPE_CONFIG_ID" bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  "TABLE_TYPE"     integer NOT NULL UNIQUE,
  "NAME"           text    NOT NULL,
  "CAPACITY"       integer NOT NULL DEFAULT 4 CHECK ("CAPACITY" > 0),
  "MAX_COUNT"      integer NULL CHECK ("MAX_COUNT" IS NULL OR "MAX_COUNT" >= 0),
  "IS_ACTIVE"      boolean NOT NULL DEFAULT true,
  "CREATED_AT"     timestamptz NOT NULL DEFAULT now(),
  "UPDATED_AT"     timestamptz NOT NULL DEFAULT now()
);

-- RLS
ALTER TABLE tables."Table_Type_Configs" ENABLE ROW LEVEL SECURITY;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE tablename = 'Table_Type_Configs'
      AND policyname = 'Allow all for table type configs'
  ) THEN
    CREATE POLICY "Allow all for table type configs"
      ON tables."Table_Type_Configs"
      FOR ALL
      USING (true)
      WITH CHECK (true);
  END IF;
END
$$;

-- Realtime
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_publication_tables
    WHERE pubname = 'supabase_realtime'
      AND schemaname = 'tables'
      AND tablename = 'Table_Type_Configs'
  ) THEN
    ALTER PUBLICATION supabase_realtime ADD TABLE tables."Table_Type_Configs";
  END IF;
END
$$;

-- Seed from existing TABLE_TYPES constant
INSERT INTO tables."Table_Type_Configs" ("TABLE_TYPE", "NAME", "CAPACITY", "MAX_COUNT", "IS_ACTIVE")
VALUES
  (1, 'Square Table',                4, NULL, true),
  (2, 'Rectangle Table (Horizontal)', 8, NULL, true),
  (3, 'Small Circle Table',           4, NULL, true),
  (4, 'Big Circle Table',             6, NULL, true),
  (5, 'Rectangle Table (Vertical)',   8, NULL, true)
ON CONFLICT ("TABLE_TYPE") DO NOTHING;


-- ── Step 3: Add LABEL_ID to Restaurant_Tables ────────────────────────────────

ALTER TABLE tables."Restaurant_Tables"
  ADD COLUMN IF NOT EXISTS "LABEL_ID" bigint NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'restaurant_tables_label_id_fkey'
  ) THEN
    ALTER TABLE tables."Restaurant_Tables"
      ADD CONSTRAINT restaurant_tables_label_id_fkey
      FOREIGN KEY ("LABEL_ID")
      REFERENCES tables."Table_Labels"("LABEL_ID")
      ON DELETE SET NULL;
  END IF;
END
$$;

CREATE INDEX IF NOT EXISTS idx_restaurant_tables_label_id
  ON tables."Restaurant_Tables" ("LABEL_ID");


-- ── Step 4: Add LABEL_ID to Table_Layout_Info ────────────────────────────────

ALTER TABLE tables."Table_Layout_Info"
  ADD COLUMN IF NOT EXISTS "LABEL_ID" bigint NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint
    WHERE conname = 'table_layout_info_label_id_fkey'
  ) THEN
    ALTER TABLE tables."Table_Layout_Info"
      ADD CONSTRAINT table_layout_info_label_id_fkey
      FOREIGN KEY ("LABEL_ID")
      REFERENCES tables."Table_Labels"("LABEL_ID")
      ON DELETE SET NULL;
  END IF;
END
$$;


-- ── Step 5: Add IS_PROTECTED to Table_Layout_Presets ─────────────────────────

ALTER TABLE tables."Table_Layout_Presets"
  ADD COLUMN IF NOT EXISTS "IS_PROTECTED" boolean NOT NULL DEFAULT false;

-- Mark the first default preset as protected (if one exists)
UPDATE tables."Table_Layout_Presets"
SET "IS_PROTECTED" = true
WHERE "IS_DEFAULT" = true
  AND "IS_PROTECTED" = false;


-- ── Step 6: Table Grants & Permissions ───────────────────────────────────────

GRANT USAGE ON SCHEMA tables TO anon, authenticated, service_role;
GRANT ALL ON TABLE tables."Table_Labels" TO anon, authenticated, service_role;
GRANT ALL ON TABLE tables."Table_Type_Configs" TO anon, authenticated, service_role;
GRANT ALL ON ALL SEQUENCES IN SCHEMA tables TO anon, authenticated, service_role;

