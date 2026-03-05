-- Confirm admin email and assign core_admin role
-- Migration: 20260305231135_confirm_admin_email

-- Step 1: Confirm email for admin user
UPDATE auth.users
SET email_confirmed_at = NOW()
WHERE email = 'admin@sukrut.com';

-- Step 2: Assign core_admin role
INSERT INTO public.user_roles (user_id, role)
SELECT id, 'core_admin'
FROM auth.users
WHERE email = 'admin@sukrut.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 3: Verify the setup
-- This will show the admin user's status
DO $$
DECLARE
  user_record RECORD;
  role_assigned BOOLEAN;
BEGIN
  SELECT * INTO user_record FROM auth.users WHERE email = 'admin@sukrut.com';
  
  SELECT EXISTS(
    SELECT 1 FROM public.user_roles ur
    INNER JOIN auth.users u ON u.id = ur.user_id
    WHERE u.email = 'admin@sukrut.com' AND ur.role = 'core_admin'
  ) INTO role_assigned;
  
  RAISE NOTICE 'Admin user: %', user_record.email;
  RAISE NOTICE 'Email confirmed: %', CASE WHEN user_record.email_confirmed_at IS NOT NULL THEN 'YES' ELSE 'NO' END;
  RAISE NOTICE 'Admin role assigned: %', CASE WHEN role_assigned THEN 'YES' ELSE 'NO' END;
END $$;
