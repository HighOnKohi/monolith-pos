-- ==============================================================================
-- Migration 006: Store each ordered unit as an individual Order_Items row
--
-- Existing rows with QUANTITY greater than one are expanded before the legacy
-- column is removed. New orders must insert one row per ordered unit.
-- ================================================================================

INSERT INTO public."Order_Items" (
  "ORDER_ID",
  "ITEM_ID",
  "DISCOUNT_ID",
  "ORDER_ITEM_STATUS"
)
SELECT
  oi."ORDER_ID",
  oi."ITEM_ID",
  oi."DISCOUNT_ID",
  oi."ORDER_ITEM_STATUS"
FROM public."Order_Items" AS oi
CROSS JOIN LATERAL generate_series(
  2,
  GREATEST(COALESCE(oi."QUANTITY", 1), 1)
);

ALTER TABLE public."Order_Items"
DROP COLUMN IF EXISTS "QUANTITY";
