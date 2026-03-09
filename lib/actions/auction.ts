"use server";

import { z } from "zod";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { clearBansForPlayer } from "@/lib/actions/admin";
import { createLogEntry } from "@/lib/actions/logging";
import { revalidateAuctionViews } from "@/lib/actions/revalidateAuctionViews";

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
export async function deployPlayer(playerId: string): Promise<{ success: boolean; message: string; playerId: string }> {
  // Validate input first
  if (!playerId || typeof playerId !== 'string') {
    throw new Error('Invalid player ID provided');
  }

  try {
    const validated = DeployPlayerSchema.parse({ playerId });

    // 1. Validate player exists and is eligible (not sold, not captain)
    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("*")
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

    // Check if there's already a player in auction
    if (auctionState.status !== "idle" && auctionState.current_player_id) {
      throw new Error("Cannot deploy player: There is already an active auction in progress. Please sell or mark the current player as unsold first.");
    }

    // 3. Use auction_state timer settings as source of truth
    const timerSeconds = auctionState.first_bid_timer_seconds || 30;

    // 4. Update auction_state table
    const updateData = {
      auction_round: (auctionState.auction_round || 0) + 1,
      current_player_id: validated.playerId,
      current_base_price: player.base_price,
      current_bid: player.base_price,
      current_bid_amount: player.base_price,
      bid_count: 0,
      status: "waiting_for_first_bid",
      current_bidder_team_id: null,
      updated_at: new Date().toISOString(),
    };
    
    const { error: updateError } = await supabase
      .from("auction_state")
      .update(updateData)
      .eq("id", auctionState.id);

    if (updateError) {
      throw new Error(`Failed to deploy player: ${updateError.message}`);
    }

    // 5. Start the auction timer via RPC
    try {
      const { error: timerError } = await supabase.rpc("start_auction_timer", {
        p_initial_seconds: timerSeconds,
      });

      if (timerError) {
        console.error("Timer start warning:", timerError.message);
      }
    } catch (timerRpcError: any) {
      console.error("Timer RPC exception:", timerRpcError?.message);
      // Continue even if timer fails - admin can start manually
    }

    // 6. Revalidate admin and captain pages
    try {
      revalidateAuctionViews();
    } catch (revalError: any) {
      console.error('Revalidation error:', revalError);
      // Don't throw on revalidation error - it's not critical
    }
    return {
      success: true,
      message: `Player ${player.name} deployed to auction`,
      playerId: validated.playerId,
    };
  } catch (error: any) {
    console.error('=== DEPLOY PLAYER ERROR ===');
    console.error('Error:', error);
    console.error('Error message:', error?.message);
    console.error('==============================');
    
    // Always throw a string message, not an object
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.issues[0].message}`);
    }
    if (error instanceof Error) {
      throw new Error(error.message);
    }
    throw new Error(String(error));
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

    // 1. Get auction_state
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
        current_bid: 0,
        bid_count: 0,
        status: "idle",
        current_bidder_team_id: null,
        timer_end: null,
        is_paused: false,
        paused_at: null,
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
    revalidateAuctionViews();

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

    const previousPlayerState = {
      is_sold: player.is_sold ?? false,
      sold_to_team_id: player.sold_to_team_id ?? null,
      sold_price: player.sold_price ?? null,
    };
    const previousAuctionState = {
      current_player_id: auctionState.current_player_id,
      current_base_price: auctionState.current_base_price,
      current_bid_amount: auctionState.current_bid_amount,
      current_bid: auctionState.current_bid,
      bid_count: auctionState.bid_count,
      status: auctionState.status,
      current_bidder_team_id: auctionState.current_bidder_team_id,
      timer_end: auctionState.timer_end,
      is_paused: auctionState.is_paused,
      paused_at: auctionState.paused_at,
      last_bid_at: auctionState.last_bid_at,
      updated_at: auctionState.updated_at,
    };
    const nextPurse = rules.current_purse - validated.bidAmount;

    let playerUpdated = false;
    let purseUpdated = false;
    let winningBidMarked = false;
    let auctionStateReset = false;

    // 5. Find the winning bid row before mutating anything else
    const { data: highestBid } = await supabase
      .from("bids")
      .select("id")
      .eq("player_id", validated.playerId)
      .eq("team_id", validated.teamId)
      .eq("auction_round", auctionState.auction_round || 0)
      .order("bid_amount", { ascending: false })
      .limit(1)
      .maybeSingle();

    try {
      // 6. Update players table - mark as sold
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
      playerUpdated = true;

      // 7. Update auction_rules table - deduct from team purse
      const { error: purseError } = await supabase
        .from("auction_rules")
        .update({
          current_purse: nextPurse,
        })
        .eq("team_id", validated.teamId);

      if (purseError) {
        throw new Error(`Failed to update team purse: ${purseError.message}`);
      }
      purseUpdated = true;

      // 8. Mark the winning bid in bids table
      if (highestBid?.id) {
        const { error: winningBidError } = await supabase
          .from("bids")
          .update({ is_winning_bid: true })
          .eq("id", highestBid.id);

        if (winningBidError) {
          throw new Error(`Failed to mark winning bid: ${winningBidError.message}`);
        }
        winningBidMarked = true;
      }

      // 9. Reset auction_state to idle
      const { error: resetError } = await supabase
        .from("auction_state")
        .update({
          current_player_id: null,
          current_base_price: null,
          current_bid_amount: null,
          current_bid: 0,
          bid_count: 0,
          status: "idle",
          current_bidder_team_id: null,
          timer_end: null,
          is_paused: false,
          paused_at: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", auctionState.id);

      if (resetError) {
        throw new Error(`Failed to reset auction state: ${resetError.message}`);
      }
      auctionStateReset = true;

      // 10. Create auction_log entry
      const logResult = await createLogEntry(validated.playerId, validated.teamId, "sold", validated.bidAmount, false);
      if (!logResult.success) {
        throw new Error(logResult.message);
      }
    } catch (error) {
      if (auctionStateReset) {
        await supabase
          .from("auction_state")
          .update(previousAuctionState)
          .eq("id", auctionState.id);
      }

      if (winningBidMarked && highestBid?.id) {
        await supabase
          .from("bids")
          .update({ is_winning_bid: false })
          .eq("id", highestBid.id);
      }

      if (purseUpdated) {
        await supabase
          .from("auction_rules")
          .update({ current_purse: rules.current_purse })
          .eq("team_id", validated.teamId);
      }

      if (playerUpdated) {
        await supabase
          .from("players")
          .update(previousPlayerState)
          .eq("id", validated.playerId);
      }

      throw error;
    }

    // 11. Clear bans for this player
    try {
      await clearBansForPlayer(validated.playerId);
    } catch (banError) {
      console.error("Warning: Failed to clear bans for player after sale:", banError);
    }

    // 12. Revalidate admin and captain pages
    revalidateAuctionViews();

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

    // 1. Get auction_state
    const { data: auctionState, error: stateError } = await supabase
      .from("auction_state")
      .select("*")
      .single();

    if (stateError) {
      throw new Error(`Failed to fetch auction state: ${stateError.message}`);
    }

    const timerSeconds = auctionState.first_bid_timer_seconds || 30;

    // 2. Update auction_state - restart auction
    const { error: updateError } = await supabase
      .from("auction_state")
      .update({
        auction_round: (auctionState.auction_round || 0) + 1,
        status: "waiting_for_first_bid",
        current_bid: auctionState.current_base_price || 0,
        current_bid_amount: auctionState.current_base_price,
        bid_count: 0,
        current_bidder_team_id: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", auctionState.id);

    if (updateError) {
      throw new Error(`Failed to restart auction: ${updateError.message}`);
    }

    // 3. Start timer
    const { error: timerError } = await supabase.rpc("start_auction_timer", {
      p_initial_seconds: timerSeconds,
    });

    if (timerError) {
      console.error("Timer start warning:", timerError.message);
    }

    // 4. Revalidate pages
    revalidateAuctionViews();

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

/**
 * Reset auction - removes current player from auction without marking as sold/unsold
 */
export async function resetAuction() {
  try {
    // Get auction state
    const { data: auctionState, error: stateError } = await supabase
      .from("auction_state")
      .select("*")
      .single();

    if (stateError) {
      throw new Error(`Failed to fetch auction state: ${stateError.message}`);
    }

    // Reset auction state
    const { error: updateError } = await supabase
      .from("auction_state")
      .update({
        status: "idle",
        current_player_id: null,
        current_base_price: null,
        current_bid_amount: null,
        current_bid: 0,
        current_bidder_team_id: null,
        bid_count: 0,
        timer_end: null,
        is_paused: false,
        paused_at: null,
        updated_at: new Date().toISOString(),
      })
      .eq("id", auctionState.id);

    if (updateError) {
      throw new Error(`Failed to reset auction: ${updateError.message}`);
    }

    // Revalidate pages
    revalidateAuctionViews();
    return {
      success: true,
      message: "Auction has been reset",
    };
  } catch (error: any) {
    throw new Error(error.message || "Failed to reset auction");
  }
}
