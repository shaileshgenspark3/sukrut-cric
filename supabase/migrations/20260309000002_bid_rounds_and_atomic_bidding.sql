-- Migration: add auction rounds and atomic live bid placement
-- Date: 2026-03-09

ALTER TABLE public.auction_state
  ADD COLUMN IF NOT EXISTS auction_round INTEGER NOT NULL DEFAULT 0;

ALTER TABLE public.bids
  ADD COLUMN IF NOT EXISTS auction_round INTEGER NOT NULL DEFAULT 0;

CREATE INDEX IF NOT EXISTS idx_bids_player_round_created_at
  ON public.bids(player_id, auction_round, created_at DESC);

CREATE OR REPLACE FUNCTION public.place_live_bid(
  p_player_id UUID,
  p_team_id UUID,
  p_bid_amount INTEGER
) RETURNS JSONB AS $$
DECLARE
  v_state public.auction_state%ROWTYPE;
  v_expected_bid INTEGER;
  v_next_timer_seconds INTEGER;
  v_bid_id UUID;
BEGIN
  SELECT *
  INTO v_state
  FROM public.auction_state
  LIMIT 1
  FOR UPDATE;

  IF v_state.id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'Auction state is not initialized');
  END IF;

  IF v_state.current_player_id IS NULL THEN
    RETURN jsonb_build_object('success', false, 'message', 'No player is currently on the auction block');
  END IF;

  IF v_state.current_player_id <> p_player_id THEN
    RETURN jsonb_build_object('success', false, 'message', 'This player is not currently on the auction block');
  END IF;

  IF v_state.status NOT IN ('waiting_for_first_bid', 'bidding') THEN
    RETURN jsonb_build_object('success', false, 'message', 'Auction is not currently accepting bids');
  END IF;

  IF v_state.is_paused THEN
    RETURN jsonb_build_object('success', false, 'message', 'Auction is paused');
  END IF;

  IF v_state.timer_end IS NOT NULL AND v_state.timer_end <= now() THEN
    RETURN jsonb_build_object('success', false, 'message', 'Timer expired. Waiting for admin confirmation before continuing.');
  END IF;

  v_expected_bid := COALESCE(v_state.current_bid_amount, v_state.current_base_price, v_state.current_bid, 0) + 25000;

  IF p_bid_amount <> v_expected_bid THEN
    RETURN jsonb_build_object(
      'success', false,
      'message', format('Invalid bid amount. Expected: ₹%s, Got: ₹%s', to_char(v_expected_bid, 'FM999,999,999,999'), to_char(p_bid_amount, 'FM999,999,999,999'))
    );
  END IF;

  v_next_timer_seconds := COALESCE(v_state.subsequent_bid_timer_seconds, 15);

  INSERT INTO public.bids (
    player_id,
    team_id,
    bid_amount,
    auction_round
  )
  VALUES (
    p_player_id,
    p_team_id,
    p_bid_amount,
    v_state.auction_round
  )
  RETURNING id INTO v_bid_id;

  UPDATE public.auction_state
  SET current_bid = p_bid_amount,
      current_bid_amount = p_bid_amount,
      current_bidder_team_id = p_team_id,
      bid_count = COALESCE(v_state.bid_count, 0) + 1,
      status = 'bidding',
      timer_end = now() + make_interval(secs => v_next_timer_seconds),
      is_paused = FALSE,
      paused_at = NULL,
      last_bid_at = now(),
      updated_at = now()
  WHERE id = v_state.id;

  RETURN jsonb_build_object(
    'success', true,
    'message', 'Bid placed successfully',
    'bidId', v_bid_id,
    'auctionRound', v_state.auction_round
  );
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

GRANT EXECUTE ON FUNCTION public.place_live_bid(UUID, UUID, INTEGER) TO authenticated;
