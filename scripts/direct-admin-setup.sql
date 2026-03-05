-- Direct Admin Setup Script
-- Run this in your Supabase Dashboard SQL Editor
-- This creates the admin user and assigns the core_admin role in one step

-- Step 1: Create the admin user with email confirmed
INSERT INTO auth.users (
  instance_id,
  id,
  aud,
  role,
  email,
  encrypted_password,
  email_confirmed_at,
  raw_user_meta_data,
  raw_app_meta_data,
  created_at,
  updated_at
)
SELECT
  '00000000-0000-0000-0000-000000000000',
  gen_random_uuid(),
  'authenticated',
  'authenticated',
  'admin@sukrut.com',
  crypt('Admin123!', gen_salt('bf')),
  now(),
  '{"provider": "email", "name": "Admin"}',
  '{"provider": "email", "role": "core_admin"}',
  now(),
  now()
ON CONFLICT (email) DO UPDATE SET
  encrypted_password = crypt('Admin123!', gen_salt('bf')),
  email_confirmed_at = now(),
  updated_at = now()
RETURNING id;

-- Step 2: Assign the core_admin role
INSERT INTO user_roles (user_id, role)
SELECT id, 'core_admin'
FROM auth.users
WHERE email = 'admin@sukrut.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Step 3: Verify the setup
SELECT
  u.email,
  ur.role,
  u.email_confirmed_at,
  u.created_at
FROM auth.users u
JOIN user_roles ur ON u.id = ur.user_id
WHERE u.email = 'admin@sukrut.com';
