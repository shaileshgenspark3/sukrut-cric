-- This script creates the admin user and assigns the core_admin role
-- Run this in your Supabase Dashboard SQL Editor

-- First, create the auth user if it doesn't exist
-- Note: You'll need to create this manually via Supabase Dashboard > Authentication > Users
-- Email: admin@sukrut.com
-- Password: Admin123!

-- After creating the user, get the user ID and update the user_roles table below:

-- Insert the admin role (replace YOUR_USER_ID with the actual UUID from the auth user)
INSERT INTO user_roles (user_id, role)
VALUES ('YOUR_USER_ID', 'core_admin')
ON CONFLICT (user_id, role) DO NOTHING;

-- Verify the role was assigned
SELECT * FROM user_roles WHERE role = 'core_admin';
