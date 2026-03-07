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

-- Drop ALL policies that depend on the app_role type before altering it
DROP POLICY IF EXISTS "Admins can update tournament settings" ON public.tournament_settings;
DROP POLICY IF EXISTS "Admins can insert tournament settings" ON public.tournament_settings;
DROP POLICY IF EXISTS "Core admins can update tournament settings" ON public.tournament_settings;
DROP POLICY IF EXISTS "Core admins can insert tournament settings" ON public.tournament_settings;
DROP POLICY IF EXISTS "Admins can manage teams" ON public.teams;
DROP POLICY IF EXISTS "Core admins can manage teams" ON public.teams;
DROP POLICY IF EXISTS "Admins can manage players" ON public.players;
DROP POLICY IF EXISTS "Core admins can manage players" ON public.players;
DROP POLICY IF EXISTS "Admins can manage auction rules" ON public.auction_rules;
DROP POLICY IF EXISTS "Core admins can manage auction rules" ON public.auction_rules;
DROP POLICY IF EXISTS "Admins can manage auction state" ON public.auction_state;
DROP POLICY IF EXISTS "Core admins can manage auction state" ON public.auction_state;
DROP POLICY IF EXISTS "Admins can manage bids" ON public.bids;
DROP POLICY IF EXISTS "Core admins can manage bids" ON public.bids;
DROP POLICY IF EXISTS "Core admin can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Core admins can manage roles" ON public.user_roles;
DROP POLICY IF EXISTS "Core admins can view all auction logs" ON public.auction_log;
DROP POLICY IF EXISTS "Core admins can create auction logs" ON public.auction_log;
DROP POLICY IF EXISTS "Core admins can update auction logs" ON public.auction_log;
DROP POLICY IF EXISTS "Admins can view all auction logs" ON public.auction_log;
DROP POLICY IF EXISTS "Admins can create auction logs" ON public.auction_log;
DROP POLICY IF EXISTS "Admins can update auction logs" ON public.auction_log;
DROP POLICY IF EXISTS "Admins can view audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Admins can create audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Core admins can view audit logs" ON public.audit_log;
DROP POLICY IF EXISTS "Core admins can create audit logs" ON public.audit_log;

-- Drop has_role function that depends on app_role
DROP FUNCTION IF EXISTS public.has_role(uuid, app_role);

-- Update the user_roles table to use new enum
ALTER TABLE public.user_roles ALTER COLUMN role TYPE app_role_new USING role::text::app_role_new;

-- Drop the old enum type
DROP TYPE public.app_role;

-- Rename the new type to the original name
ALTER TYPE app_role_new RENAME TO app_role;

-- Recreate has_role function with new enum type
CREATE OR REPLACE FUNCTION public.has_role(_user_id uuid, _role app_role)
RETURNS boolean AS $$
BEGIN
    RETURN EXISTS (
        SELECT 1 FROM public.user_roles
        WHERE user_roles.user_id = _user_id
        AND user_roles.role = _role
    );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Delete any existing user_roles with role='admin' (they would have been converted during migration above)
-- No action needed since we converted the enum

-- Recreate all RLS policies with new role type
-- Tournament settings policies
CREATE POLICY "Core admins can update tournament settings" ON public.tournament_settings FOR UPDATE USING (has_role(auth.uid(), 'core_admin'));
CREATE POLICY "Core admins can insert tournament settings" ON public.tournament_settings FOR INSERT WITH CHECK (has_role(auth.uid(), 'core_admin'));

-- Teams policies
CREATE POLICY "Core admins can manage teams" ON public.teams FOR ALL USING (has_role(auth.uid(), 'core_admin'));

-- Players policies
CREATE POLICY "Core admins can manage players" ON public.players FOR ALL USING (has_role(auth.uid(), 'core_admin'));

-- Auction rules policies
CREATE POLICY "Core admins can manage auction rules" ON public.auction_rules FOR ALL USING (has_role(auth.uid(), 'core_admin'));

-- Auction state policies
CREATE POLICY "Core admins can manage auction state" ON public.auction_state FOR ALL USING (has_role(auth.uid(), 'core_admin'));

-- Bids policies
CREATE POLICY "Core admins can manage bids" ON public.bids FOR ALL USING (has_role(auth.uid(), 'core_admin'));

-- User roles policies
CREATE POLICY "Core admins can manage roles" ON public.user_roles FOR ALL USING (has_role(auth.uid(), 'core_admin'));

-- Auction log policies (admin-only access)
CREATE POLICY "Core admins can view all auction logs" ON public.auction_log 
FOR SELECT USING (has_role(auth.uid(), 'core_admin'));
CREATE POLICY "Core admins can create auction logs" ON public.auction_log 
FOR INSERT WITH CHECK (has_role(auth.uid(), 'core_admin'));
CREATE POLICY "Core admins can update auction logs" ON public.auction_log 
FOR UPDATE USING (has_role(auth.uid(), 'core_admin'));

-- Audit log policies (admin-only access)
CREATE POLICY "Core admins can view audit logs" ON public.audit_log 
FOR SELECT USING (has_role(auth.uid(), 'core_admin'));
CREATE POLICY "Core admins can create audit logs" ON public.audit_log 
FOR INSERT WITH CHECK (has_role(auth.uid(), 'core_admin'));
