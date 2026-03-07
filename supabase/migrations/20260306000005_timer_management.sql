-- Timer Management System Migration
-- Adds timer state to auction_state and creates RPC functions for timer control

-- Add timer management columns to auction_state
ALTER TABLE public.auction_state
ADD COLUMN IF NOT EXISTS timer_end TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS initial_timer_seconds INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS first_bid_timer_seconds INTEGER DEFAULT 30,
ADD COLUMN IF NOT EXISTS subsequent_bid_timer_seconds INTEGER DEFAULT 15,
ADD COLUMN IF NOT EXISTS is_paused BOOLEAN DEFAULT FALSE,
ADD COLUMN IF NOT EXISTS paused_at TIMESTAMPTZ,
ADD COLUMN IF NOT EXISTS last_bid_at TIMESTAMPTZ;

-- Add columns for current auction flow
ALTER TABLE public.auction_state
ADD COLUMN IF NOT EXISTS current_player_id uuid REFERENCES public.players(id),
ADD COLUMN IF NOT EXISTS current_base_price INTEGER,
ADD COLUMN IF NOT EXISTS current_bid_amount INTEGER,
ADD COLUMN IF NOT EXISTS bid_count INTEGER DEFAULT 0;

-- Create index for efficient timer queries
CREATE INDEX IF NOT EXISTS idx_auction_state_timer_end ON public.auction_state(timer_end);

-- RPC function: Start auction timer
CREATE OR REPLACE FUNCTION public.start_auction_timer(
  p_initial_seconds INTEGER DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_initial INTEGER;
BEGIN
  IF p_initial_seconds IS NOT NULL THEN
    UPDATE public.auction_state
    SET initial_timer_seconds = p_initial_seconds;
  END IF;

  SELECT initial_timer_seconds INTO v_initial FROM public.auction_state;

  UPDATE public.auction_state
  SET timer_end = now() + (v_initial || ' seconds')::interval,
      is_paused = FALSE,
      paused_at = NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function: Pause auction timer
CREATE OR REPLACE FUNCTION public.pause_auction_timer() RETURNS void AS $$
BEGIN
  UPDATE public.auction_state
  SET is_paused = TRUE,
      paused_at = timer_end;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function: Resume auction timer (adjust timer_end by pause duration)
CREATE OR REPLACE FUNCTION public.resume_auction_timer() RETURNS void AS $$
DECLARE
  v_pause_duration INTERVAL;
BEGIN
  -- Calculate how long timer was paused
  SELECT EXTRACT(EPOCH FROM (paused_at - now())) INTO v_pause_duration
  FROM public.auction_state;

  -- Adjust timer_end by pause duration
  UPDATE public.auction_state
  SET timer_end = timer_end + v_pause_duration,
      is_paused = FALSE,
      paused_at = NULL;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function: Update timer settings
CREATE OR REPLACE FUNCTION public.update_timer_settings(
  p_first_bid_seconds INTEGER,
  p_subsequent_bid_seconds INTEGER
) RETURNS void AS $$
BEGIN
  UPDATE public.auction_state
  SET first_bid_timer_seconds = p_first_bid_seconds,
      subsequent_bid_timer_seconds = p_subsequent_bid_seconds;

  -- If no bids on current player and timer running, restart with new settings
  IF EXISTS (
    SELECT 1 FROM public.auction_state
    WHERE current_player_id IS NOT NULL
      AND bid_count = 0
      AND timer_end > now()
      AND is_paused = FALSE
  ) THEN
    UPDATE public.auction_state
    SET timer_end = now() + (first_bid_timer_seconds || ' seconds')::interval
    WHERE current_player_id IS NOT NULL
      AND bid_count = 0
      AND timer_end > now()
      AND is_paused = FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- RPC function: Check if timer is expired
CREATE OR REPLACE FUNCTION public.is_timer_expired() RETURNS BOOLEAN AS $$
BEGIN
  RETURN EXISTS (
    SELECT 1 FROM public.auction_state
    WHERE timer_end IS NOT NULL
      AND timer_end <= now()
      AND is_paused = FALSE
      AND status IN ('bidding', 'waiting_for_first_bid')
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute permissions on RPC functions
GRANT EXECUTE ON FUNCTION public.start_auction_timer TO authenticated;
GRANT EXECUTE ON FUNCTION public.pause_auction_timer TO authenticated;
GRANT EXECUTE ON FUNCTION public.resume_auction_timer TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_timer_settings TO authenticated;
GRANT EXECUTE ON FUNCTION public.is_timer_expired TO authenticated;
