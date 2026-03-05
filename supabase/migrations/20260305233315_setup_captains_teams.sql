-- Setup Sample Captains and Teams
-- Migration: 20260305233315_setup_captains_teams

-- This migration creates sample captains with confirmed emails and assigns captain roles

-- Captain 1
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'captain1@sukrut.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_user_meta_data, raw_app_meta_data,
      created_at, updated_at
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated', 'authenticated',
      'captain1@sukrut.com',
      crypt('captain1@123', gen_salt('bf')),
      NOW(),
      '{"provider": "email", "name": "Captain 1"}',
      '{"provider": "email", "role": "captain"}',
      NOW(), NOW()
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.teams WHERE team_name = 'Royal Strikers') THEN
    INSERT INTO public.teams (
      team_name, captain_name, captain_email, captain_password,
      phone_number, team_logo_url, captain_image_url
    )
    VALUES (
      'Royal Strikers', 'Aarav Patel',
      'captain1@sukrut.com', 'captain1@123',
      '9876543210',
      'https://api.dicebear.com/7.x/initials/svg?seed=Royal%20Strikers',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Aarav%20Patel'
    );
  END IF;
END $$;

-- Captain 2
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'captain2@sukrut.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_user_meta_data, raw_app_meta_data,
      created_at, updated_at
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated', 'authenticated',
      'captain2@sukrut.com',
      crypt('captain2@123', gen_salt('bf')),
      NOW(),
      '{"provider": "email", "name": "Captain 2"}',
      '{"provider": "email", "role": "captain"}',
      NOW(), NOW()
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.teams WHERE team_name = 'Thunder Kings') THEN
    INSERT INTO public.teams (
      team_name, captain_name, captain_email, captain_password,
      phone_number, team_logo_url, captain_image_url
    )
    VALUES (
      'Thunder Kings', 'Vivaan Sharma',
      'captain2@sukrut.com', 'captain2@123',
      '9876543211',
      'https://api.dicebear.com/7.x/initials/svg?seed=Thunder%20Kings',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Vivaan%20Sharma'
    );
  END IF;
END $$;

-- Captain 3
DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM auth.users WHERE email = 'captain3@sukrut.com') THEN
    INSERT INTO auth.users (
      instance_id, id, aud, role, email,
      encrypted_password, email_confirmed_at,
      raw_user_meta_data, raw_app_meta_data,
      created_at, updated_at
    )
    VALUES (
      '00000000-0000-0000-0000-000000000000',
      gen_random_uuid(),
      'authenticated', 'authenticated',
      'captain3@sukrut.com',
      crypt('captain3@123', gen_salt('bf')),
      NOW(),
      '{"provider": "email", "name": "Captain 3"}',
      '{"provider": "email", "role": "captain"}',
      NOW(), NOW()
    );
  END IF;
END $$;

DO $$
BEGIN
  IF NOT EXISTS (SELECT 1 FROM public.teams WHERE team_name = 'Golden Eagles') THEN
    INSERT INTO public.teams (
      team_name, captain_name, captain_email, captain_password,
      phone_number, team_logo_url, captain_image_url
    )
    VALUES (
      'Golden Eagles', 'Aditya Singh',
      'captain3@sukrut.com', 'captain3@123',
      '9876543212',
      'https://api.dicebear.com/7.x/initials/svg?seed=Golden%20Eagles',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Aditya%20Singh'
    );
  END IF;
END $$;

-- Assign captain roles and link captain_user_id
INSERT INTO public.user_roles (user_id, role)
SELECT u.id, 'captain'
FROM auth.users u
WHERE u.email LIKE 'captain%@sukrut.com'
ON CONFLICT (user_id, role) DO NOTHING;

-- Link captain_user_id to teams
UPDATE public.teams t
SET captain_user_id = (
  SELECT u.id FROM auth.users u WHERE u.email = t.captain_email
)
WHERE captain_user_id IS NULL AND captain_email LIKE 'captain%@sukrut.com';

-- Create auction rules for teams
INSERT INTO public.auction_rules (team_id, captain_deduction, starting_purse)
SELECT t.id, 0, 30000
FROM public.teams t
WHERE NOT EXISTS (
  SELECT 1 FROM public.auction_rules ar WHERE ar.team_id = t.id
);

-- Verification
DO $$
DECLARE
  captain_count INTEGER;
  team_count INTEGER;
BEGIN
  SELECT COUNT(*) INTO captain_count
  FROM auth.users WHERE email LIKE 'captain%@sukrut.com' AND email_confirmed_at IS NOT NULL;
  
  SELECT COUNT(*) INTO team_count
  FROM public.teams;
  
  RAISE NOTICE 'Captain users created: %', captain_count;
  RAISE NOTICE 'Teams created: %', team_count;
  RAISE NOTICE 'Captain login example: captain1@sukrut.com / captain1@123';
END $$;
