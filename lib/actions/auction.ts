"use server";

import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";
import { clearBansForPlayer } from "@/lib/actions/admin";
import { createLogEntry } from "@/lib/actions/logging";

// Zod schemas for validation
const DeployPlayerSchema = z.object({
  playerId: z.string().uuid("Invalid player ID"),
});

const MarkPlayerUnsoldSchema = z.object({
  playerId: z.string().uuid("Invalid player ID"),
});

const FinalizeSaleSchema = z.object({
  playerId: z.string().uuid("Invalid player ID"),
  teamId: z.string().uuid("Invalid team ID"),
  bidAmount: z.number().int().positive("Bid amount must be positive"),
});

/**
 * Deploy a player to auction
 * Validates player eligibility and updates auction_state
 */
export async function deployPlayer(playerId: string) {
  try {
    const validated = DeployPlayerSchema.parse({ playerId });

    // 1. Validate player exists and is eligible (not sold, not captain)
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("*, team:teams(*)")
      .eq("id", validated.playerId)
      .single();

    if (playerError) {
      throw new Error(`Player not found: ${playerError.message}`);
    }

    if (player.is_sold) {
      throw new Error("Player has already been sold");
    }

    if (player.is_captain) {
      throw new Error("Captains cannot be deployed to auction");
    }

    if (player.sold_to_team_id) {
      throw new Error("Player is already assigned to a team");
    }

    // 2. Get auction_state to determine current state
    const { data: auctionState, error: stateError } = await supabase
      .from("auction_state")
      .select("*")
      .single();

    if (stateError) {
      throw new Error(`Failed to fetch auction state: ${stateError.message}`);
    }

    // 3. Get timer settings
    const { data: settings } = await supabase
      .from("tournament_settings")
      .select("first_bid_timer_seconds, subsequent_bid_timer_seconds")
      .single();

    const timerSeconds = settings?.first_bid_timer_seconds || 30;

    // 4. Update auction_state table
    const { error: updateError } = await supabase
      .from("auction_state")
      .update({
        current_player_id: validated.playerId,
        current_base_price: player.base_price,
        current_bid_amount: player.base_price,
        bid_count: 0,
        status: "waiting_for_first_bid",
        current_bidder_team_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", auctionState.id);

    if (updateError) {
      throw new Error(`Failed to deploy player: ${updateError.message}`);
    }

    // 5. Start the auction timer via RPC
    const { error: timerError } = await supabase.rpc("start_auction_timer", {
      p_initial_seconds: timerSeconds,
    });

    if (timerError) {
      console.error("Timer start warning:", timerError.message);
      // Continue even if timer fails - admin can start manually
    }

    // 6. Revalidate admin and captain pages
    revalidatePath("/admin");
    revalidatePath("/captain");

    return {
      success: true,
      message: `Player ${player.name} deployed to auction`,
      playerId: validated.playerId,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.issues[0].message}`);
    }
    throw error;
  }
}

/**
 * Mark a player as unsold
 * Clears current player from auction state
 */
export async function markPlayerUnsold(playerId: string) {
  try {
    const validated = MarkPlayerUnsoldSchema.parse({ playerId });

    // 1. Validate player exists
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("*")
      .eq("id", validated.playerId)
      .single();

    if (playerError) {
      throw new Error(`Player not found: ${playerError.message}`);
    }

    // 2. Get auction_state
    const { data: auctionState, error: stateError } = await supabase
      .from("auction_state")
      .select("*")
      .single();

    if (stateError) {
      throw new Error(`Failed to fetch auction state: ${stateError.message}`);
    }

    // 3. Update auction_state to idle
    const { error: updateError } = await supabase
      .from("auction_state")
      .update({
        current_player_id: null,
        current_base_price: null,
        current_bid_amount: null,
        bid_count: 0,
        status: "idle",
        current_bidder_team_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", auctionState.id);

    if (updateError) {
      throw new Error(`Failed to update auction state: ${updateError.message}`);
    }

    // 4. Ensure player is marked as not sold (explicitly set)
    const { error: playerUpdateError } = await supabase
      .from("players")
      .update({
        is_sold: false,
        sold_to_team_id: null,
        sold_price: null,
      })
      .eq("id", validated.playerId);

     if (playerUpdateError) {
       console.error("Player update warning:", playerUpdateError.message);
     }

     // 6. Create auction_log entry
     await createLogEntry(validated.playerId, null, "unsold", null, false);

     // 7. Clear bans for this player
     await clearBansForPlayer(validated.playerId);

    // 7. Revalidate admin and captain pages
    revalidatePath("/admin");
    revalidatePath("/captain");

    return {
      success: true,
      message: `Player ${player.name} marked as unsold`,
      playerId: validated.playerId,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.issues[0].message}`);
    }
    throw error;
  }
}

/**
 * Finalize a sale - record the winning bid and update all related tables
 */
export async function finalizeSale(
  playerId: string,
  teamId: string,
  bidAmount: number
) {
  try {
    const validated = FinalizeSaleSchema.parse({
      playerId,
      teamId,
      bidAmount,
    });

    // 1. Validate player exists
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("*")
      .eq("id", validated.playerId)
      .single();

    if (playerError) {
      throw new Error(`Player not found: ${playerError.message}`);
    }

    // 2. Get current auction state to validate bid
    const { data: auctionState, error: stateError } = await supabase
      .from("auction_state")
      .select("*")
      .single();

    if (stateError) {
      throw new Error(`Failed to fetch auction state: ${stateError.message}`);
    }

    // Validate the bid amount matches current state
    if (auctionState.current_bid_amount !== validated.bidAmount) {
      throw new Error(
        `Bid amount mismatch. Expected: ${auctionState.current_bid_amount}, Got: ${validated.bidAmount}`
      );
    }

    // 3. Get team info
    const { data: team, error: teamError } = await supabase
      .from("teams")
      .select("*")
      .eq("id", validated.teamId)
      .single();

    if (teamError) {
      throw new Error(`Team not found: ${teamError.message}`);
    }

    // 4. Get auction rules for the team
    const { data: rules, error: rulesError } = await supabase
      .from("auction_rules")
      .select("current_purse")
      .eq("team_id", validated.teamId)
      .single();

    if (rulesError) {
      throw new Error(`Failed to fetch team rules: ${rulesError.message}`);
    }

    // Validate team has enough purse
    if (rules.current_purse < validated.bidAmount) {
      throw new Error(
        `Insufficient purse. Available: ₹${rules.current_purse.toLocaleString()}, Required: ₹${validated.bidAmount.toLocaleString()}`
      );
    }

    // 5. Update players table - mark as sold
    const { error: soldError } = await supabase
      .from("players")
      .update({
        is_sold: true,
        sold_to_team_id: validated.teamId,
        sold_price: validated.bidAmount,
      })
      .eq("id", validated.playerId);

    if (soldError) {
      throw new Error(`Failed to mark player as sold: ${soldError.message}`);
    }

    // 6. Update auction_rules table - deduct from team purse
    const { error: purseError } = await supabase
      .from("auction_rules")
      .update({
        current_purse: rules.current_purse - validated.bidAmount,
      })
      .eq("team_id", validated.teamId);

    if (purseError) {
      throw new Error(`Failed to update team purse: ${purseError.message}`);
    }

    // 7. Mark the winning bid in bids table
    const { data: highestBid } = await supabase
      .from("bids")
      .select("id")
      .eq("player_id", validated.playerId)
      .eq("team_id", validated.teamId)
      .order("bid_amount", { ascending: false })
      .limit(1)
      .single();

    if (highestBid) {
      await supabase
        .from("bids")
        .update({ is_winning_bid: true })
        .eq("id", highestBid.id);
    }

    // 8. Reset auction_state to idle
    const { error: resetError } = await supabase
      .from("auction_state")
      .update({
        current_player_id: null,
        current_base_price: null,
        current_bid_amount: null,
        bid_count: 0,
        status: "idle",
        current_bidder_team_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", auctionState.id);

    if (resetError) {
      throw new Error(`Failed to reset auction state: ${resetError.message}`);
    }

    // 9. Create auction_log entry
    await createLogEntry(validated.playerId, validated.teamId, "sold", validated.bidAmount, false);

    // 10. Clear bans for this player
    await clearBansForPlayer(validated.playerId);

    // 11. Revalidate admin and captain pages
    revalidatePath("/admin");
    revalidatePath("/captain");

    return {
      success: true,
      message: `Player ${player.name} sold to ${team.team_name} for ₹${validated.bidAmount.toLocaleString()}`,
      playerId: validated.playerId,
      teamId: validated.teamId,
      bidAmount: validated.bidAmount,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.issues[0].message}`);
    }
    throw error;
  }
}

/**
 * Re-auction a player (restart timer for same player)
 */
export async function reAuctionPlayer(playerId: string) {
  try {
    const validated = DeployPlayerSchema.parse({ playerId });

    // 1. Get timer settings
    const { data: settings } = await supabase
      .from("tournament_settings")
      .select("first_bid_timer_seconds, subsequent_bid_timer_seconds")
      .single();

    const timerSeconds = settings?.first_bid_timer_seconds || 30;

    // 2. Get auction_state
    const { data: auctionState, error: stateError } = await supabase
      .from("auction_state")
      .select("*")
      .single();

    if (stateError) {
      throw new Error(`Failed to fetch auction state: ${stateError.message}`);
    }

    // 3. Update auction_state - restart auction
    const { error: updateError } = await supabase
      .from("auction_state")
      .update({
        status: "waiting_for_first_bid",
        bid_count: 0,
        current_bidder_team_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", auctionState.id);

    if (updateError) {
      throw new Error(`Failed to restart auction: ${updateError.message}`);
    }

    // 4. Start timer
    const { error: timerError } = await supabase.rpc("start_auction_timer", {
      p_initial_seconds: timerSeconds,
    });

    if (timerError) {
      console.error("Timer start warning:", timerError.message);
    }

    // 5. Revalidate pages
    revalidatePath("/admin");
    revalidatePath("/captain");

    return {
      success: true,
      message: "Player re-auctioned successfully",
      playerId: validated.playerId,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.issues[0].message}`);
    }
    throw error;
  }
}
