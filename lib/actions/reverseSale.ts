"use server";

import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

const ReverseSaleSchema = z.object({
  logId: z.string().uuid(),
  reason: z.string().min(1, "Reason is required"),
});

export async function getSaleHistory(playerId: string) {
  const [bidsResult, logsResult] = await Promise.all([
    supabase
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
    supabase
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

    const { data: currentUser } = await supabase.auth.getUser();
    if (!currentUser.user) {
      throw new Error("Not authenticated");
    }

    const { data: logEntry, error: fetchError } = await supabase
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

    await supabase.from("audit_log").insert({
      action_type: "reverse_sale",
      entity_type: "auction_log",
      entity_id: validated.logId,
      performed_by: currentUser.user.id,
      reason: validated.reason,
      previous_state: logEntry,
    });

    const { error: playerError } = await supabase
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
      const { data: teamRules } = await supabase
        .from("auction_rules")
        .select("current_purse")
        .eq("team_id", logEntry.team_id)
        .single();

      if (teamRules) {
        const { error: purseError } = await supabase
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

    const { error: bidsError } = await supabase
      .from("bids")
      .delete()
      .eq("player_id", logEntry.player_id);

    if (bidsError) {
      console.error("Warning: Failed to clear bids:", bidsError.message);
    }

    const { data: stateData, error: stateError } = await supabase
      .from("auction_state")
      .select("*")
      .single();

    if (!stateError && stateData && stateData.current_player_id === logEntry.player_id) {
      await supabase
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

    const { error: deleteError } = await supabase
      .from("auction_log")
      .update({
        deleted: true,
        deleted_by: currentUser.user.id,
        deleted_at: new Date().toISOString(),
        deletion_reason: validated.reason,
      })
      .eq("id", validated.logId);

    if (deleteError) {
      throw new Error(`Failed to mark log as deleted: ${deleteError.message}`);
    }

    revalidatePath("/admin");
    revalidatePath("/captain");

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
