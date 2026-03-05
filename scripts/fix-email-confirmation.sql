-- CONFIRM ADMIN EMAIL - Copy and paste this entire block into Supabase Dashboard SQL Editor
-- This will definitively fix the "Email not confirmed" issue

-- First, let's check the current status
SELECT 
  id,
  email,
  email_confirmed_at,
  confirmed_at,
  created_at,
  last_sign_in_at
FROM auth.users
WHERE email = 'admin@sukrut.com';

-- Now, confirm the email
UPDATE auth.users
SET 
  email_confirmed_at = NOW(),
  confirmed_at = NOW(),
  updated_at = NOW()
WHERE email = 'admin@sukrut.com';

-- Verify the update worked
SELECT 
  id,
  email,
  email_confirmed_at,
  confirmed_at,
  CASE 
    WHEN email_confirmed_at IS NOT NULL THEN '✅ CONFIRMED'
    ELSE '❌ NOT CONFIRMED'
  END as status
FROM auth.users
WHERE email = 'admin@sukrut.com';

-- Assign the admin role
INSERT INTO user_roles (user_id, role)
SELECT id, 'core_admin' FROM auth.users WHERE email = 'admin@sukrut.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Final verification
SELECT
  u.email,
  ur.role,
  u.email_confirmed_at,
  CASE 
    WHEN u.email_confirmed_at IS NOT NULL THEN '✅ Ready to Login'
    ELSE '❌ Email not confirmed'
  END as status
FROM auth.users u
LEFT JOIN user_roles ur ON u.id = ur.user_id
WHERE u.email = 'admin@sukrut.com';
