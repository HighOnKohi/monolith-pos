-- Migration 029: Menu Catalog & Presets with ITEM_IDS Array
-- 1. Adds ITEM_IDS array column to Menu_Presets
-- 2. Preserves all original preset item allocations
-- 3. Removes PRESET_ID from Menu_Items so items are completely standalone in the master catalog

-- 1. Add ITEM_IDS column to Menu_Presets
ALTER TABLE menu."Menu_Presets" 
ADD COLUMN IF NOT EXISTS "ITEM_IDS" BIGINT[] NOT NULL DEFAULT '{}'::bigint[];

-- 2. Populate ITEM_IDS on Menu_Presets preserving the exact original presets:
UPDATE menu."Menu_Presets"
SET "ITEM_IDS" = ARRAY[5, 6, 7, 8]::bigint[]
WHERE "PRESET_ID" = 1;

UPDATE menu."Menu_Presets"
SET "ITEM_IDS" = ARRAY[10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 33, 34]::bigint[]
WHERE "PRESET_ID" = 2;

UPDATE menu."Menu_Presets"
SET "ITEM_IDS" = ARRAY[27, 28, 29]::bigint[]
WHERE "PRESET_ID" = 5;

UPDATE menu."Menu_Presets"
SET "ITEM_IDS" = '{}'::bigint[]
WHERE "PRESET_ID" = 6;

UPDATE menu."Menu_Presets"
SET "ITEM_IDS" = ARRAY[32]::bigint[]
WHERE "PRESET_ID" = 7;

-- Dynamic fallback for any other presets
UPDATE menu."Menu_Presets" p
SET "ITEM_IDS" = COALESCE(
    (
        SELECT ARRAY_AGG(i."ITEM_ID" ORDER BY i."ITEM_ID")
        FROM menu."Menu_Items" i
        WHERE i."PRESET_ID" = p."PRESET_ID"
    ),
    '{}'::bigint[]
)
WHERE "ITEM_IDS" = '{}'::bigint[] OR "ITEM_IDS" IS NULL;

-- 3. Drop PRESET_ID column from Menu_Items (decouples items completely from presets)
ALTER TABLE menu."Menu_Items" 
DROP COLUMN IF EXISTS "PRESET_ID";

-- 4. Clean up any junction table if created
DROP TABLE IF EXISTS menu."Preset_Items" CASCADE;
