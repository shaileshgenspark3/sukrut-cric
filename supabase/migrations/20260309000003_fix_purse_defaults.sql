-- Normalize purse defaults to rupee units and backfill missing auction rules.
-- This fixes the mismatch where starting_purse/global_purse were updated to rupees
-- while current_purse remained in the legacy scaled format.

ALTER TABLE public.tournament_settings
  ALTER COLUMN global_purse SET DEFAULT 3000000;

ALTER TABLE public.auction_rules
  ALTER COLUMN starting_purse SET DEFAULT 3000000;

ALTER TABLE public.auction_rules
  ALTER COLUMN current_purse SET DEFAULT 3000000;

INSERT INTO public.auction_rules (team_id, captain_deduction, starting_purse, current_purse)
SELECT
  teams.id,
  0,
  COALESCE((SELECT global_purse FROM public.tournament_settings LIMIT 1), 3000000),
  COALESCE((SELECT global_purse FROM public.tournament_settings LIMIT 1), 3000000)
FROM public.teams
LEFT JOIN public.auction_rules ON public.auction_rules.team_id = public.teams.id
WHERE public.auction_rules.team_id IS NULL;

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
