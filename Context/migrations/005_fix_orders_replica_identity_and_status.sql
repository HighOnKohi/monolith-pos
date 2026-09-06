-- ==============================================================================
-- Migration 005: Fix Restaurant_Orders Replica Identity & Status Check
--
-- Why is this required?
-- In Supabase/PostgreSQL, when a table is added to the "supabase_realtime" publication,
-- PostgreSQL requires REPLICA IDENTITY FULL to allow UPDATE and DELETE statements.
-- Without this, PostgreSQL throws Error 55000:
--   "cannot update table 'Restaurant_Orders' because it does not have a replica identity and publishes updates"
--
-- Note on ERROR 42P01 (relation "public.Restaurant_Orders" does not exist):
-- This error happens if:
--   1. Double quotes were wrapped around the schema and table together ("public.Restaurant_Orders"),
--   2. The table name was created with different casing (e.g. lowercase restaurant_orders), or
--   3. The SQL Editor is connected to a different Supabase project.
--
-- This script uses dynamic SQL (DO $$) to detect the exact table casing from pg_tables,
-- ensuring it runs cleanly regardless of whether the table is "Restaurant_Orders" or restaurant_orders.
--
-- INSTRUCTIONS:
-- 1. Verify you are in project "jskcxvgazgzrafquutms" in the Supabase Dashboard
-- 2. Open "SQL Editor" -> "+ New Query"
-- 3. Paste this entire script and click "Run" (or Ctrl+Enter)
-- ==============================================================================

DO $$
DECLARE
    t_orders text;
    t_items text;
    s_orders text := 'public';
    s_items text := 'public';
BEGIN
    -- 1. Dynamically locate the orders table regardless of casing
    SELECT schemaname, quote_ident(tablename) 
    INTO s_orders, t_orders
    FROM pg_tables 
    WHERE tablename ILIKE 'restaurant_orders'
    ORDER BY (schemaname = 'public') DESC
    LIMIT 1;

    -- Fallback: search for any table containing 'orders' if 'restaurant_orders' is not found
    IF t_orders IS NULL THEN
        SELECT schemaname, quote_ident(tablename) 
        INTO s_orders, t_orders
        FROM pg_tables 
        WHERE tablename ILIKE '%orders%'
          AND schemaname NOT IN ('pg_catalog', 'information_schema')
        ORDER BY (schemaname = 'public') DESC
        LIMIT 1;
    END IF;

    -- 2. Dynamically locate the order_items table regardless of casing
    SELECT schemaname, quote_ident(tablename) 
    INTO s_items, t_items
    FROM pg_tables 
    WHERE tablename ILIKE 'order_items'
    ORDER BY (schemaname = 'public') DESC
    LIMIT 1;

    -- 3. Verify that the orders table was found
    IF t_orders IS NULL THEN
        RAISE EXCEPTION 'Could not find Restaurant_Orders table! Available tables in this database: %',
            (SELECT COALESCE(string_agg(schemaname || '.' || tablename, ', '), 'NONE') 
             FROM pg_tables 
             WHERE schemaname NOT IN ('pg_catalog', 'information_schema'));
    END IF;

    -- 4. Enable REPLICA IDENTITY FULL so UPDATE and DELETE succeed with Realtime enabled
    EXECUTE 'ALTER TABLE ' || quote_ident(s_orders) || '.' || t_orders || ' REPLICA IDENTITY FULL;';
    RAISE NOTICE '1. Enabled REPLICA IDENTITY FULL on %.%', s_orders, t_orders;

    IF t_items IS NOT NULL THEN
        EXECUTE 'ALTER TABLE ' || quote_ident(s_items) || '.' || t_items || ' REPLICA IDENTITY FULL;';
        RAISE NOTICE '2. Enabled REPLICA IDENTITY FULL on %.%', s_items, t_items;
    END IF;

    -- 5. Drop legacy restrictive check constraints on ORDER_STATUS
    EXECUTE 'ALTER TABLE ' || quote_ident(s_orders) || '.' || t_orders || ' DROP CONSTRAINT IF EXISTS "Restaurant_Orders_ORDER_STATUS_check";';
    EXECUTE 'ALTER TABLE ' || quote_ident(s_orders) || '.' || t_orders || ' DROP CONSTRAINT IF EXISTS "restaurant_orders_order_status_check";';
    EXECUTE 'ALTER TABLE ' || quote_ident(s_orders) || '.' || t_orders || ' DROP CONSTRAINT IF EXISTS "restaurant_orders_status_check";';

    -- 6. Add comprehensive check constraint permitting all valid workflow statuses:
    --    REQUESTED, VERIFIED, PREPARING, READY, SERVED, CANCELLED, COMPLETED
    EXECUTE 'ALTER TABLE ' || quote_ident(s_orders) || '.' || t_orders || ' ADD CONSTRAINT "restaurant_orders_order_status_check" CHECK ("ORDER_STATUS" = ANY(ARRAY[''REQUESTED''::text, ''VERIFIED''::text, ''PREPARING''::text, ''READY''::text, ''SERVED''::text, ''CANCELLED''::text, ''COMPLETED''::text]));';
    RAISE NOTICE '3. Updated status check constraint on %.%', s_orders, t_orders;

    RAISE NOTICE 'Migration 005 completed successfully!';
END $$;

-- 7. Verification: Check replica identity status
SELECT 
    schemaname,
    tablename,
    CASE c.relreplident
        WHEN 'd' THEN 'default (primary key)'
        WHEN 'n' THEN 'nothing'
        WHEN 'f' THEN 'full (REPLICA IDENTITY FULL)'
        WHEN 'i' THEN 'index'
    END AS replica_identity
FROM pg_class c
JOIN pg_tables t ON t.tablename = c.relname
WHERE t.tablename ILIKE '%orders%'
  AND t.schemaname NOT IN ('pg_catalog', 'information_schema');

