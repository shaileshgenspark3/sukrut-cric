"use server";

import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { validateTeamComposition, canAddPlayerToTeam } from "@/lib/validation/teamComposition";

export async function assignCaptain(teamId: string, playerId: string) {
  // Get player info
  const { data: player } = await supabase
    .from("players")
    .select("category, gender, name")
    .eq("id", playerId)
    .single();

  if (!player) {
    throw new Error("Player not found");
  }

  // Get team info
  const { data: team } = await supabase
    .from("teams")
    .select("team_name")
    .eq("id", teamId)
    .single();

  if (!team) {
    throw new Error("Team not found");
  }

  // Calculate captain deduction based on category
  const deduction = player.category === 'A+' ? 500000 :
                   player.category === 'A' ? 200000 : 0;

  // Check if adding this captain would violate roster limits
  const canAdd = await canAddPlayerToTeam(teamId, {
    gender: player.gender,
    category: player.category
  });

  if (!canAdd) {
    const validation = await validateTeamComposition(teamId);
    throw new Error(`Cannot add captain: ${validation.reason}`);
  }

  // Start transaction-like sequence
  // 1. Update player to mark as captain and link to team
  const { error: playerError } = await supabase
    .from("players")
    .update({
      is_captain: true,
      captain_team_id: teamId,
      sold_to_team_id: teamId,  // Add to roster
      sold_price: 0,  // Captains are free
      is_sold: true  // Mark as sold (cannot be auctioned)
    })
    .eq("id", playerId);

  if (playerError) {
    throw new Error("Failed to update player: " + playerError.message);
  }

  // 2. Update team to link captain
  const { error: teamError } = await supabase
    .from("teams")
    .update({ captain_player_id: playerId })
    .eq("id", teamId);

  if (teamError) {
    throw new Error("Failed to update team: " + teamError.message);
  }

  // 3. Update auction_rules to deduct captain amount and update current_purse
  const { data: rules } = await supabase
    .from("auction_rules")
    .select("current_purse")
    .eq("team_id", teamId)
    .single();

  if (!rules) {
    throw new Error("Auction rules not found for team");
  }

  const newPurse = rules.current_purse - deduction;
  if (newPurse < 0) {
    throw new Error("Insufficient purse for captain deduction");
  }

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

  if (!team?.captain_player_id) {
    return { success: true };
  }

  const { data: player } = await supabase
    .from("players")
    .select("category")
    .eq("id", team.captain_player_id)
    .single();

  if (!player) {
    throw new Error("Captain player not found");
  }

  // Calculate refund amount
  const refund = player.category === 'A+' ? 500000 :
                 player.category === 'A' ? 200000 : 0;

  // Restore player status
  const { error: playerError } = await supabase
    .from("players")
    .update({
      is_captain: false,
      captain_team_id: null,
      sold_to_team_id: null,  // Remove from roster
      sold_price: null,
      is_sold: false
    })
    .eq("id", team.captain_player_id);

  if (playerError) {
    throw new Error("Failed to restore player: " + playerError.message);
  }

  // Update team
  const { error: teamError } = await supabase
    .from("teams")
    .update({ captain_player_id: null })
    .eq("id", teamId);

  if (teamError) {
    throw new Error("Failed to update team: " + teamError.message);
  }

  // Restore purse
  const { data: rules } = await supabase
    .from("auction_rules")
    .select("current_purse")
    .eq("team_id", teamId)
    .single();

  if (!rules) {
    throw new Error("Auction rules not found for team");
  }

  const { error: rulesError } = await supabase
    .from("auction_rules")
    .update({
      captain_deduction: 0,
      current_purse: rules.current_purse + refund
    })
    .eq("team_id", teamId);

  if (rulesError) {
    throw new Error("Failed to restore purse: " + rulesError.message);
  }

  revalidatePath("/admin");
  revalidatePath("/captain");

  return { success: true, newPurse: rules.current_purse + refund };
}
