-- ============================================================
-- Migration 004: Allow CANCELLED Status in Restaurant_Orders
-- Run this in the Supabase Dashboard -> SQL Editor
-- ============================================================

DO $$
DECLARE
    t_restaurant_orders text;
BEGIN
    SELECT quote_ident(tablename) INTO t_restaurant_orders 
    FROM pg_tables 
    WHERE schemaname = 'public' AND tablename ILIKE 'restaurant_orders';

    IF t_restaurant_orders IS NOT NULL THEN
        EXECUTE 'ALTER TABLE public.' || t_restaurant_orders || ' DROP CONSTRAINT IF EXISTS "restaurant_orders_status_check"';
        EXECUTE 'ALTER TABLE public.' || t_restaurant_orders || ' DROP CONSTRAINT IF EXISTS "restaurant_orders_order_status_check"';
        
        EXECUTE 'ALTER TABLE public.' || t_restaurant_orders || ' ADD CONSTRAINT "restaurant_orders_status_check" CHECK ("ORDER_STATUS" = ANY(ARRAY[''REQUESTED''::text, ''VERIFIED''::text, ''PREPARING''::text, ''READY''::text, ''SERVED''::text, ''CANCELLED''::text]))';
        
        RAISE NOTICE 'Updated % ORDER_STATUS check to include CANCELLED', t_restaurant_orders;
    END IF;
END $$;
