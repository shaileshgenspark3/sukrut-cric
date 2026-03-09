"use server";

import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { supabaseAdmin } from "@/lib/supabase-admin";
import { validateBid, checkCategoryEligibility } from "@/lib/validation/bidValidation";
import { revalidateAuctionViews } from "@/lib/actions/revalidateAuctionViews";

const CreateManualSaleSchema = z.object({
  playerId: z.string().uuid(),
  teamId: z.string().uuid(),
  salePrice: z.number().min(0, "Sale price must be non-negative"),
  mode: z.enum(["strict", "override"]),
});

export interface ManualSaleValidationResult {
  valid: boolean;
  errors: string[];
  warnings: string[];
}

export async function validateManualSale(
  teamId: string,
  playerId: string,
  salePrice: number,
  mode: "strict" | "override"
): Promise<ManualSaleValidationResult> {
  try {
    const errors: string[] = [];
    const warnings: string[] = [];

    if (mode === "strict") {
      const bidValidation = await validateBid(teamId, playerId, salePrice);
      if (!bidValidation.valid) {
        errors.push(bidValidation.reason || "Bid validation failed");
      }

      const { data: player } = await supabase
        .from("players")
        .select("category, gender")
        .eq("id", playerId)
        .single();

      if (player) {
        const categoryCheck = await checkCategoryEligibility(teamId, player.category, player.gender);
        if (!categoryCheck.eligible) {
          errors.push(categoryCheck.reason || "Category limit exceeded");
        }
      }
    } else {
      warnings.push(
        "Override mode: All validation rules bypassed. This action will be recorded in audit trail."
      );
    }

    return {
      valid: errors.length === 0,
      errors,
      warnings,
    };
  } catch (error) {
    console.error("Manual sale validation error:", error);
    return {
      valid: false,
      errors: ["Validation failed"],
      warnings: [],
    };
  }
}

export async function createManualSale(
  playerId: string,
  teamId: string,
  salePrice: number,
  mode: "strict" | "override"
): Promise<{ success: boolean; message: string }> {
  try {
    const validated = CreateManualSaleSchema.parse({
      playerId,
      teamId,
      salePrice,
      mode,
    });

    const { data: player } = await supabaseAdmin
      .from("players")
      .select("*")
      .eq("id", validated.playerId)
      .single();

    if (!player) {
      throw new Error("Player not found");
    }

    if (player.is_captain) {
      throw new Error("Cannot manually sell captains");
    }

    if (player.is_sold) {
      throw new Error("Player is already sold");
    }

    const validation = await validateManualSale(
      validated.teamId,
      validated.playerId,
      validated.salePrice,
      validated.mode
    );

    if (!validation.valid) {
      throw new Error(validation.errors.join(", "));
    }

    const { error: playerError } = await supabaseAdmin
      .from("players")
      .update({
        is_sold: true,
        sold_to_team_id: validated.teamId,
        sold_price: validated.salePrice,
      })
      .eq("id", validated.playerId);

    if (playerError) {
      throw new Error(`Failed to update player: ${playerError.message}`);
    }

    const { data: teamRules } = await supabaseAdmin
      .from("auction_rules")
      .select("current_purse")
      .eq("team_id", validated.teamId)
      .single();

    if (!teamRules) {
      throw new Error("Team rules not found");
    }

    if (teamRules.current_purse < validated.salePrice) {
      throw new Error(
        `Insufficient purse. Available: ₹${teamRules.current_purse.toLocaleString()}, Required: ₹${validated.salePrice.toLocaleString()}`
      );
    }

    const { error: purseError } = await supabaseAdmin
      .from("auction_rules")
      .update({
        current_purse: teamRules.current_purse - validated.salePrice,
      })
      .eq("team_id", validated.teamId);

    if (purseError) {
      throw new Error(`Failed to update team purse: ${purseError.message}`);
    }

    const { createLogEntry } = await import("@/lib/actions/logging");
    const logResult = await createLogEntry(
      validated.playerId,
      validated.teamId,
      "manual",
      validated.salePrice,
      true
    );

    if (!logResult.success) {
      console.error("Warning: Failed to create log entry:", logResult.message);
    }

    if (validated.mode === "override") {
      await supabaseAdmin.from("audit_log").insert({
        action_type: "manual_sale",
        entity_type: "sale",
        entity_id: logResult.logId,
        reason: "Override mode: bypassed validation",
        previous_state: {
          player_id: validated.playerId,
          team_id: validated.teamId,
          sale_price: validated.salePrice,
          validation_errors: validation.errors,
          validation_warnings: validation.warnings,
        },
      });
    }

    revalidateAuctionViews();

    return {
      success: true,
      message: `Manual sale recorded successfully${validation.warnings.length > 0 ? `. ${validation.warnings.join(" ")}` : ""}`,
    };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: `Validation error: ${error.issues[0].message}` };
    }
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Failed to create manual sale" };
  }
}

export async function getAvailablePlayers() {
  const { data, error } = await supabase
    .from("players")
    .select("id, name, category, base_price, playing_role, image_url, gender")
    .eq("is_captain", false)
    .eq("is_sold", false)
    .order("category", { ascending: true });

  if (error) {
    throw new Error(`Failed to fetch players: ${error.message}`);
  }

  return data || [];
}
