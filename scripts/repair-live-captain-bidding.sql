BEGIN;

-- Restore the four captain accounts that existed in auth/user_roles but had no team row.
INSERT INTO public.teams (
  team_name,
  captain_name,
  captain_user_id,
  captain_email,
  captain_password,
  phone_number,
  team_logo_url,
  captain_image_url
)
SELECT
  seed.team_name,
  seed.captain_name,
  seed.captain_user_id,
  seed.captain_email,
  seed.captain_password,
  '',
  seed.team_logo_url,
  seed.captain_image_url
FROM (
  VALUES
    (
      'Thunder Kings',
      'Vivaan Sharma',
      '13a6acea-dc15-4693-a50c-3195873ba663'::uuid,
      'captain2@sukrut.com',
      'captain2@123',
      'https://api.dicebear.com/7.x/initials/svg?seed=Thunder%20Kings',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Vivaan%20Sharma'
    ),
    (
      'Storm Riders',
      'Arjun Mehta',
      '95d6760b-e24e-4d24-ba75-bcf599be485f'::uuid,
      'captain4@sukrut.com',
      'captain4@123',
      'https://api.dicebear.com/7.x/initials/svg?seed=Storm%20Riders',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Arjun%20Mehta'
    ),
    (
      'Shadow Warriors',
      'Rohan Desai',
      '52861e2a-ee5f-4c26-96e4-1a3e8a297bec'::uuid,
      'captain6@sukrut.com',
      'captain6@123',
      'https://api.dicebear.com/7.x/initials/svg?seed=Shadow%20Warriors',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Rohan%20Desai'
    ),
    (
      'Power Hitters',
      'Reyansh Nair',
      '022d5f39-62ce-4775-8a0c-48012b96f3bc'::uuid,
      'captain10@sukrut.com',
      'captain10@123',
      'https://api.dicebear.com/7.x/initials/svg?seed=Power%20Hitters',
      'https://api.dicebear.com/7.x/avataaars/svg?seed=Reyansh%20Nair'
    )
) AS seed (
  team_name,
  captain_name,
  captain_user_id,
  captain_email,
  captain_password,
  team_logo_url,
  captain_image_url
)
WHERE NOT EXISTS (
  SELECT 1
  FROM public.teams
  WHERE public.teams.captain_user_id = seed.captain_user_id
);

-- Ensure every team has auction rules.
INSERT INTO public.auction_rules (team_id, captain_deduction, starting_purse, current_purse)
SELECT
  teams.id,
  0,
  COALESCE((SELECT global_purse FROM public.tournament_settings LIMIT 1), 3000000),
  COALESCE((SELECT global_purse FROM public.tournament_settings LIMIT 1), 3000000)
FROM public.teams
LEFT JOIN public.auction_rules ON public.auction_rules.team_id = public.teams.id
WHERE public.auction_rules.team_id IS NULL;

-- Repair historical current_purse/captain_deduction rows that were left in legacy scaled units.
UPDATE public.auction_rules
SET
  current_purse = current_purse * 100,
  captain_deduction = captain_deduction * 100
WHERE
  starting_purse >= 1000000
  AND current_purse <= 30000
  AND NOT EXISTS (
    SELECT 1
    FROM public.players
    WHERE public.players.sold_to_team_id = public.auction_rules.team_id
      AND public.players.is_sold = TRUE
  );

COMMIT;
