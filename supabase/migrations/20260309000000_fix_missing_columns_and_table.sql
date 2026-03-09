-- Migration: Fix missing tournament_settings columns and create dashboard_presence table
-- Date: 2026-03-09
-- Description: Add max_total_players, timer settings, and create dashboard_presence table

-- Add missing max_total_players column to tournament_settings
ALTER TABLE public.tournament_settings
  ADD COLUMN IF NOT EXISTS max_total_players INTEGER NOT NULL DEFAULT 9;

-- Add timer settings columns
ALTER TABLE public.tournament_settings
  ADD COLUMN IF NOT EXISTS first_bid_timer_seconds INTEGER NOT NULL DEFAULT 30,
  ADD COLUMN IF NOT EXISTS subsequent_bid_timer_seconds INTEGER NOT NULL DEFAULT 20;

-- Create dashboard_presence table for tracking live dashboard users
CREATE TABLE IF NOT EXISTS public.dashboard_presence (
  session_id TEXT PRIMARY KEY,
  last_seen TIMESTAMPTZ NOT NULL,
  user_agent TEXT,
  created_at TIMESTAMPTZ NOT NULL DEFAULT now()
);

-- Enable RLS on dashboard_presence
ALTER TABLE public.dashboard_presence ENABLE ROW LEVEL SECURITY;

-- Allow public read/write for dashboard_presence (presence tracking is public)
CREATE POLICY "Public can view dashboard presence" ON public.dashboard_presence
  FOR SELECT USING (true);

CREATE POLICY "Public can upsert dashboard presence" ON public.dashboard_presence
  FOR INSERT WITH CHECK (true);

CREATE POLICY "Public can delete dashboard presence" ON public.dashboard_presence
  FOR DELETE USING (true);

-- Create index for efficient cleanup
CREATE INDEX IF NOT EXISTS dashboard_presence_last_seen_idx ON public.dashboard_presence(last_seen);

-- Add comments for documentation
COMMENT ON COLUMN public.tournament_settings.max_total_players IS 'Maximum total players per team (including captain)';
COMMENT ON COLUMN public.tournament_settings.first_bid_timer_seconds IS 'Timer for first bid (seconds)';
COMMENT ON COLUMN public.tournament_settings.subsequent_bid_timer_seconds IS 'Timer for subsequent bids (seconds)';
COMMENT ON TABLE public.dashboard_presence IS 'Tracks live dashboard viewer sessions';
