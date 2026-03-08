-- Add phone_number column to players table
-- Migration: 20260306000006_add_phone_number_column

-- Add phone_number column to players table
ALTER TABLE public.players
ADD COLUMN IF NOT EXISTS phone_number TEXT;

-- Add comment for documentation
COMMENT ON COLUMN public.players.phone_number IS 'Player phone number (10 digits), private field for admin use only';
