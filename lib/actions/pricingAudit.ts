"use server";

import { supabaseAdmin as supabase } from "@/lib/supabase-admin";

export interface PricingAuditIssue {
  severity: "error" | "warning";
  code: string;
  message: string;
  teamId?: string;
  teamName?: string;
  playerId?: string;
  playerName?: string;
}

export interface PricingAuditResult {
  success: true;
  ok: boolean;
  checkedAt: string;
  tournamentPurse: number;
  totals: {
    teams: number;
    players: number;
    rules: number;
    activeLogs: number;
  };
  issues: PricingAuditIssue[];
}

function getConfiguredCaptainDeduction(
  category: string | null | undefined,
  settings: {
    base_price_a_plus?: number | null;
    base_price_a?: number | null;
  } | null
): number {
  if (category === "A+") {
    return settings?.base_price_a_plus ?? 500000;
  }

  if (category === "A") {
    return settings?.base_price_a ?? 200000;
  }

  return 0;
}

export async function runPricingAudit(): Promise<PricingAuditResult> {
  const [
    settingsResult,
    teamsResult,
    playersResult,
    rulesResult,
    auctionStateResult,
    logsResult,
  ] = await Promise.all([
    supabase
      .from("tournament_settings")
      .select("global_purse, base_price_a_plus, base_price_a, base_price_b, base_price_f")
      .single(),
    supabase.from("teams").select("id, team_name, captain_player_id"),
    supabase.from("players").select(
      "id, name, category, base_price, is_sold, sold_price, is_captain, sold_to_team_id, captain_team_id"
    ),
    supabase.from("auction_rules").select("team_id, starting_purse, current_purse, captain_deduction"),
    supabase
      .from("auction_state")
      .select("current_player_id, current_base_price, current_bid_amount, status")
      .single(),
    supabase
      .from("auction_log")
      .select("id, player_id, status, sale_price, deleted")
      .eq("deleted", false),
  ]);

  if (settingsResult.error) {
    throw new Error(`Failed to load tournament settings: ${settingsResult.error.message}`);
  }
  if (teamsResult.error) {
    throw new Error(`Failed to load teams: ${teamsResult.error.message}`);
  }
  if (playersResult.error) {
    throw new Error(`Failed to load players: ${playersResult.error.message}`);
  }
  if (rulesResult.error) {
    throw new Error(`Failed to load auction rules: ${rulesResult.error.message}`);
  }
  if (auctionStateResult.error) {
    throw new Error(`Failed to load auction state: ${auctionStateResult.error.message}`);
  }
  if (logsResult.error) {
    throw new Error(`Failed to load auction logs: ${logsResult.error.message}`);
  }

  const settings = settingsResult.data;
  const teams = teamsResult.data || [];
  const players = playersResult.data || [];
  const rules = rulesResult.data || [];
  const auctionState = auctionStateResult.data;
  const logs = logsResult.data || [];

  const playersById = new Map(players.map((player) => [player.id, player]));
  const rulesByTeamId = new Map(rules.map((rule) => [rule.team_id, rule]));
  const issues: PricingAuditIssue[] = [];

  if (auctionState?.current_player_id) {
    const currentPlayer = playersById.get(auctionState.current_player_id);

    if (!currentPlayer) {
      issues.push({
        severity: "error",
        code: "auction_state_missing_player",
        message: "Auction state points to a missing current player.",
      });
    } else if (auctionState.current_base_price !== currentPlayer.base_price) {
      issues.push({
        severity: "error",
        code: "auction_state_base_price_mismatch",
        message: `Auction state base price does not match ${currentPlayer.name}.`,
        playerId: currentPlayer.id,
        playerName: currentPlayer.name,
      });
    }
  }

  for (const player of players) {
    if (player.is_sold && !player.sold_to_team_id) {
      issues.push({
        severity: "error",
        code: "sold_player_missing_team",
        message: `${player.name} is marked sold without a team assignment.`,
        playerId: player.id,
        playerName: player.name,
      });
    }

    if (player.is_captain) {
      if (![0, null].includes(player.sold_price)) {
        issues.push({
          severity: "warning",
          code: "captain_unexpected_price",
          message: `${player.name} is a captain but has unexpected sold price ₹${player.sold_price?.toLocaleString()}.`,
          playerId: player.id,
          playerName: player.name,
        });
      }

      if (player.captain_team_id !== player.sold_to_team_id) {
        issues.push({
          severity: "error",
          code: "captain_team_mismatch",
          message: `${player.name} has mismatched captain and roster team assignments.`,
          playerId: player.id,
          playerName: player.name,
        });
      }
    }
  }

  for (const team of teams) {
    const rule = rulesByTeamId.get(team.id);

    if (!rule) {
      issues.push({
        severity: "error",
        code: "missing_rules_row",
        message: `${team.team_name} is missing an auction rules row.`,
        teamId: team.id,
        teamName: team.team_name,
      });
      continue;
    }

    const startingPurse = rule.starting_purse ?? settings?.global_purse ?? 0;
    const currentPurse = rule.current_purse ?? 0;
    const captainDeduction = rule.captain_deduction ?? 0;

    if (currentPurse > startingPurse) {
      issues.push({
        severity: "warning",
        code: "purse_exceeds_starting_purse",
        message: `${team.team_name} has current purse above starting purse.`,
        teamId: team.id,
        teamName: team.team_name,
      });
    }

    if (captainDeduction > 0 && !team.captain_player_id) {
      issues.push({
        severity: "error",
        code: "stale_captain_deduction",
        message: `${team.team_name} has captain deduction without a selected captain.`,
        teamId: team.id,
        teamName: team.team_name,
      });
    }

    if (team.captain_player_id) {
      const captain = playersById.get(team.captain_player_id);

      if (!captain) {
        issues.push({
          severity: "error",
          code: "captain_player_missing",
          message: `${team.team_name} points to a missing captain player.`,
          teamId: team.id,
          teamName: team.team_name,
        });
        continue;
      }

      if (!captain.is_captain) {
        issues.push({
          severity: "error",
          code: "captain_flag_missing",
          message: `${team.team_name} captain ${captain.name} is not marked as captain.`,
          teamId: team.id,
          teamName: team.team_name,
          playerId: captain.id,
          playerName: captain.name,
        });
      }

      if (captain.sold_to_team_id !== team.id) {
        issues.push({
          severity: "error",
          code: "captain_roster_mismatch",
          message: `${team.team_name} captain ${captain.name} is not assigned to the same team roster.`,
          teamId: team.id,
          teamName: team.team_name,
          playerId: captain.id,
          playerName: captain.name,
        });
      }

      const expectedCaptainDeduction = getConfiguredCaptainDeduction(captain.category, settings);
      if (captainDeduction !== expectedCaptainDeduction) {
        issues.push({
          severity: "warning",
          code: "captain_deduction_config_mismatch",
          message: `${team.team_name} captain deduction does not match current configured captain pricing.`,
          teamId: team.id,
          teamName: team.team_name,
          playerId: captain.id,
          playerName: captain.name,
        });
      }
    }
  }

  for (const log of logs) {
    if ((log.status === "sold" || log.status === "manual") && log.sale_price == null) {
      issues.push({
        severity: "error",
        code: "completed_sale_missing_price",
        message: `Completed sale log ${log.id} is missing sale price.`,
        playerId: log.player_id,
      });
    }
  }

  return {
    success: true,
    ok: issues.length === 0,
    checkedAt: new Date().toISOString(),
    tournamentPurse: settings?.global_purse ?? 0,
    totals: {
      teams: teams.length,
      players: players.length,
      rules: rules.length,
      activeLogs: logs.length,
    },
    issues,
  };
}
