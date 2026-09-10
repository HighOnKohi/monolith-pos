-- ============================================================
-- Migration 015: Advance Orders Table Support
-- Description: Adds TABLE_ID and TABLE_NUM to Advance_Orders
-- allowing direct relational linking to Restaurant_Tables.
-- ============================================================

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Advance_Orders'
      AND column_name = 'TABLE_ID'
  ) THEN
    ALTER TABLE public."Advance_Orders"
      ADD COLUMN "TABLE_ID" BIGINT NULL REFERENCES public."Restaurant_Tables"("TABLE_ID") ON DELETE SET NULL;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public'
      AND table_name = 'Advance_Orders'
      AND column_name = 'TABLE_NUM'
  ) THEN
    ALTER TABLE public."Advance_Orders"
      ADD COLUMN "TABLE_NUM" INTEGER NULL;
  END IF;
END $$;

CREATE INDEX IF NOT EXISTS idx_advance_orders_table_id ON public."Advance_Orders" ("TABLE_ID");
