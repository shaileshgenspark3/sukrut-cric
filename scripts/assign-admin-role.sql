-- This SQL script assigns the core_admin role to the admin user
-- Run this in your Supabase Dashboard SQL Editor

-- Find the user ID for admin@sukrut.com and insert into user_roles
INSERT INTO user_roles (user_id, role)
SELECT id, 'core_admin'
FROM auth.users
WHERE email = 'admin@sukrut.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify the role was assigned
SELECT 
    u.email,
    ur.role,
    u.created_at
FROM auth.users u
JOIN user_roles ur ON u.id = ur.user_id
WHERE u.email = 'admin@sukrut.com';
