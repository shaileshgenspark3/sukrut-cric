-- Migration: Add captain system columns and simplify admin roles
-- Date: 2026-03-06
-- Description: Add captain assignment columns to players/teams tables, simplify admin role to only core_admin and captain

-- Add captain columns to players table
ALTER TABLE public.players
  ADD COLUMN IF NOT EXISTS is_captain BOOLEAN DEFAULT FALSE,
  ADD COLUMN IF NOT EXISTS captain_team_id UUID REFERENCES public.teams(id);

-- Add captain column to teams table
ALTER TABLE public.teams
  ADD COLUMN IF NOT EXISTS captain_player_id UUID REFERENCES public.players(id);

-- Create indexes for performance
CREATE INDEX IF NOT EXISTS idx_players_is_captain ON public.players(is_captain);
CREATE INDEX IF NOT EXISTS idx_players_captain_team_id ON public.players(captain_team_id);
CREATE INDEX IF NOT EXISTS idx_teams_captain_player_id ON public.teams(captain_player_id);

-- Add comments for documentation
COMMENT ON COLUMN public.players.is_captain IS 'True if this player is a team captain (cannot be auctioned)';
COMMENT ON COLUMN public.players.captain_team_id IS 'Team this captain belongs to (for roster visibility)';
COMMENT ON COLUMN public.teams.captain_player_id IS 'Player ID of the assigned captain';

-- Simplify admin role: Remove 'admin' role, keep only 'core_admin' and 'captain'
-- Update app_role ENUM type (requires recreating)
CREATE TYPE app_role_new AS ENUM ('core_admin', 'captain');

-- Update the user_roles table to use new enum
ALTER TABLE public.user_roles ALTER COLUMN role TYPE app_role_new USING role::text::app_role_new;

-- Drop the old enum type
DROP TYPE public.app_role;

-- Rename the new type to the original name
ALTER TYPE app_role_new RENAME TO app_role;

-- Delete any existing user_roles with role='admin' (they would have been converted during migration above)
-- No action needed since we converted the enum

-- Update RLS policies to reference only core_admin and captain roles
-- Teams policies
DROP POLICY IF EXISTS "Admins can manage teams" ON public.teams;
CREATE POLICY "Core admins can manage teams" ON public.teams FOR ALL USING (has_role(auth.uid(), 'core_admin'));

-- Players policies
DROP POLICY IF EXISTS "Admins can manage players" ON public.players;
CREATE POLICY "Core admins can manage players" ON public.players FOR ALL USING (has_role(auth.uid(), 'core_admin'));

-- Tournament settings policies
DROP POLICY IF EXISTS "Admins can update tournament settings" ON public.tournament_settings;
CREATE POLICY "Core admins can update tournament settings" ON public.tournament_settings FOR UPDATE USING (has_role(auth.uid(), 'core_admin'));

DROP POLICY IF EXISTS "Admins can insert tournament settings" ON public.tournament_settings;
CREATE POLICY "Core admins can insert tournament settings" ON public.tournament_settings FOR INSERT WITH CHECK (has_role(auth.uid(), 'core_admin'));

-- Auction rules policies
DROP POLICY IF EXISTS "Admins can manage auction rules" ON public.auction_rules;
CREATE POLICY "Core admins can manage auction rules" ON public.auction_rules FOR ALL USING (has_role(auth.uid(), 'core_admin'));

-- Auction state policies
DROP POLICY IF EXISTS "Admins can manage auction state" ON public.auction_state;
CREATE POLICY "Core admins can manage auction state" ON public.auction_state FOR ALL USING (has_role(auth.uid(), 'core_admin'));

-- Bids policies
DROP POLICY IF EXISTS "Admins can manage bids" ON public.bids;
CREATE POLICY "Core admins can manage bids" ON public.bids FOR ALL USING (has_role(auth.uid(), 'core_admin'));

-- User roles policies
DROP POLICY IF EXISTS "Core admin can manage roles" ON public.user_roles;
CREATE POLICY "Core admins can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'core_admin'));
