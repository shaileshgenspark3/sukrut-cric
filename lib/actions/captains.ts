"use server";

import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { validateTeamComposition, canAddPlayerToTeam } from "@/lib/validation/teamComposition";

async function getCaptainDeductionForCategory(category: string | null | undefined): Promise<number> {
  if (category === "A+") {
    const { data: settings } = await supabase
      .from("tournament_settings")
      .select("base_price_a_plus")
      .single();

    return settings?.base_price_a_plus ?? 500000;
  }

  if (category === "A") {
    const { data: settings } = await supabase
      .from("tournament_settings")
      .select("base_price_a")
      .single();

    return settings?.base_price_a ?? 200000;
  }

  return 0;
}

export async function assignCaptain(teamId: string, playerId: string) {
  // Get player info
  const { data: player } = await supabase
    .from("players")
    .select("category, gender, name, is_sold, is_captain, sold_to_team_id")
    .eq("id", playerId)
    .single();

  if (!player) {
    throw new Error("Player not found");
  }

  // Get team info
  const { data: team } = await supabase
    .from("teams")
    .select("team_name, captain_player_id")
    .eq("id", teamId)
    .single();

  if (!team) {
    throw new Error("Team not found");
  }

  if (player.is_captain || player.is_sold || player.sold_to_team_id) {
    throw new Error("Selected player is already assigned and cannot become captain");
  }

  if (team.captain_player_id) {
    throw new Error("Team already has a captain. Remove the current captain first.");
  }

  // Calculate captain deduction based on configured pricing
  const deduction = await getCaptainDeductionForCategory(player.category);

  const { data: rules } = await supabase
    .from("auction_rules")
    .select("current_purse, captain_deduction")
    .eq("team_id", teamId)
    .single();

  if (!rules) {
    throw new Error("Auction rules not found for team");
  }

  const previousCaptainDeduction = rules.captain_deduction || 0;
  const newPurse = rules.current_purse + previousCaptainDeduction - deduction;
  if (newPurse < 0) {
    throw new Error("Insufficient purse for captain deduction");
  }

  // Check if adding this captain would violate roster limits
  const canAdd = await canAddPlayerToTeam(teamId, {
    gender: player.gender,
    category: player.category
  });

  if (!canAdd) {
    const validation = await validateTeamComposition(teamId);
    throw new Error(`Cannot add captain: ${validation.reason}`);
  }

  let playerUpdated = false;
  let teamUpdated = false;

  try {
    // 1. Update player to mark as captain and link to team
    const { error: playerError } = await supabase
      .from("players")
      .update({
        is_captain: true,
        captain_team_id: teamId,
        sold_to_team_id: teamId,
        sold_price: 0,
        is_sold: true,
      })
      .eq("id", playerId);

    if (playerError) {
      throw new Error("Failed to update player: " + playerError.message);
    }
    playerUpdated = true;

    // 2. Update team to link captain
    const { error: teamError } = await supabase
      .from("teams")
      .update({ captain_player_id: playerId })
      .eq("id", teamId);

    if (teamError) {
      throw new Error("Failed to update team: " + teamError.message);
    }
    teamUpdated = true;

    // 3. Update auction_rules to deduct captain amount and update current_purse
    const { error: rulesError } = await supabase
      .from("auction_rules")
      .update({
        captain_deduction: deduction,
        current_purse: newPurse
      })
      .eq("team_id", teamId);

    if (rulesError) {
      throw new Error("Failed to update auction rules: " + rulesError.message);
    }
  } catch (error) {
    if (teamUpdated) {
      await supabase.from("teams").update({ captain_player_id: null }).eq("id", teamId);
    }

    if (playerUpdated) {
      await supabase
        .from("players")
        .update({
          is_captain: false,
          captain_team_id: null,
          sold_to_team_id: null,
          sold_price: null,
          is_sold: false,
        })
        .eq("id", playerId);
    }

    throw error;
  }

  revalidatePath("/admin");
  revalidatePath("/captain");

  return { success: true, newPurse };
}

export async function removeCaptain(teamId: string) {
  // Get current captain info
  const { data: team } = await supabase
    .from("teams")
    .select("captain_player_id")
    .eq("id", teamId)
    .single();

  const { data: rules } = await supabase
    .from("auction_rules")
    .select("current_purse, captain_deduction")
    .eq("team_id", teamId)
    .single();

  if (!rules) {
    throw new Error("Auction rules not found for team");
  }

  if (!team?.captain_player_id) {
    if ((rules.captain_deduction || 0) > 0) {
      const restoredPurse = rules.current_purse + rules.captain_deduction;

      const { error: rulesError } = await supabase
        .from("auction_rules")
        .update({
          captain_deduction: 0,
          current_purse: restoredPurse,
        })
        .eq("team_id", teamId);

      if (rulesError) {
        throw new Error("Failed to restore stale captain deduction: " + rulesError.message);
      }

      revalidatePath("/admin");
      revalidatePath("/captain");

      return { success: true, newPurse: restoredPurse };
    }

    return { success: true, newPurse: rules.current_purse };
  }

  const { data: player } = await supabase
    .from("players")
    .select("category")
    .eq("id", team.captain_player_id)
    .single();

  if (!player) {
    throw new Error("Captain player not found");
  }

  const refund = rules.captain_deduction || await getCaptainDeductionForCategory(player.category);
  const restoredPurse = rules.current_purse + refund;

  let playerRestored = false;
  let teamCleared = false;

  try {
    // Restore player status
    const { error: playerError } = await supabase
      .from("players")
      .update({
        is_captain: false,
        captain_team_id: null,
        sold_to_team_id: null,
        sold_price: null,
        is_sold: false
      })
      .eq("id", team.captain_player_id);

    if (playerError) {
      throw new Error("Failed to restore player: " + playerError.message);
    }
    playerRestored = true;

    // Update team
    const { error: teamError } = await supabase
      .from("teams")
      .update({ captain_player_id: null })
      .eq("id", teamId);

    if (teamError) {
      throw new Error("Failed to update team: " + teamError.message);
    }
    teamCleared = true;

    // Restore purse
    const { error: rulesError } = await supabase
      .from("auction_rules")
      .update({
        captain_deduction: 0,
        current_purse: restoredPurse
      })
      .eq("team_id", teamId);

    if (rulesError) {
      throw new Error("Failed to restore purse: " + rulesError.message);
    }
  } catch (error) {
    if (teamCleared) {
      await supabase.from("teams").update({ captain_player_id: team.captain_player_id }).eq("id", teamId);
    }

    if (playerRestored) {
      await supabase
        .from("players")
        .update({
          is_captain: true,
          captain_team_id: teamId,
          sold_to_team_id: teamId,
          sold_price: 0,
          is_sold: true,
        })
        .eq("id", team.captain_player_id);
    }

    throw error;
  }

  revalidatePath("/admin");
  revalidatePath("/captain");

  return { success: true, newPurse: restoredPurse };
}
