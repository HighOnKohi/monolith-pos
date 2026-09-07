-- Migration 007: Add MERGE_GROUP_ID to Restaurant_Tables

-- A NULL value means the table is not merged.
-- A non-NULL value points to the TABLE_ID of the primary/anchor table.

-- Step 1: Add the nullable column
ALTER TABLE public."Restaurant_Tables"
ADD COLUMN IF NOT EXISTS "MERGE_GROUP_ID" bigint NULL DEFAULT NULL;


-- Step 2: Add the foreign key only if it does not already exist.
-- PostgreSQL does not support:
-- ADD CONSTRAINT IF NOT EXISTS
--
-- Therefore, check pg_constraint first.

DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'restaurant_tables_merge_group_fkey'
          AND conrelid = 'public."Restaurant_Tables"'::regclass
    ) THEN
        ALTER TABLE public."Restaurant_Tables"
        ADD CONSTRAINT restaurant_tables_merge_group_fkey
        FOREIGN KEY ("MERGE_GROUP_ID")
        REFERENCES public."Restaurant_Tables" ("TABLE_ID")
        ON DELETE SET NULL;
    END IF;
END
$$;