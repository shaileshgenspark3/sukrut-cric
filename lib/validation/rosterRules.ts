import { supabase } from '@/lib/supabase';

export async function checkRosterLimit(teamId: string): Promise<{ canAdd: boolean; currentCount: number; maxCount: number; errorMessage?: string }> {
  const maxCount = 9;

  // Count current players on team (excluding captains)
  const { data: existingPlayers, error } = await supabase
    .from('players')
    .select('id')
    .eq('sold_to_team_id', teamId)
    .eq('is_captain', false);

  if (error) throw error;

  const currentCount = existingPlayers?.length || 0;
  const canAdd = currentCount < maxCount;

  return {
    canAdd,
    currentCount,
    maxCount,
    errorMessage: canAdd ? undefined : `Cannot add player: Team already has ${currentCount}/${maxCount} players (max 9 allowed)`
  };
}

export async function enforceMaxPlayersPerTeam(teamId: string, playerId?: string): Promise<boolean> {
  const limitCheck = await checkRosterLimit(teamId);

  if (!limitCheck.canAdd) {
    throw new Error(limitCheck.errorMessage);
  }

  return true;
}
