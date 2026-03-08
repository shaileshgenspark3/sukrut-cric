-- Migration: Allow admins to delete players
-- Date: 2026-03-08
-- Description: This migration allows admins to delete players,
-- enabling the delete functionality in the admin dashboard.

-- Drop the existing restrictive policy
DROP POLICY IF EXISTS "Core admins can manage players" ON public.players;

-- Create a new policy that allows admins to manage players
CREATE POLICY "Admins can manage players" ON public.players
FOR ALL
USING (has_role(auth.uid(), 'core_admin'))
WITH CHECK (has_role(auth.uid(), 'core_admin'));
