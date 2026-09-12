-- ==============================================================================
-- Migration 020: Populate Database with Realistic Completed Orders for Analytics
--
-- Features:
--   1. Dynamically reads available Menu_Items and Restaurant_Tables from the database.
--   2. Inserts ONLY COMPLETED orders (ORDER_STATUS = 'COMPLETED') with both DINE-IN and TAKEOUT types.
--   3. Date spread across the last 75 days to support all analytics presets:
--      Today, Yesterday, Last 7 Days, Last 30 Days, This Month, Last Month, and custom ranges.
--   4. Realistic operating hours (10:00 - 22:00) with authentic lunch (11:30-13:30) and dinner (17:30-20:30) rushes.
--   5. Full analytics KPI compatibility:
--      - GUEST_COUNT (party sizes 1-6 for dine-in, 1-2 for takeout)
--      - Accurate kitchen timestamps (READY_AT, SERVED_AT, COMPLETED_AT) for prep & serving time KPIs
--      - Exact SUBTOTAL_BILL and TOTAL_BILL matching items in Order_Items
--      - Realistic discount sampling (~15% Senior/PWD 20% discount)
--      - Channel breakdown (Cashier vs Customer App)
--      - Payment method distribution (CASH, CREDIT_CARD, INSTAPAY_QR)
--      - Stores 1 row per unit in Order_Items (consistent with Migration 006)
--
-- Instructions:
--   Open Supabase Dashboard -> SQL Editor -> New Query -> Paste & Run
-- ==============================================================================

DO $$
DECLARE
    -- Configuration parameters
    v_total_orders_to_create int := 500; -- Total orders to generate
    v_days_back int := 75;               -- Timespan window in days

    -- Dynamic table and menu item storage
    v_table_ids bigint[];
    v_item_ids bigint[];
    v_item_prices double precision[];
    v_num_tables int;
    v_num_items int;

    -- Order level variables
    v_order_id bigint;
    v_table_id bigint;
    v_order_type text;
    v_requested_from text;
    v_payment_method text;
    v_guest_count int;
    v_kitchen_note text;
    v_server_note text;

    -- Date & timestamp calculation variables
    v_random_days double precision;
    v_random_hour int;
    v_random_minute int;
    v_random_second int;
    v_order_time timestamp without time zone;
    v_prep_minutes int;
    v_delivery_minutes int;
    v_turnaround_minutes int;
    v_ready_at timestamp without time zone;
    v_served_at timestamp without time zone;
    v_completed_at timestamp without time zone;

    -- Order items generation variables
    v_num_distinct_items int;
    v_chosen_item_indices int[];
    v_item_idx int;
    v_item_id bigint;
    v_item_qty int;
    v_subtotal double precision;
    v_total double precision;
    v_is_discounted boolean;

    -- Loop indices & helpers
    i int;
    j int;
    k int;
    v_try int;
    v_already_chosen boolean;

    -- Notes & payment method lookup pools
    v_k_notes text[] := ARRAY[
        'Extra crispy please',
        'Less oil',
        'No onions if possible',
        'Well done egg',
        'Pack sauce on the side',
        'Separate chili sauce',
        'Rice well heated',
        'Less ice for beverages'
    ];
    v_s_notes text[] := ARRAY[
        'Customer asked for extra napkins',
        'Regular dining customer',
        'Table requested water immediately',
        'Split bill requested earlier',
        'Served with priority'
    ];
    v_payment_methods text[] := ARRAY['CASH', 'CREDIT_CARD', 'INSTAPAY_QR'];

BEGIN
    -- 1. Fetch available tables and menu items from database
    SELECT array_agg("TABLE_ID") INTO v_table_ids FROM public."Restaurant_Tables";
    SELECT array_agg("ITEM_ID"), array_agg("ITEM_PRICE") 
    INTO v_item_ids, v_item_prices 
    FROM public."Menu_Items" 
    WHERE "ITEM_STATUS" = 'AVAILABLE' OR "ITEM_STATUS" IS NULL;

    v_num_tables := COALESCE(array_length(v_table_ids, 1), 0);
    v_num_items := COALESCE(array_length(v_item_ids, 1), 0);

    IF v_num_tables = 0 THEN
        RAISE EXCEPTION 'No tables found in Restaurant_Tables. Please seed tables first.';
    END IF;

    IF v_num_items = 0 THEN
        RAISE EXCEPTION 'No menu items found in Menu_Items. Please seed menu items first.';
    END IF;

    RAISE NOTICE 'Starting generation of % completed orders across the last % days...', v_total_orders_to_create, v_days_back;
    RAISE NOTICE 'Found % tables and % menu items in database.', v_num_tables, v_num_items;

    FOR i IN 1..v_total_orders_to_create LOOP

        -- A. Determine Order Type (70% DINE-IN, 30% TAKEOUT)
        IF random() < 0.70 THEN
            v_order_type := 'DINE-IN';
            v_table_id := v_table_ids[1 + floor(random() * v_num_tables)::int];
            -- Party sizes: 1-2 guests (45%), 3-4 guests (35%), 5-6 guests (20%)
            IF random() < 0.45 THEN
                v_guest_count := 1 + floor(random() * 2)::int;
            ELSIF random() < 0.80 THEN
                v_guest_count := 3 + floor(random() * 2)::int;
            ELSE
                v_guest_count := 5 + floor(random() * 2)::int;
            END IF;
        ELSE
            v_order_type := 'TAKEOUT';
            -- Takeout orders reference a valid table to satisfy NOT NULL FK constraint
            v_table_id := v_table_ids[1 + floor(random() * v_num_tables)::int];
            v_guest_count := 1 + floor(random() * 2)::int;
        END IF;

        -- B. Channel Breakdown (60% Cashier, 40% Customer App)
        IF random() < 0.60 THEN
            v_requested_from := 'Cashier';
        ELSE
            v_requested_from := 'Customer';
        END IF;

        -- C. Payment Method (50% CASH, 30% CREDIT_CARD, 20% INSTAPAY_QR)
        IF random() < 0.50 THEN
            v_payment_method := 'CASH';
        ELSIF random() < 0.80 THEN
            v_payment_method := 'CREDIT_CARD';
        ELSE
            v_payment_method := 'INSTAPAY_QR';
        END IF;

        -- D. Timestamp Generation (Operating hours: 10:00 - 22:00 with peak rushes)
        v_random_days := random() * v_days_back;
        
        -- Hour distribution:
        -- 45% Dinner rush (17:00 - 20:59)
        -- 35% Lunch rush (11:00 - 13:59)
        -- 20% Off-peak (10:00 - 10:59 or 14:00 - 16:59 or 21:00 - 21:59)
        IF random() < 0.45 THEN
            v_random_hour := 17 + floor(random() * 4)::int;
        ELSIF random() < 0.80 THEN
            v_random_hour := 11 + floor(random() * 3)::int;
        ELSE
            IF random() < 0.60 THEN
                v_random_hour := 14 + floor(random() * 3)::int;
            ELSIF random() < 0.85 THEN
                v_random_hour := 10;
            ELSE
                v_random_hour := 21;
            END IF;
        END IF;

        v_random_minute := floor(random() * 60)::int;
        v_random_second := floor(random() * 60)::int;

        v_order_time := date_trunc('second', CURRENT_TIMESTAMP - (v_random_days || ' days')::interval);
        v_order_time := date_trunc('day', v_order_time) 
                        + (v_random_hour || ' hours')::interval 
                        + (v_random_minute || ' minutes')::interval 
                        + (v_random_second || ' seconds')::interval;

        -- Prevent timestamps from being in the future or within the last 30 minutes
        IF v_order_time > CURRENT_TIMESTAMP - INTERVAL '30 minutes' THEN
            v_order_time := CURRENT_TIMESTAMP - (INTERVAL '1 hour' + (random() * INTERVAL '4 hours'));
        END IF;

        -- E. Kitchen & Serving Durations
        -- Prep duration: 8 to 22 minutes
        v_prep_minutes := 8 + floor(random() * 15)::int;
        -- Delivery duration: 2 to 6 minutes
        v_delivery_minutes := 2 + floor(random() * 5)::int;
        
        v_ready_at := v_order_time + (v_prep_minutes || ' minutes')::interval;
        v_served_at := v_ready_at + (v_delivery_minutes || ' minutes')::interval;

        -- Turnaround duration (Dine-in diners stay 20-55 mins, Takeout leaves in 2-6 mins)
        IF v_order_type = 'TAKEOUT' THEN
            v_turnaround_minutes := 2 + floor(random() * 5)::int;
        ELSE
            v_turnaround_minutes := 20 + floor(random() * 35)::int;
        END IF;

        v_completed_at := v_served_at + (v_turnaround_minutes || ' minutes')::interval;

        -- F. Occasional Notes
        IF random() < 0.20 THEN
            v_kitchen_note := v_k_notes[1 + floor(random() * array_length(v_k_notes, 1))::int];
        ELSE
            v_kitchen_note := NULL;
        END IF;

        IF random() < 0.15 THEN
            v_server_note := v_s_notes[1 + floor(random() * array_length(v_s_notes, 1))::int];
        ELSE
            v_server_note := NULL;
        END IF;

        -- G. Select 1 to 4 distinct items from the menu
        v_num_distinct_items := 1 + floor(random() * LEAST(4, v_num_items))::int;
        v_chosen_item_indices := '{}';
        
        FOR j IN 1..v_num_distinct_items LOOP
            v_try := 1 + floor(random() * v_num_items)::int;
            v_already_chosen := false;
            FOREACH k IN ARRAY v_chosen_item_indices LOOP
                IF k = v_try THEN
                    v_already_chosen := true;
                END IF;
            END LOOP;
            IF NOT v_already_chosen THEN
                v_chosen_item_indices := array_append(v_chosen_item_indices, v_try);
            END IF;
        END LOOP;

        IF array_length(v_chosen_item_indices, 1) IS NULL OR array_length(v_chosen_item_indices, 1) = 0 THEN
            v_chosen_item_indices := ARRAY[1 + floor(random() * v_num_items)::int];
        END IF;

        -- Calculate exact subtotal bill from selected items and quantities
        v_subtotal := 0;
        FOREACH v_item_idx IN ARRAY v_chosen_item_indices LOOP
            -- Portion quantity per distinct item (1 to 2 portions)
            v_item_qty := 1 + floor(random() * 2)::int;
            v_subtotal := v_subtotal + (v_item_prices[v_item_idx] * v_item_qty);
        END LOOP;

        -- Apply ~15% chance of Senior / PWD 20% discount
        v_is_discounted := (random() < 0.15);
        IF v_is_discounted THEN
            v_total := ROUND((v_subtotal * 0.8)::numeric, 2);
        ELSE
            v_total := v_subtotal;
        END IF;

        -- H. Insert into Restaurant_Orders
        INSERT INTO public."Restaurant_Orders" (
            "TABLE_ID",
            "REQUESTED_FROM",
            "ORDER_TYPE",
            "ORDER_STATUS",
            "SUBTOTAL_BILL",
            "TOTAL_BILL",
            "TIME",
            "KITCHEN_NOTE",
            "SERVER_NOTE",
            "GUEST_COUNT",
            "READY_AT",
            "SERVED_AT",
            "COMPLETED_AT",
            "PAYMENT_METHOD"
        ) VALUES (
            v_table_id,
            v_requested_from,
            v_order_type,
            'COMPLETED',
            v_subtotal,
            v_total,
            v_order_time,
            v_kitchen_note,
            v_server_note,
            v_guest_count,
            v_ready_at,
            v_served_at,
            v_completed_at,
            v_payment_method
        )
        RETURNING "ORDER_ID" INTO v_order_id;

        -- I. Insert individual units into Order_Items (one row per portion)
        FOREACH v_item_idx IN ARRAY v_chosen_item_indices LOOP
            v_item_id := v_item_ids[v_item_idx];
            v_item_qty := 1 + floor(random() * 2)::int;
            
            FOR j IN 1..v_item_qty LOOP
                INSERT INTO public."Order_Items" (
                    "ORDER_ID",
                    "ITEM_ID",
                    "ORDER_ITEM_STATUS",
                    "IS_FLAGGED"
                ) VALUES (
                    v_order_id,
                    v_item_id,
                    'DONE',
                    false
                );
            END LOOP;
        END LOOP;

    END LOOP;

    RAISE NOTICE 'Generation complete! Successfully inserted % completed orders into the database.', v_total_orders_to_create;
END $$;

-- Verification Queries
SELECT 
    "ORDER_STATUS",
    "ORDER_TYPE",
    COUNT(*) AS total_orders,
    ROUND(SUM("TOTAL_BILL")::numeric, 2) AS total_revenue,
    ROUND(AVG("TOTAL_BILL")::numeric, 2) AS average_order_value,
    MIN("TIME") AS oldest_order,
    MAX("TIME") AS newest_order
FROM public."Restaurant_Orders"
WHERE "ORDER_STATUS" = 'COMPLETED'
GROUP BY "ORDER_STATUS", "ORDER_TYPE";
