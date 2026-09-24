-- Migration 028: Enforce unique TABLE_NUM on Restaurant_Tables and unique (LAYOUT_PRESET_ID, TABLE_NUM) on Table_Layout_Info
-- Description:
--   1. De-duplicates any remaining duplicate TABLE_NUM rows on tables."Restaurant_Tables".
--   2. Adds unique constraint on tables."Restaurant_Tables" ("TABLE_NUM").
--   3. Adds unique constraint on tables."Table_Layout_Info" ("LAYOUT_PRESET_ID", "TABLE_NUM").

DO $$
BEGIN
    -- 1. Deduplicate tables."Restaurant_Tables" if any duplicate TABLE_NUM exists
    DELETE FROM tables."Restaurant_Tables" a
    USING tables."Restaurant_Tables" b
    WHERE a."TABLE_NUM" = b."TABLE_NUM"
      AND a."TABLE_ID" > b."TABLE_ID";

    -- 2. Add Unique Constraint on tables."Restaurant_Tables"("TABLE_NUM")
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'restaurant_tables_table_num_unique'
          AND conrelid = 'tables."Restaurant_Tables"'::regclass
    ) THEN
        ALTER TABLE tables."Restaurant_Tables"
        ADD CONSTRAINT "restaurant_tables_table_num_unique" UNIQUE ("TABLE_NUM");
    END IF;

    -- 3. Add Unique Constraint on tables."Table_Layout_Info"("LAYOUT_PRESET_ID", "TABLE_NUM")
    IF NOT EXISTS (
        SELECT 1 FROM pg_constraint
        WHERE conname = 'table_layout_info_preset_table_num_unique'
          AND conrelid = 'tables."Table_Layout_Info"'::regclass
    ) THEN
        ALTER TABLE tables."Table_Layout_Info"
        ADD CONSTRAINT "table_layout_info_preset_table_num_unique" UNIQUE ("LAYOUT_PRESET_ID", "TABLE_NUM");
    END IF;
END $$;
