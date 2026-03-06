-- Migration: Add team composition validation functions
-- Date: 2026-03-06
-- Description: Add database functions for team composition checks and auction eligibility

-- check_team_composition function
CREATE OR REPLACE FUNCTION check_team_composition(
  p_team_id UUID
) RETURNS JSON AS $$
DECLARE
  v_result JSONB := '{"valid": true}'::jsonb;
  v_roster_count INTEGER;
  v_male_count INTEGER;
  v_female_count INTEGER;
  v_a_plus_count INTEGER;
  v_a_count INTEGER;
  v_b_count INTEGER;
  v_f_count INTEGER;
  v_captain_count INTEGER;
BEGIN
  -- Count total roster (excluding captains)
  SELECT COUNT(*) INTO v_roster_count
  FROM players
  WHERE sold_to_team_id = p_team_id AND is_captain = FALSE;

  -- Count by gender
  SELECT
    COUNT(*) FILTER (WHERE gender = 'Male') INTO v_male_count,
    COUNT(*) FILTER (WHERE gender = 'Female') INTO v_female_count
  FROM players
  WHERE sold_to_team_id = p_team_id AND is_captain = FALSE;

  -- Count by category
  SELECT
    COUNT(*) FILTER (WHERE category = 'A+') INTO v_a_plus_count,
    COUNT(*) FILTER (WHERE category = 'A') INTO v_a_count,
    COUNT(*) FILTER (WHERE category = 'B') INTO v_b_count,
    COUNT(*) FILTER (WHERE category = 'F') INTO v_f_count
  FROM players
  WHERE sold_to_team_id = p_team_id AND is_captain = FALSE;

  -- Count captains
  SELECT COUNT(*) INTO v_captain_count
  FROM players
  WHERE captain_team_id = p_team_id;

  -- Validate roster limits
  IF v_roster_count >= 8 THEN
    v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
    v_result := jsonb_set(v_result, '{reason}', '"Roster full (max 8 players excluding captain)"'::jsonb);
    RETURN v_result;
  END IF;

  IF v_male_count >= 7 THEN
    v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
    v_result := jsonb_set(v_result, '{reason}', '"Male roster full (max 7)"'::jsonb);
    RETURN v_result;
  END IF;

  IF v_female_count >= 2 THEN
    v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
    v_result := jsonb_set(v_result, '{reason}', '"Female roster full (max 2)"'::jsonb);
    RETURN v_result;
  END IF;

  IF v_a_plus_count >= 1 THEN
    v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
    v_result := jsonb_set(v_result, '{reason}', '"A+ category full (max 1)"'::jsonb);
    RETURN v_result;
  END IF;

  IF v_a_count >= 3 THEN
    v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
    v_result := jsonb_set(v_result, '{reason}', '"A category full (max 3)"'::jsonb);
    RETURN v_result;
  END IF;

  IF v_b_count >= 4 THEN
    v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
    v_result := jsonb_set(v_result, '{reason}', '"B category full (max 4)"'::jsonb);
    RETURN v_result;
  END IF;

  IF v_f_count >= 1 THEN
    v_result := jsonb_set(v_result, '{valid}', 'false'::jsonb);
    v_result := jsonb_set(v_result, '{reason}', '"F category full (max 1)"'::jsonb);
    RETURN v_result;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- can_deploy_player_for_auction function
CREATE OR REPLACE FUNCTION can_deploy_player_for_auction(
  p_player_id UUID
) RETURNS JSON AS $$
DECLARE
  v_player players%ROWTYPE;
  v_result JSONB := '{"can_deploy": true}'::jsonb;
BEGIN
  -- Get player info
  SELECT * INTO v_player FROM players WHERE id = p_player_id;

  -- Check if captain
  IF v_player.is_captain = TRUE THEN
    v_result := jsonb_set(v_result, '{can_deploy}', 'false'::jsonb);
    v_result := jsonb_set(v_result, '{reason}', '"Captains cannot be deployed to auction"'::jsonb);
    RETURN v_result;
  END IF;

  -- Check if sold
  IF v_player.is_sold = TRUE THEN
    v_result := jsonb_set(v_result, '{can_deploy}', 'false'::jsonb);
    v_result := jsonb_set(v_result, '{reason}', '"Player already sold"'::jsonb);
    RETURN v_result;
  END IF;

  RETURN v_result;
END;
$$ LANGUAGE plpgsql;

-- Add comments for documentation
COMMENT ON FUNCTION check_team_composition IS 'Validates team composition limits (roster size, gender, category)';
COMMENT ON FUNCTION can_deploy_player_for_auction IS 'Checks if player is eligible for auction deployment (not captain, not sold)';
