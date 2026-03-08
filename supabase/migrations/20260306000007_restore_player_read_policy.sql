-- Migration: Fix RLS policy to allow INSERT operations on players table
-- Date: 2026-03-08
-- Description: The "Core admins can manage players" policy created in migration 20260306000000
-- only has a USING clause (for SELECT) but is missing the WITH CHECK clause (for INSERT).
-- This blocks all INSERT operations, preventing players from being created.
-- This migration fixes the policy by adding WITH CHECK clause.

-- Drop the incomplete policy
DROP POLICY IF EXISTS "Core admins can manage players" ON public.players;

-- Recreate with both USING and WITH CHECK clauses
CREATE POLICY "Core admins can manage players" ON public.players
FOR ALL
USING (has_role(auth.uid(), 'core_admin'))
WITH CHECK (has_role(auth.uid(), 'core_admin'));

-- Verify the policy is correct for other tables too
DROP POLICY IF EXISTS "Core admins can manage teams" ON public.teams;
CREATE POLICY "Core admins can manage teams" ON public.teams
FOR ALL
USING (has_role(auth.uid(), 'core_admin'))
WITH CHECK (has_role(auth.uid(), 'core_admin'));

DROP POLICY IF EXISTS "Core admins can manage auction_rules" ON public.auction_rules;
CREATE POLICY "Core admins can manage auction_rules" ON public.auction_rules
FOR ALL
USING (has_role(auth.uid(), 'core_admin'))
WITH CHECK (has_role(auth.uid(), 'core_admin'));

DROP POLICY IF EXISTS "Core admins can manage auction_state" ON public.auction_state;
CREATE POLICY "Core admins can manage auction_state" ON public.auction_state
FOR ALL
USING (has_role(auth.uid(), 'core_admin'))
WITH CHECK (has_role(auth.uid(), 'core_admin'));

DROP POLICY IF EXISTS "Core admins can manage bids" ON public.bids;
CREATE POLICY "Core admins can manage bids" ON public.bids
FOR ALL
USING (has_role(auth.uid(), 'core_admin'))
WITH CHECK (has_role(auth.uid(), 'core_admin'));

DROP POLICY IF EXISTS "Core admins can manage roles" ON public.user_roles;
CREATE POLICY "Core admins can manage roles" ON public.user_roles
FOR ALL
USING (has_role(auth.uid(), 'core_admin'))
WITH CHECK (has_role(auth.uid(), 'core_admin'));
