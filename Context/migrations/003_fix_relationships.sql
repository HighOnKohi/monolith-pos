-- ============================================================
-- Migration 003: Fix Database Relationships, Foreign Keys & Cascades
-- Run this in the Supabase Dashboard -> SQL Editor
-- This script dynamically detects table casing to prevent "relation does not exist" errors.
-- ============================================================

DO $$
DECLARE
    t_order_items text;
    t_menu_items text;
    t_restaurant_orders text;
    t_restaurant_tables text;
    t_discounts text;
    t_bill_requests text;
    t_menu_categories text;
BEGIN
    -- 1. Locate exact table names dynamically from PostgreSQL catalog
    SELECT quote_ident(tablename) INTO t_order_items FROM pg_tables WHERE schemaname = 'public' AND tablename ILIKE 'order_items';
    SELECT quote_ident(tablename) INTO t_menu_items FROM pg_tables WHERE schemaname = 'public' AND tablename ILIKE 'menu_items';
    SELECT quote_ident(tablename) INTO t_restaurant_orders FROM pg_tables WHERE schemaname = 'public' AND tablename ILIKE 'restaurant_orders';
    SELECT quote_ident(tablename) INTO t_restaurant_tables FROM pg_tables WHERE schemaname = 'public' AND tablename ILIKE 'restaurant_tables';
    SELECT quote_ident(tablename) INTO t_discounts FROM pg_tables WHERE schemaname = 'public' AND tablename ILIKE 'discounts';
    SELECT quote_ident(tablename) INTO t_bill_requests FROM pg_tables WHERE schemaname = 'public' AND tablename ILIKE 'bill_requests';
    SELECT quote_ident(tablename) INTO t_menu_categories FROM pg_tables WHERE schemaname = 'public' AND tablename ILIKE 'menu_categories';

    -- Verification check
    IF t_order_items IS NULL THEN
        RAISE EXCEPTION 'Order_Items table was not found in schema public! Found tables: %',
            (SELECT COALESCE(string_agg(tablename, ', '), 'NONE') FROM pg_tables WHERE schemaname = 'public');
    END IF;

    -- 2. Ensure Order_Items columns exist (QUANTITY, NOTES)
    EXECUTE 'ALTER TABLE public.' || t_order_items || ' ADD COLUMN IF NOT EXISTS "QUANTITY" integer DEFAULT 1';
    EXECUTE 'ALTER TABLE public.' || t_order_items || ' ADD COLUMN IF NOT EXISTS "NOTES" text';
    RAISE NOTICE '1. Updated % (added QUANTITY and NOTES columns)', t_order_items;

    -- 3. Ensure Menu_Items columns exist (ITEM_IMAGE)
    IF t_menu_items IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.' || t_menu_items || ' ADD COLUMN IF NOT EXISTS "ITEM_IMAGE" text';
        RAISE NOTICE '2. Updated % (added ITEM_IMAGE column)', t_menu_items;
    END IF;

    -- 4. Make ORDER_ITEMS_ID auto-generate on Restaurant_Orders
    IF t_restaurant_orders IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.' || t_restaurant_orders || ' ALTER COLUMN "ORDER_ITEMS_ID" SET DEFAULT (extract(epoch from clock_timestamp()) * 1000)::bigint';
        RAISE NOTICE '3. Updated % (ORDER_ITEMS_ID auto-generates timestamp)', t_restaurant_orders;
    END IF;

    -- 5. Fix Bill_Requests foreign key relationships
    IF t_bill_requests IS NOT NULL AND t_restaurant_tables IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.' || t_bill_requests || ' DROP CONSTRAINT IF EXISTS "bill_requests_table_id_fkey", DROP CONSTRAINT IF EXISTS "Bill_Requests_TABLE_ID_fkey"';
        EXECUTE 'ALTER TABLE public.' || t_bill_requests || ' ADD CONSTRAINT "bill_requests_table_id_fkey" FOREIGN KEY ("TABLE_ID") REFERENCES public.' || t_restaurant_tables || '("TABLE_ID") ON DELETE CASCADE';
        RAISE NOTICE '4. Fixed relationship: % -> % (CASCADE on table delete)', t_bill_requests, t_restaurant_tables;
    END IF;

    IF t_bill_requests IS NOT NULL AND t_restaurant_orders IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.' || t_bill_requests || ' DROP CONSTRAINT IF EXISTS "bill_requests_order_id_fkey", DROP CONSTRAINT IF EXISTS "Bill_Requests_ORDER_ID_fkey"';
        EXECUTE 'ALTER TABLE public.' || t_bill_requests || ' ADD CONSTRAINT "bill_requests_order_id_fkey" FOREIGN KEY ("ORDER_ID") REFERENCES public.' || t_restaurant_orders || '("ORDER_ID") ON DELETE SET NULL';
        RAISE NOTICE '5. Fixed relationship: % -> % (SET NULL on order delete)', t_bill_requests, t_restaurant_orders;
    END IF;

    -- 6. Fix Order_Items foreign key with CASCADE on order delete
    IF t_order_items IS NOT NULL AND t_restaurant_orders IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.' || t_order_items || ' DROP CONSTRAINT IF EXISTS "Order_Items_ORDER_ID_fkey"';
        EXECUTE 'ALTER TABLE public.' || t_order_items || ' ADD CONSTRAINT "Order_Items_ORDER_ID_fkey" FOREIGN KEY ("ORDER_ID") REFERENCES public.' || t_restaurant_orders || '("ORDER_ID") ON DELETE CASCADE';
        RAISE NOTICE '6. Fixed relationship: % -> % (CASCADE on order delete)', t_order_items, t_restaurant_orders;
    END IF;

    -- 7. Fix Discounts foreign keys with CASCADE
    IF t_discounts IS NOT NULL AND t_restaurant_orders IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.' || t_discounts || ' DROP CONSTRAINT IF EXISTS "DISCOUNTS_ORDER_ID_fkey"';
        EXECUTE 'ALTER TABLE public.' || t_discounts || ' ADD CONSTRAINT "DISCOUNTS_ORDER_ID_fkey" FOREIGN KEY ("ORDER_ID") REFERENCES public.' || t_restaurant_orders || '("ORDER_ID") ON DELETE CASCADE';
        RAISE NOTICE '7. Fixed relationship: % -> % (CASCADE on order delete)', t_discounts, t_restaurant_orders;
    END IF;

    IF t_discounts IS NOT NULL AND t_order_items IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.' || t_discounts || ' DROP CONSTRAINT IF EXISTS "DISCOUNTS_ORDER_ITEM_ID_fkey"';
        EXECUTE 'ALTER TABLE public.' || t_discounts || ' ADD CONSTRAINT "DISCOUNTS_ORDER_ITEM_ID_fkey" FOREIGN KEY ("ORDER_ITEM_ID") REFERENCES public.' || t_order_items || '("ORDER_ITEM_ID") ON DELETE CASCADE';
        RAISE NOTICE '8. Fixed relationship: % -> % (CASCADE on order item delete)', t_discounts, t_order_items;
    END IF;

    -- 8. Fix Restaurant_Orders to Restaurant_Tables relationship with CASCADE
    IF t_restaurant_orders IS NOT NULL AND t_restaurant_tables IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.' || t_restaurant_orders || ' DROP CONSTRAINT IF EXISTS "Customer_Orders_TABLE_ID_fkey", DROP CONSTRAINT IF EXISTS "Restaurant_Orders_TABLE_ID_fkey"';
        EXECUTE 'ALTER TABLE public.' || t_restaurant_orders || ' ADD CONSTRAINT "Restaurant_Orders_TABLE_ID_fkey" FOREIGN KEY ("TABLE_ID") REFERENCES public.' || t_restaurant_tables || '("TABLE_ID") ON DELETE CASCADE';
        RAISE NOTICE '9. Fixed relationship: % -> % (CASCADE on table delete)', t_restaurant_orders, t_restaurant_tables;
    END IF;

    -- 9. Fix Order Status check constraint to include SERVED
    IF t_restaurant_orders IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.' || t_restaurant_orders || ' DROP CONSTRAINT IF EXISTS "restaurant_orders_status_check", DROP CONSTRAINT IF EXISTS "restaurant_orders_order_status_check"';
        EXECUTE 'ALTER TABLE public.' || t_restaurant_orders || ' ADD CONSTRAINT "restaurant_orders_status_check" CHECK ("ORDER_STATUS" = ANY(ARRAY[''REQUESTED''::text, ''VERIFIED''::text, ''PREPARING''::text, ''READY''::text, ''SERVED''::text]))';
        RAISE NOTICE '10. Updated % ORDER_STATUS check to include SERVED', t_restaurant_orders;
    END IF;

    RAISE NOTICE 'All database relationships successfully configured!';
END $$;
