"use server";

import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { revalidateAuctionViews } from "@/lib/actions/revalidateAuctionViews";

const CreateLogEntrySchema = z.object({
  playerId: z.string().uuid(),
  teamId: z.string().uuid().optional().nullable(),
  status: z.enum(["sold", "unsold", "manual"]),
  salePrice: z.number().optional().nullable(),
  isManual: z.boolean().default(false),
});

const DeleteLogEntrySchema = z.object({
  logId: z.string().uuid(),
  reason: z.string().min(1, "Deletion reason is required"),
});

const GetLogsSchema = z.object({
  limit: z.number().min(1).max(100).default(20),
  offset: z.number().min(0).default(0),
});

export async function createLogEntry(
  playerId: string,
  teamId: string | null,
  status: "sold" | "unsold" | "manual",
  salePrice: number | null,
  isManual: boolean = false
): Promise<{ success: boolean; message: string; logId?: string }> {
  try {
    const validated = CreateLogEntrySchema.parse({
      playerId,
      teamId,
      status,
      salePrice,
      isManual,
    });

    const { data: player, error: playerError } = await supabase
      .from("players")
      .select("*")
      .eq("id", validated.playerId)
      .single();

    if (playerError || !player) {
      throw new Error(`Player not found: ${playerError?.message}`);
    }

    const { data: currentUser } = await supabase.auth.getUser();
    if (!currentUser.user) {
      throw new Error("Not authenticated");
    }

    const { data: team } = teamId
      ? await supabase.from("teams").select("*").eq("id", teamId).single()
      : { data: null };

    const bidCountResult = await supabase
      .from("bids")
      .select("id", { count: "exact", head: false })
      .eq("player_id", validated.playerId);

    const bidCount = bidCountResult.count || 0;

    const { data: logEntry, error: logError } = await supabase
      .from("auction_log")
      .insert({
        player_id: validated.playerId,
        team_id: validated.teamId,
        status: validated.status,
        sale_price: validated.salePrice,
        base_price: player.base_price,
        bid_count: bidCount,
        category: player.category,
        gender: player.gender,
        logged_by: currentUser.user.id,
        is_manual: validated.isManual,
      })
      .select("id")
      .single();

    if (logError) {
      throw new Error(`Failed to create log entry: ${logError.message}`);
    }

    revalidateAuctionViews();

    return {
      success: true,
      message: "Log entry created successfully",
      logId: logEntry.id,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: `Validation error: ${error.issues[0].message}` };
    }
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Failed to create log entry" };
  }
}

export async function getAuctionLogs(
  limit: number = 20,
  offset: number = 0
): Promise<any[]> {
  try {
    const { data: logs, error } = await supabase
      .from("auction_log")
      .select(`
        id,
        player_id,
        team_id,
        status,
        sale_price,
        base_price,
        bid_count,
        category,
        gender,
        logged_at,
        logged_by,
        is_manual,
        deleted,
        deleted_at,
        player:players(id, name, category, image_url, playing_role),
        team:teams(id, team_name, team_logo_url),
        logged_by_user:auth.users(id, email)
      `)
      .eq("deleted", false)
      .order("logged_at", { ascending: false })
      .range(offset, offset + limit - 1);

    if (error) {
      throw new Error(`Failed to fetch logs: ${error.message}`);
    }

    return logs || [];
  } catch (error) {
    console.error("Failed to fetch auction logs:", error);
    return [];
  }
}

export async function deleteLogEntry(
  logId: string,
  reason: string
): Promise<{ success: boolean; message: string }> {
  try {
    const validated = DeleteLogEntrySchema.parse({ logId, reason });

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

    const { data: currentUserEmail } = await supabase
      .from("auth.users")
      .select("email")
      .eq("id", currentUser.user.id)
      .single();

    await supabase.from("audit_log").insert({
      action_type: "delete_log",
      entity_type: "auction_log",
      entity_id: validated.logId,
      performed_by: currentUser.user.id,
      reason: validated.reason,
      previous_state: logEntry,
    });

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
      throw new Error(`Failed to delete log entry: ${deleteError.message}`);
    }

    revalidateAuctionViews();

    return {
      success: true,
      message: "Log entry deleted successfully",
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: `Validation error: ${error.issues[0].message}` };
    }
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Failed to delete log entry" };
  }
}

export async function exportLogsAsCSV(
  startDate?: Date,
  endDate?: Date
): Promise<{ success: boolean; message: string; csv?: string }> {
  try {
    let query = supabase
      .from("auction_log")
      .select(`
        player:players(name),
        team:teams(team_name),
        status,
        sale_price,
        base_price,
        bid_count,
        category,
        gender,
        logged_at,
        is_manual
      `)
      .order("logged_at", { ascending: false });

    if (startDate) {
      query = query.gte("logged_at", startDate.toISOString());
    }
    if (endDate) {
      query = query.lte("logged_at", endDate.toISOString());
    }

    const { data: logs, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch logs for export: ${error.message}`);
    }

    if (!logs || logs.length === 0) {
      return { success: false, message: "No logs to export" };
    }

    const headers = [
      "Player Name",
      "Team",
      "Status",
      "Sale Price",
      "Base Price",
      "Bid Count",
      "Category",
      "Gender",
      "Logged At",
      "Is Manual",
    ];

    const rows = logs.map((log: any) => [
      log.player?.name || "N/A",
      log.team?.team_name || "Unsold",
      log.status,
      log.sale_price || 0,
      log.base_price,
      log.bid_count,
      log.category,
      log.gender,
      log.logged_at,
      log.is_manual ? "Yes" : "No",
    ]);

    const csvContent = [
      headers.join(","),
      ...rows.map((row) => row.join(",")),
    ].join("\n");

    return {
      success: true,
      message: "Logs exported successfully",
      csv: csvContent,
    };
  } catch (error) {
    console.error("Failed to export logs:", error);
    return { success: false, message: "Failed to export logs" };
  }
}

export async function getAuditTrail(
  entityId?: string
): Promise<any[]> {
  try {
    let query = supabase
      .from("audit_log")
      .select(`
        action_type,
        entity_type,
        entity_id,
        performed_by,
        performed_at,
        reason,
        performed_by_user:auth.users(email)
      `)
      .order("performed_at", { ascending: false });

    if (entityId) {
      query = query.eq("entity_id", entityId);
    }

    const { data: logs, error } = await query;

    if (error) {
      throw new Error(`Failed to fetch audit trail: ${error.message}`);
    }

    return logs || [];
  } catch (error) {
    console.error("Failed to fetch audit trail:", error);
    return [];
  }
}
