import { supabase } from "@/lib/supabase";

export interface BidValidationResult {
  valid: boolean;
  maxBid: number;
  reason?: string;
}

export interface RosterStatus {
  total: number;
  male: number;
  female: number;
  byCategory: Record<string, number>;
  maxMale: number;
  maxFemale: number;
  maxTotal: number;
  availableMaleSlots: number;
  availableFemaleSlots: number;
}

export interface CategoryBasePrices {
  "A+": number;
  A: number;
  B: number;
  F: number;
}

export async function getCategoryBasePrices(): Promise<CategoryBasePrices> {
  const { data: settings, error } = await supabase
    .from("tournament_settings")
    .select("base_price_a_plus, base_price_a, base_price_b, base_price_f")
    .single();

  if (error || !settings) {
    return {
      "A+": 500000,
      A: 200000,
      B: 100000,
      F: 50000,
    };
  }

  return {
    "A+": settings.base_price_a_plus || 500000,
    A: settings.base_price_a || 200000,
    B: settings.base_price_b || 100000,
    F: settings.base_price_f || 50000,
  };
}

export async function getRosterStatus(teamId: string): Promise<RosterStatus> {
  const { data: settings } = await supabase
    .from("tournament_settings")
    .select("max_male_players, max_female_players, max_total_players")
    .single();

  const maxMale = settings?.max_male_players ?? 7;
  const maxFemale = settings?.max_female_players ?? 2;
  const maxTotal = settings?.max_total_players ?? 8;

  const { data: roster } = await supabase
    .from("players")
    .select("gender, category, sold_price")
    .eq("sold_to_team_id", teamId)
    .eq("is_sold", true)
    .eq("is_captain", false);

  if (!roster) {
    return {
      total: 0,
      male: 0,
      female: 0,
      byCategory: { "A+": 0, A: 0, B: 0, F: 0 },
      maxMale,
      maxFemale,
      maxTotal,
      availableMaleSlots: maxMale,
      availableFemaleSlots: maxFemale,
    };
  }

  const male = roster.filter((p) => p.gender === "Male").length;
  const female = roster.filter((p) => p.gender === "Female").length;

  const byCategory: Record<string, number> = {
    "A+": 0,
    A: 0,
    B: 0,
    F: 0,
  };

  roster.forEach((p) => {
    if (byCategory[p.category] !== undefined) {
      byCategory[p.category]++;
    }
  });

  return {
    total: roster.length,
    male,
    female,
    byCategory,
    maxMale,
    maxFemale,
    maxTotal,
    availableMaleSlots: Math.max(0, maxMale - male),
    availableFemaleSlots: Math.max(0, maxFemale - female),
  };
}

export async function calculateMaxBid(
  teamId: string,
  playerGender: string
): Promise<number> {
  const { data: rules } = await supabase
    .from("auction_rules")
    .select("current_purse")
    .eq("team_id", teamId)
    .single();

  if (!rules) {
    return 0;
  }

  const currentPurse = rules.current_purse || 0;
  const roster = await getRosterStatus(teamId);
  const basePrices = await getCategoryBasePrices();
  const nextMaleCount = roster.male + (playerGender === "Male" ? 1 : 0);
  const nextFemaleCount = roster.female + (playerGender === "Female" ? 1 : 0);
  const nextTotalCount = roster.total + 1;

  if (nextMaleCount > roster.maxMale || nextFemaleCount > roster.maxFemale || nextTotalCount > roster.maxTotal) {
    return 0;
  }

  const remainingTotalSlots = Math.max(0, roster.maxTotal - nextTotalCount);
  const remainingMaleSlots = Math.max(0, roster.maxMale - nextMaleCount);
  const remainingFemaleSlots = Math.max(0, roster.maxFemale - nextFemaleCount);

  const reserveFemaleSlots = Math.min(remainingFemaleSlots, remainingTotalSlots);
  const reserveMaleSlots = Math.max(0, remainingTotalSlots - reserveFemaleSlots);

  if (reserveMaleSlots > remainingMaleSlots) {
    return 0;
  }

  const requiredPurseForRemainingSlots =
    reserveMaleSlots * basePrices.B +
    reserveFemaleSlots * basePrices.F;

  return Math.max(0, currentPurse - requiredPurseForRemainingSlots);
}

export async function validateBid(
  teamId: string,
  playerId: string,
  bidAmount: number
): Promise<BidValidationResult> {
  const { data: player } = await supabase
    .from("players")
    .select("category, gender")
    .eq("id", playerId)
    .single();

  if (!player) {
    return { valid: false, maxBid: 0, reason: "Player not found" };
  }

  const { data: rules } = await supabase
    .from("auction_rules")
    .select("current_purse")
    .eq("team_id", teamId)
    .single();

  if (!rules) {
    return { valid: false, maxBid: 0, reason: "Team rules not found" };
  }

  if (rules.current_purse < bidAmount) {
    return {
      valid: false,
      maxBid: rules.current_purse,
      reason: `Insufficient purse. Available: ₹${rules.current_purse.toLocaleString()}`,
    };
  }

  const maxBid = await calculateMaxBid(teamId, player.gender);

  if (bidAmount > maxBid) {
    return {
      valid: false,
      maxBid,
      reason: `Bid exceeds maximum allowed (₹${maxBid.toLocaleString()})`,
    };
  }

  return { valid: true, maxBid };
}

export async function getTeamEligibility(
  teamId: string,
  playerId: string
): Promise<{ canBid: boolean; maxBid: number; reasons: string[] }> {
  const reasons: string[] = [];

  const { data: player } = await supabase
    .from("players")
    .select("category, gender")
    .eq("id", playerId)
    .single();

  if (!player) {
    return { canBid: false, maxBid: 0, reasons: ["Player not found"] };
  }

  const { data: rules } = await supabase
    .from("auction_rules")
    .select("current_purse")
    .eq("team_id", teamId)
    .single();

  if (!rules) {
    return { canBid: false, maxBid: 0, reasons: ["Team rules not found"] };
  }

  if (rules.current_purse <= 0) {
    reasons.push("No purse remaining");
  }

  const roster = await getRosterStatus(teamId);
  const maxBid = await calculateMaxBid(teamId, player.gender);

  if (player.gender === "Male" && roster.male >= roster.maxMale) {
    reasons.push(`Maximum male players (${roster.maxMale}) reached`);
  }

  if (player.gender === "Female" && roster.female >= roster.maxFemale) {
    reasons.push(`Maximum female players (${roster.maxFemale}) reached`);
  }

  return {
    canBid: reasons.length === 0,
    maxBid,
    reasons,
  };
}

export interface CategoryEligibilityResult {
  eligible: boolean;
  currentCount: number;
  maxAllowed: number;
  reason?: string;
}

export interface CategoryLimits {
  male: Record<string, number>;
  female: Record<string, number>;
}

export async function getCategoryLimits(): Promise<CategoryLimits> {
  const { data: settings } = await supabase
    .from("tournament_settings")
    .select("max_a_plus_male, max_a_male, max_b_male, max_female")
    .single();

  return {
    male: {
      "A+": settings?.max_a_plus_male ?? 1,
      A: settings?.max_a_male ?? 3,
      B: settings?.max_b_male ?? 4,
    },
    female: {
      F: settings?.max_female ?? 2,
    },
  };
}

export async function checkCategoryEligibility(
  teamId: string,
  playerCategory: string,
  playerGender: string
): Promise<CategoryEligibilityResult> {
  const roster = await getRosterStatus(teamId);
  const limits = await getCategoryLimits();

  if (playerGender === "Male") {
    const maleLimits = limits.male;
    const currentCount = roster.byCategory[playerCategory] || 0;
    const maxAllowed = maleLimits[playerCategory] || 99;

    if (currentCount >= maxAllowed) {
      return {
        eligible: false,
        currentCount,
        maxAllowed,
        reason: `Maximum ${playerCategory} male players (${maxAllowed}) already in roster`,
      };
    }

    return {
      eligible: true,
      currentCount,
      maxAllowed,
    };
  }

  if (playerGender === "Female") {
    const femaleLimits = limits.female;
    const currentCount = roster.byCategory["F"] || 0;
    const maxAllowed = femaleLimits["F"] || 2;

    if (currentCount >= maxAllowed) {
      return {
        eligible: false,
        currentCount,
        maxAllowed,
        reason: `Maximum female players (${maxAllowed}) already in roster`,
      };
    }

    return {
      eligible: true,
      currentCount,
      maxAllowed,
    };
  }

  return {
    eligible: true,
    currentCount: 0,
    maxAllowed: 99,
  };
}

export interface TeamEligibilityStatus {
  teamId: string;
  teamName: string;
  canBid: boolean;
  maxBid: number;
  reasons: string[];
}

export async function getEligibleTeams(playerId: string): Promise<TeamEligibilityStatus[]> {
  const { data: player } = await supabase
    .from("players")
    .select("category, gender")
    .eq("id", playerId)
    .single();

  if (!player) {
    return [];
  }

  const { data: teams } = await supabase.from("teams").select("id, team_name");

  if (!teams) {
    return [];
  }

  const eligibilityPromises = teams.map(async (team) => {
    const eligibility = await getTeamEligibility(team.id, playerId);
    return {
      teamId: team.id,
      teamName: team.team_name,
      canBid: eligibility.canBid,
      maxBid: eligibility.maxBid,
      reasons: eligibility.reasons,
    };
  });

  return Promise.all(eligibilityPromises);
}
