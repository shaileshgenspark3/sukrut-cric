-- Migration: Add ON DELETE CASCADE to bids foreign key
-- Date: 2026-03-08
-- Description: This migration updates the player_id foreign key in the bids table
-- to use ON DELETE CASCADE, allowing players to be deleted when they have bids.

-- Drop the existing foreign key constraint
ALTER TABLE public.bids
DROP CONSTRAINT bids_player_id_fkey;

-- Re-add the constraint with ON DELETE CASCADE
ALTER TABLE public.bids
ADD CONSTRAINT bids_player_id_fkey
FOREIGN KEY (player_id)
REFERENCES public.players(id)
ON DELETE CASCADE;

-- Add comment to document the cascade behavior
COMMENT ON CONSTRAINT bids_player_id_fkey ON public.bids IS 'Foreign key to players table with cascade delete - when a player is deleted, all related bids are automatically deleted';
