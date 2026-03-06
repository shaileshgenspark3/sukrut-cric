-- Add banned_teams column to auction_state for team bidding control
ALTER TABLE public.auction_state
ADD COLUMN banned_teams JSONB DEFAULT '[]'::jsonb;

-- Add index for efficient queries on banned teams (optional, may not be needed for JSONB)
-- CREATE INDEX idx_auction_state_banned_teams ON auction_state USING GIN (banned_teams);

-- Comment on the column
COMMENT ON COLUMN public.auction_state.banned_teams IS 'Array of banned team IDs with reasons for current player. Format: [{teamId, playerId, reason, bannedAt}]';
