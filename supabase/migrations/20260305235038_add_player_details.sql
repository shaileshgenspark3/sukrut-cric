-- Add detailed player information columns
-- Migration: 20260305235038_add_player_details

-- Add new columns to players table
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS age INTEGER,
ADD COLUMN IF NOT EXISTS height TEXT,
ADD COLUMN IF NOT EXISTS handy TEXT,
ADD COLUMN IF NOT EXISTS type TEXT,
ADD COLUMN IF NOT EXISTS earlier_seasons TEXT,
ADD COLUMN IF NOT EXISTS achievements TEXT,
ADD COLUMN IF NOT EXISTS special_remarks TEXT;

-- Add comments for documentation
COMMENT ON COLUMN public.players.age IS 'Player age in years';
COMMENT ON COLUMN public.players.height IS 'Player height (e.g., 5''8" or 175cm)';
COMMENT ON COLUMN public.players.handy IS 'Batting/bowling hand (e.g., Right-hand, Left-hand, Right-arm, Left-arm)';
COMMENT ON COLUMN public.players.type IS 'Batting type/order (e.g., Top-order, Middle-order, Opener, Finisher)';
COMMENT ON COLUMN public.players.earlier_seasons IS 'Previous seasons played';
COMMENT ON COLUMN public.players.achievements IS 'Notable achievements or awards';
COMMENT ON COLUMN public.players.special_remarks IS 'Additional notes or special remarks';
