-- Migration: Ensure timer RPC functions include WHERE clauses
-- Date: 2026-03-09
-- Fixes PostgREST requirement for UPDATE statements to include a WHERE clause.

CREATE OR REPLACE FUNCTION public.start_auction_timer(
  p_initial_seconds INTEGER DEFAULT NULL
) RETURNS void AS $$
DECLARE
  v_initial INTEGER;
  v_state_id UUID;
BEGIN
  SELECT id INTO v_state_id FROM public.auction_state LIMIT 1;
  IF v_state_id IS NULL THEN
    RAISE EXCEPTION 'auction_state row missing';
  END IF;

  IF p_initial_seconds IS NOT NULL THEN
    UPDATE public.auction_state
    SET initial_timer_seconds = p_initial_seconds
    WHERE id = v_state_id;
  END IF;

  SELECT initial_timer_seconds INTO v_initial
  FROM public.auction_state
  WHERE id = v_state_id;

  UPDATE public.auction_state
  SET timer_end = now() + (v_initial || ' seconds')::interval,
      is_paused = FALSE,
      paused_at = NULL
  WHERE id = v_state_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.pause_auction_timer() RETURNS void AS $$
DECLARE
  v_state_id UUID;
BEGIN
  SELECT id INTO v_state_id FROM public.auction_state LIMIT 1;
  IF v_state_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.auction_state
  SET is_paused = TRUE,
      paused_at = timer_end
  WHERE id = v_state_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.resume_auction_timer() RETURNS void AS $$
DECLARE
  v_state_id UUID;
  v_paused_at TIMESTAMPTZ;
  v_pause_duration INTERVAL;
BEGIN
  SELECT id, paused_at INTO v_state_id, v_paused_at
  FROM public.auction_state
  LIMIT 1;

  IF v_state_id IS NULL OR v_paused_at IS NULL THEN
    RETURN;
  END IF;

  SELECT v_paused_at - now() INTO v_pause_duration;

  UPDATE public.auction_state
  SET timer_end = timer_end + v_pause_duration,
      is_paused = FALSE,
      paused_at = NULL
  WHERE id = v_state_id;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

CREATE OR REPLACE FUNCTION public.update_timer_settings(
  p_first_bid_seconds INTEGER,
  p_subsequent_bid_seconds INTEGER
) RETURNS void AS $$
DECLARE
  v_state_id UUID;
BEGIN
  SELECT id INTO v_state_id FROM public.auction_state LIMIT 1;
  IF v_state_id IS NULL THEN
    RETURN;
  END IF;

  UPDATE public.auction_state
  SET first_bid_timer_seconds = p_first_bid_seconds,
      subsequent_bid_timer_seconds = p_subsequent_bid_seconds
  WHERE id = v_state_id;

  IF EXISTS (
    SELECT 1
    FROM public.auction_state
    WHERE id = v_state_id
      AND current_player_id IS NOT NULL
      AND bid_count = 0
      AND timer_end > now()
      AND is_paused = FALSE
  ) THEN
    UPDATE public.auction_state
    SET timer_end = now() + (first_bid_timer_seconds || ' seconds')::interval
    WHERE id = v_state_id
      AND current_player_id IS NOT NULL
      AND bid_count = 0
      AND timer_end > now()
      AND is_paused = FALSE;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

GRANT EXECUTE ON FUNCTION public.start_auction_timer TO authenticated;
GRANT EXECUTE ON FUNCTION public.pause_auction_timer TO authenticated;
GRANT EXECUTE ON FUNCTION public.resume_auction_timer TO authenticated;
GRANT EXECUTE ON FUNCTION public.update_timer_settings TO authenticated;
