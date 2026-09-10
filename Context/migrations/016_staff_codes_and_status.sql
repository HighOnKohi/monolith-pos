-- Migration 016: Staff Codes Status and Single Staff Account Transition
-- Description: Adds STATUS column to Staff_Codes table, seeds default staff codes,
-- and retains only the single primary store staff account in Staff_Accounts.

-- 1. Add STATUS column to Staff_Codes if not already present
ALTER TABLE public."Staff_Codes"
  ADD COLUMN IF NOT EXISTS "STATUS" TEXT NOT NULL DEFAULT 'ACTIVE';

-- 2. Add check constraint for STATUS
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'staff_codes_status_check'
  ) THEN
    ALTER TABLE public."Staff_Codes"
      ADD CONSTRAINT staff_codes_status_check
      CHECK ("STATUS" = ANY (ARRAY['ACTIVE'::TEXT, 'INACTIVE'::TEXT, 'SUSPENDED'::TEXT]));
  END IF;
END $$;

-- 3. Seed default staff codes if table is empty
INSERT INTO public."Staff_Codes" ("CODE_ID", "STAFF_NAME", "STAFF_ROLE", "STATUS")
VALUES
  (1001, 'Administrator', 'ADMIN', 'ACTIVE'),
  (1002, 'Maria Santos', 'MANAGER', 'ACTIVE'),
  (1003, 'Juan Dela Cruz', 'CASHIER', 'ACTIVE'),
  (1004, 'Chef Roberto Gonzales', 'KITCHEN', 'ACTIVE'),
  (1005, 'Elena Reyes', 'STAFF', 'ACTIVE')
ON CONFLICT ("CODE_ID") DO NOTHING;

-- 4. Retain only the single primary Administrator account in Staff_Accounts
-- (All operational staff roles are now assigned via Staff_Codes)
DELETE FROM public."Staff_Accounts"
WHERE "ACCOUNT_ID" != 1;
