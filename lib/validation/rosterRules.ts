import { supabase } from '@/lib/supabase';

/**
 * Result type for roster limit check.
 */
export interface RosterLimitCheck {
  canAdd: boolean;
  currentCount: number;
  maxCount: number;
  errorMessage?: string;
}

/**
 * Maximum number of players allowed per team roster (excluding captains).
 * Based on tournament rules: 1 captain + 8 players = 9 total.
 */
const MAX_PLAYERS_PER_TEAM = 9;

/**
 * Check if a team can add another player based on roster size limits.
 *
 * @param teamId - The UUID of the team to check
 * @returns Promise with roster limit check result
 *
 * @example
 * ```typescript
 * const check = await checkRosterLimit(teamId);
 * if (!check.canAdd) {
 *   console.log(check.errorMessage); // "Cannot add player: Team already has 9/9 players (max 9 allowed)"
 * }
 * ```
 */
export async function checkRosterLimit(teamId: string): Promise<RosterLimitCheck> {
  try {
    // Count current players on team (excluding captains)
    const { data: existingPlayers, error } = await supabase
      .from('players')
      .select('id')
      .eq('sold_to_team_id', teamId)
      .eq('is_captain', false);

    if (error) throw error;

    const currentCount = existingPlayers?.length || 0;
    const canAdd = currentCount < MAX_PLAYERS_PER_TEAM;

    return {
      canAdd,
      currentCount,
      maxCount: MAX_PLAYERS_PER_TEAM,
      errorMessage: canAdd ? undefined : `Cannot add player: Team already has ${currentCount}/${MAX_PLAYERS_PER_TEAM} players (max ${MAX_PLAYERS_PER_TEAM} allowed)`
    };
  } catch (error) {
    console.error('Error checking roster limit:', error);
    throw new Error('Failed to check roster limit');
  }
}

/**
 * Enforce max players per team limit.
 * Throws an error if the team has reached the limit.
 *
 * @param teamId - The UUID of the team to check
 * @param playerId - Optional UUID of the player being added (for context)
 * @returns Promise that resolves to true if limit not exceeded
 * @throws Error if team has reached max roster size
 *
 * @example
 * ```typescript
 * try {
 *   await enforceMaxPlayersPerTeam(teamId, playerId);
 *   // Proceed to add player
 * } catch (error) {
 *   // Show error to admin
 *   alert(error.message);
 * }
 * ```
 */
export async function enforceMaxPlayersPerTeam(teamId: string, playerId?: string): Promise<boolean> {
  const limitCheck = await checkRosterLimit(teamId);

  if (!limitCheck.canAdd) {
    throw new Error(limitCheck.errorMessage);
  }

  return true;
}
