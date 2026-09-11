-- ============================================================
-- Migration 017: Add Timestamps to Ticket_Orders
-- Description: Adds CREATED_AT and COMPLETED_AT columns to Ticket_Orders
-- for accurate historical and lifecycle analytics tracking.
-- ============================================================

ALTER TABLE public."Ticket_Orders" 
  ADD COLUMN IF NOT EXISTS "CREATED_AT" TIMESTAMP WITH TIME ZONE NOT NULL DEFAULT NOW();

ALTER TABLE public."Ticket_Orders" 
  ADD COLUMN IF NOT EXISTS "COMPLETED_AT" TIMESTAMP WITH TIME ZONE NULL;

CREATE INDEX IF NOT EXISTS idx_ticket_orders_created_at ON public."Ticket_Orders" ("CREATED_AT");
CREATE INDEX IF NOT EXISTS idx_ticket_orders_status ON public."Ticket_Orders" ("TICKET_STATUS");
