-- Migration: Add base prices and current purse tracking
-- Date: 2026-03-06
-- Description: Add current_purse to auction_rules, base prices to tournament_settings

-- Add current_purse column to auction_rules table
ALTER TABLE public.auction_rules
  ADD COLUMN IF NOT EXISTS current_purse INTEGER NOT NULL DEFAULT 30000;

-- Initialize current_purse from starting_purse for existing rows
UPDATE public.auction_rules
SET current_purse = starting_purse
WHERE current_purse IS NULL OR current_purse = 30000;

-- Add base price columns to tournament_settings table
ALTER TABLE public.tournament_settings
  ADD COLUMN IF NOT EXISTS base_price_A_plus INTEGER NOT NULL DEFAULT 500000,
  ADD COLUMN IF NOT EXISTS base_price_A INTEGER NOT NULL DEFAULT 200000,
  ADD COLUMN IF NOT EXISTS base_price_B INTEGER NOT NULL DEFAULT 100000,
  ADD COLUMN IF NOT EXISTS base_price_F INTEGER NOT NULL DEFAULT 50000;

-- Update existing tournament_settings row with default base prices
UPDATE public.tournament_settings
SET
  base_price_A_plus = 500000,
  base_price_A = 200000,
  base_price_B = 100000,
  base_price_F = 50000
WHERE base_price_A_plus IS NULL;

-- Add comments for documentation
COMMENT ON COLUMN public.auction_rules.current_purse IS 'Current available purse after all deductions (captain, manual)';
COMMENT ON COLUMN public.tournament_settings.base_price_A_plus IS 'Base price for A+ category players (₹5,00,000)';
COMMENT ON COLUMN public.tournament_settings.base_price_A IS 'Base price for A category players (₹2,00,000)';
COMMENT ON COLUMN public.tournament_settings.base_price_B IS 'Base price for B category players (₹1,00,000)';
COMMENT ON COLUMN public.tournament_settings.base_price_F IS 'Base price for F category players (₹50,000)';
