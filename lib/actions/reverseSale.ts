"use server";

import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { revalidateAuctionViews } from "@/lib/actions/revalidateAuctionViews";

const ReverseSaleSchema = z.object({
  logId: z.string().uuid(),
  reason: z.string().min(1, "Reason is required"),
});

export async function getSaleHistory(playerId: string) {
  const [bidsResult, logsResult] = await Promise.all([
    supabaseAdmin
      .from("bids")
      .select(`
        id,
        player_id,
        team_id,
        bid_amount,
        created_at,
        team:teams(team_name)
      `)
      .eq("player_id", playerId)
      .order("created_at", { ascending: true }),
    supabaseAdmin
      .from("auction_log")
      .select("*")
      .eq("player_id", playerId)
      .order("logged_at", { ascending: true }),
  ]);

  return {
    bids: bidsResult.data || [],
    logs: logsResult.data || [],
  };
}

export async function reverseSale(
  logId: string,
  reason: string,
  performedBy?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const validated = ReverseSaleSchema.parse({ logId, reason });

    const { data: logEntry, error: fetchError } = await supabaseAdmin
      .from("auction_log")
      .select("*")
      .eq("id", validated.logId)
      .single();

    if (fetchError || !logEntry) {
      throw new Error(`Log entry not found: ${fetchError?.message}`);
    }

    if (logEntry.deleted) {
      return { success: false, message: "Log entry already deleted" };
    }

    if (logEntry.status === "unsold") {
      return { success: false, message: "Cannot reverse unsold entries" };
    }

    await supabaseAdmin.from("audit_log").insert({
      action_type: "reverse_sale",
      entity_type: "auction_log",
      entity_id: validated.logId,
      reason: validated.reason,
      previous_state: logEntry,
    });

    const { error: playerError } = await supabaseAdmin
      .from("players")
      .update({
        is_sold: false,
        sold_to_team_id: null,
        sold_price: null,
      })
      .eq("id", logEntry.player_id);

    if (playerError) {
      throw new Error(`Failed to restore player: ${playerError.message}`);
    }

    if (logEntry.team_id && logEntry.sale_price) {
      const { data: teamRules } = await supabaseAdmin
        .from("auction_rules")
        .select("current_purse")
        .eq("team_id", logEntry.team_id)
        .single();

      if (teamRules) {
        const { error: purseError } = await supabaseAdmin
          .from("auction_rules")
          .update({
            current_purse: teamRules.current_purse + (logEntry.sale_price || 0),
          })
          .eq("team_id", logEntry.team_id);

        if (purseError) {
          throw new Error(`Failed to refund team purse: ${purseError.message}`);
        }
      }
    }

    let saleAuctionRound: number | null = null;

    if (logEntry.team_id) {
      const { data: winningBid } = await supabaseAdmin
        .from("bids")
        .select("auction_round")
        .eq("player_id", logEntry.player_id)
        .eq("team_id", logEntry.team_id)
        .eq("is_winning_bid", true)
        .order("created_at", { ascending: false })
        .limit(1)
        .maybeSingle();

      saleAuctionRound = winningBid?.auction_round ?? null;

      if (saleAuctionRound == null && logEntry.status === "sold") {
        const { data: latestBidForTeam } = await supabaseAdmin
          .from("bids")
          .select("auction_round")
          .eq("player_id", logEntry.player_id)
          .eq("team_id", logEntry.team_id)
          .order("created_at", { ascending: false })
          .limit(1)
          .maybeSingle();

        saleAuctionRound = latestBidForTeam?.auction_round ?? null;
      }
    }

    if (saleAuctionRound != null) {
      const { error: bidsError } = await supabaseAdmin
        .from("bids")
        .delete()
        .eq("player_id", logEntry.player_id)
        .eq("auction_round", saleAuctionRound);

      if (bidsError) {
        console.error("Warning: Failed to clear bids for reversed round:", bidsError.message);
      }
    }

    const { data: stateData, error: stateError } = await supabaseAdmin
      .from("auction_state")
      .select("*")
      .single();

    if (!stateError && stateData && stateData.current_player_id === logEntry.player_id) {
      await supabaseAdmin
        .from("auction_state")
        .update({
          current_player_id: null,
          current_base_price: null,
          current_bid: null,
          current_bid_amount: null,
          bid_count: 0,
          status: "idle",
          current_bidder_team_id: null,
          updated_at: new Date().toISOString(),
        })
        .eq("id", stateData.id);
    }

    const { error: deleteError } = await supabaseAdmin
      .from("auction_log")
      .update({
        deleted: true,
        deleted_at: new Date().toISOString(),
        deletion_reason: validated.reason,
      })
      .eq("id", validated.logId);

    if (deleteError) {
      throw new Error(`Failed to mark log as deleted: ${deleteError.message}`);
    }

    revalidateAuctionViews();

    return {
      success: true,
      message: "Sale reversed successfully",
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: `Validation error: ${error.issues[0].message}` };
    }
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Failed to reverse sale" };
  }
}
