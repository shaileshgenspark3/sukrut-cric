import { supabase } from "@/lib/supabase";

export interface TeamCompositionResult {
  valid: boolean;
  reason?: string;
  roster: {
    total: number;
    male: number;
    female: number;
    byCategory: {
      "A+": number;
      A: number;
      B: number;
      F: number;
    };
  };
}

export async function validateTeamComposition(teamId: string): Promise<TeamCompositionResult> {
  // Get roster composition
  const { data: roster } = await supabase
    .from("players")
    .select("gender, category")
    .eq("sold_to_team_id", teamId)
    .eq("is_captain", false);

  if (!roster) {
    throw new Error("Failed to fetch roster");
  }

  // Calculate composition
  const composition = {
    total: roster.length,
    male: roster.filter(p => p.gender === "Male").length,
    female: roster.filter(p => p.gender === "Female").length,
    byCategory: {
      "A+": roster.filter(p => p.category === "A+").length,
      A: roster.filter(p => p.category === "A").length,
      B: roster.filter(p => p.category === "B").length,
      F: roster.filter(p => p.category === "F").length,
    }
  };

  // Validate limits
  if (composition.total >= 8) {
    return { valid: false, reason: "Roster full (max 8 players excluding captain)", roster: composition };
  }

  if (composition.male >= 7) {
    return { valid: false, reason: "Male roster full (max 7)", roster: composition };
  }

  if (composition.female >= 2) {
    return { valid: false, reason: "Female roster full (max 2)", roster: composition };
  }

  if (composition.byCategory["A+"] >= 1) {
    return { valid: false, reason: "A+ category full (max 1)", roster: composition };
  }

  if (composition.byCategory.A >= 3) {
    return { valid: false, reason: "A category full (max 3)", roster: composition };
  }

  if (composition.byCategory.B >= 4) {
    return { valid: false, reason: "B category full (max 4)", roster: composition };
  }

  if (composition.byCategory.F >= 1) {
    return { valid: false, reason: "F category full (max 1)", roster: composition };
  }

  return { valid: true, roster: composition };
}

export async function canAddPlayerToTeam(teamId: string, player: { gender: string; category: string }): Promise<boolean> {
  const validation = await validateTeamComposition(teamId);

  if (!validation.valid) {
    // Check if adding this specific player would violate rules
    const wouldExceedTotal = validation.roster.total + 1 > 8;
    const wouldExceedMale = player.gender === "Male" && validation.roster.male >= 7;
    const wouldExceedFemale = player.gender === "Female" && validation.roster.female >= 2;
    const wouldExceedAPlus = player.category === "A+" && validation.roster.byCategory["A+"] >= 1;
    const wouldExceedA = player.category === "A" && validation.roster.byCategory.A >= 3;
    const wouldExceedB = player.category === "B" && validation.roster.byCategory.B >= 4;
    const wouldExceedF = player.category === "F" && validation.roster.byCategory.F >= 1;

    if (wouldExceedTotal || wouldExceedMale || wouldExceedFemale ||
        wouldExceedAPlus || wouldExceedA || wouldExceedB || wouldExceedF) {
      return false;
    }
  }

  return true;
}

export async function isPlayerEligibleForAuction(playerId: string): Promise<boolean> {
  const { data: player } = await supabase
    .from("players")
    .select("is_captain, is_sold")
    .eq("id", playerId)
    .single();

  if (!player) {
    throw new Error("Player not found");
  }

  // Captains and sold players are not eligible
  return !player.is_captain && !player.is_sold;
}
