"use server";

import { z } from "zod";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";
import { validateBid, calculateMaxBid } from "@/lib/validation/bidValidation";
import { isTeamBanned } from "@/lib/actions/admin";

const PlaceBidSchema = z.object({
  playerId: z.string().uuid(),
  teamId: z.string().uuid(),
  bidAmount: z.number().min(1),
});

const COOLDOWN_SECONDS = 3;

export async function checkCooldown(teamId: string, playerId: string): Promise<{ canBid: boolean; reason?: string }> {
  const { data: lastBid } = await supabase
    .from("bids")
    .select("created_at")
    .eq("team_id", teamId)
    .eq("player_id", playerId)
    .order("created_at", { ascending: false })
    .limit(1)
    .single();

  if (lastBid) {
    const lastBidTime = new Date(lastBid.created_at).getTime();
    const now = Date.now();
    const secondsSinceLastBid = (now - lastBidTime) / 1000;

    if (secondsSinceLastBid < COOLDOWN_SECONDS) {
      const remainingSeconds = Math.ceil(COOLDOWN_SECONDS - secondsSinceLastBid);
      return {
        canBid: false,
        reason: `Please wait ${remainingSeconds} second(s) before placing another bid`,
      };
    }
  }

  return { canBid: true };
}

export async function placeBidWithValidation(
  playerId: string,
  teamId: string,
  bidAmount: number
): Promise<{ success: boolean; message: string }> {
  try {
    const validated = PlaceBidSchema.parse({
      playerId,
      teamId,
      bidAmount,
    });

    const { data: auctionState, error: stateError } = await supabase
      .from("auction_state")
      .select("*")
      .single();

    if (stateError) {
      throw new Error(`Failed to fetch auction state: ${stateError.message}`);
    }

    if (!auctionState.current_player_id) {
      throw new Error("No player is currently on the auction block");
    }

    if (auctionState.current_player_id !== validated.playerId) {
      throw new Error("This player is not currently on the auction block");
    }

    if (auctionState.timer_end && !auctionState.is_paused) {
      const timerExpired = new Date(auctionState.timer_end).getTime() <= Date.now();
      if (timerExpired) {
        throw new Error("Timer expired. Waiting for admin confirmation before continuing.");
      }
    }

    const currentBidAmount = auctionState.current_bid_amount || auctionState.current_base_price || 0;
    const bidIncrement = 25000;
    const expectedBid = currentBidAmount + bidIncrement;

    if (validated.bidAmount !== expectedBid) {
      throw new Error(
        `Invalid bid amount. Expected: ₹${expectedBid.toLocaleString()}, Got: ₹${validated.bidAmount.toLocaleString()}`
      );
    }

    const cooldownCheck = await checkCooldown(validated.teamId, validated.playerId);
    if (!cooldownCheck.canBid) {
      throw new Error(cooldownCheck.reason);
    }

    const bannedCheck = await isTeamBanned(validated.teamId, validated.playerId);
    if (bannedCheck) {
      throw new Error("Your team has been temporarily banned from bidding on this player");
    }

    const validation = await validateBid(validated.teamId, validated.playerId, validated.bidAmount);
    if (!validation.valid) {
      throw new Error(validation.reason);
    }

    const { error: bidError } = await supabase.from("bids").insert({
      player_id: validated.playerId,
      team_id: validated.teamId,
      bid_amount: validated.bidAmount,
    });

    if (bidError) {
      throw new Error(`Failed to place bid: ${bidError.message}`);
    }

    const { error: updateError } = await supabase
      .from("auction_state")
      .update({
        current_bid: validated.bidAmount,
        current_bid_amount: validated.bidAmount,
        current_bidder_team_id: validated.teamId,
        bid_count: (auctionState.bid_count || 0) + 1,
        status: "bidding",
        updated_at: new Date().toISOString(),
      })
      .eq("id", auctionState.id);

    if (updateError) {
      throw new Error(`Failed to update auction state: ${updateError.message}`);
    }

    revalidatePath("/admin");
    revalidatePath("/captain");

    return { success: true, message: "Bid placed successfully" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: `Validation error: ${error.issues[0].message}` };
    }
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Failed to place bid" };
  }
}

export async function getTeamBidEligibility(teamId: string, playerId: string) {
  const { data: auctionState } = await supabase
    .from("auction_state")
    .select("current_player_id, current_bid_amount, current_base_price")
    .single();

  if (!auctionState?.current_player_id || auctionState.current_player_id !== playerId) {
    return {
      canBid: false,
      maxBid: 0,
      nextBid: 0,
      reasons: ["Player not currently on auction block"],
    };
  }

  const { data: player } = await supabase
    .from("players")
    .select("category, gender")
    .eq("id", playerId)
    .single();

  if (!player) {
    return {
      canBid: false,
      maxBid: 0,
      nextBid: 0,
      reasons: ["Player not found"],
    };
  }

  const maxBid = await calculateMaxBid(teamId, player.category, player.gender);
  const currentBidAmount = auctionState.current_bid_amount || auctionState.current_base_price || 0;
  const bidIncrement = 25000;
  const nextBid = currentBidAmount + bidIncrement;

  const reasons: string[] = [];
  if (nextBid > maxBid) {
    reasons.push(`Next bid (₹${nextBid.toLocaleString()}) exceeds your max bid (₹${maxBid.toLocaleString()})`);
  }

  return {
    canBid: reasons.length === 0,
    maxBid,
    nextBid,
    reasons,
  };
}
