-- Quick Fix: Confirm Admin Email & Assign Role
-- Run this in your Supabase Dashboard SQL Editor
-- This will fix the "Email not confirmed" error and set up admin access

-- Step 1: Confirm the email for existing admin user
UPDATE auth.users
SET email_confirmed_at = now()
WHERE email = 'admin@sukrut.com';

-- Step 2: Assign core_admin role
INSERT INTO user_roles (user_id, role)
SELECT id, 'core_admin'
FROM auth.users
WHERE email = 'admin@sukrut.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 3: Verify everything is set up
SELECT
  u.email,
  ur.role,
  u.email_confirmed_at,
  CASE 
    WHEN u.email_confirmed_at IS NOT NULL THEN '✅ Confirmed'
    ELSE '❌ Not Confirmed'
  END as email_status,
  u.created_at
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE u.email = 'admin@sukrut.com';
