-- ============================================
-- Set Admin Role for User
-- ============================================
-- This script sets the admin role for a user in Supabase
-- 
-- INSTRUCTIONS:
-- 1. Open Supabase Dashboard > SQL Editor
-- 2. Replace 'admin@example.com' with the actual admin email
-- 3. Run this query
-- ============================================

-- Method 1: Update existing user to admin role
UPDATE auth.users
SET raw_user_meta_data = jsonb_set(
  COALESCE(raw_user_meta_data, '{}'::jsonb),
  '{role}',
  '"admin"'
)
WHERE email = 'tariqmir1278@gmail.com'; -- REPLACE WITH ACTUAL ADMIN EMAIL

-- Verify the update
SELECT 
  email,
  raw_user_meta_data->>'role' as role,
  raw_user_meta_data->>'name' as name,
  created_at
FROM auth.users
WHERE email = 'admin@example.com'; -- REPLACE WITH ACTUAL ADMIN EMAIL

-- ============================================
-- Alternative: Use the function we created
-- ============================================
-- SELECT set_user_admin_role('admin@example.com');


