-- ============================================================
-- Seed Data: Placeholder Menu Categories & Items
-- Run in Supabase SQL Editor to populate the menu
-- ============================================================

-- 1. Insert Categories
INSERT INTO public."Menu_Categories" ("CATEGORY_ID", "CATEGORY_NAME")
VALUES 
  (1, 'Starters'),
  (2, 'Main Course'),
  (3, 'Desserts'),
  (4, 'Beverages')
ON CONFLICT ("CATEGORY_ID") DO UPDATE 
SET "CATEGORY_NAME" = EXCLUDED."CATEGORY_NAME";

-- 2. Insert Menu Items
INSERT INTO public."Menu_Items" 
  ("ITEM_ID", "CATEGORY_ID", "ITEM_NAME", "ITEM_PRICE", "ITEM_DESCRIPTION", "ITEM_IMAGE_URL", "ITEM_STATUS")
VALUES 
  -- Starters
  (1, 1, 'Classic Caesar Salad', 250.00, 'Crisp romaine, parmesan, croutons, and house-made caesar dressing.', 'https://images.unsplash.com/photo-1550304943-4f24f54ddde9?w=400&auto=format&fit=crop', 'AVAILABLE'),
  (2, 1, 'Crispy Calamari', 320.00, 'Lightly breaded squid rings served with garlic aioli.', 'https://images.unsplash.com/photo-1604908176997-125f25cc6f3d?w=400&auto=format&fit=crop', 'AVAILABLE'),
  (3, 1, 'Truffle Fries', 180.00, 'Shoestring fries tossed in truffle oil and parmesan cheese.', 'https://images.unsplash.com/photo-1623227866882-c005ddcb12f2?w=400&auto=format&fit=crop', 'AVAILABLE'),
  
  -- Main Course
  (4, 2, 'Grilled Ribeye Steak', 1200.00, '10oz Angus ribeye, mashed potatoes, roasted vegetables, peppercorn sauce.', 'https://images.unsplash.com/photo-1600891964092-4316c288032e?w=400&auto=format&fit=crop', 'AVAILABLE'),
  (5, 2, 'Pan-Seared Salmon', 650.00, 'Fresh Atlantic salmon, asparagus, lemon butter sauce.', 'https://images.unsplash.com/photo-1467003909585-2f8a72700288?w=400&auto=format&fit=crop', 'AVAILABLE'),
  (6, 2, 'Mushroom Risotto', 450.00, 'Creamy Arborio rice with wild mushrooms and truffle essence.', 'https://images.unsplash.com/photo-1476124369491-e7addf5db371?w=400&auto=format&fit=crop', 'AVAILABLE'),
  
  -- Desserts
  (7, 3, 'New York Cheesecake', 220.00, 'Classic baked cheesecake with berry compote.', 'https://images.unsplash.com/photo-1533134242443-d4fd215305ad?w=400&auto=format&fit=crop', 'AVAILABLE'),
  (8, 3, 'Warm Chocolate Lava Cake', 250.00, 'Molten center chocolate cake served with vanilla bean ice cream.', 'https://images.unsplash.com/photo-1511381939415-e440c9d7221e?w=400&auto=format&fit=crop', 'AVAILABLE'),
  
  -- Beverages
  (9, 4, 'Signature Iced Latte', 160.00, 'Espresso over ice with creamy milk and vanilla syrup.', 'https://images.unsplash.com/photo-1461023058943-07fcbe16d735?w=400&auto=format&fit=crop', 'AVAILABLE'),
  (10, 4, 'Fresh Mango Shake', 140.00, 'Sweet ripe mangoes blended with ice.', 'https://images.unsplash.com/photo-1546173159-315724a31696?w=400&auto=format&fit=crop', 'AVAILABLE')
ON CONFLICT ("ITEM_ID") DO UPDATE 
SET 
  "ITEM_NAME" = EXCLUDED."ITEM_NAME",
  "ITEM_PRICE" = EXCLUDED."ITEM_PRICE",
  "ITEM_DESCRIPTION" = EXCLUDED."ITEM_DESCRIPTION",
  "ITEM_IMAGE_URL" = EXCLUDED."ITEM_IMAGE_URL",
  "ITEM_STATUS" = EXCLUDED."ITEM_STATUS";

-- 3. Reset Sequences so new items added from the app don't conflict with our seeded IDs
SELECT setval(pg_get_serial_sequence('public."Menu_Categories"', 'CATEGORY_ID'), coalesce(max("CATEGORY_ID"), 1), max("CATEGORY_ID") IS NOT NULL) FROM public."Menu_Categories";
SELECT setval(pg_get_serial_sequence('public."Menu_Items"', 'ITEM_ID'), coalesce(max("ITEM_ID"), 1), max("ITEM_ID") IS NOT NULL) FROM public."Menu_Items";
