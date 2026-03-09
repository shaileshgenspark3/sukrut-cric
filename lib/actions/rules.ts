"use server";

import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";

export async function manualPurseDeduction(teamId: string, amount: number, reason: string) {
  // Get current auction rules
  const { data: rules } = await supabase
    .from("auction_rules")
    .select("current_purse")
    .eq("team_id", teamId)
    .single();

  if (!rules) {
    throw new Error("Auction rules not found for team");
  }

  const newPurse = rules.current_purse - amount;

  if (newPurse < 0) {
    throw new Error("Deduction would result in negative purse");
  }

  // Update current_purse
  const { error: updateError } = await supabase
    .from("auction_rules")
    .update({ current_purse: newPurse })
    .eq("team_id", teamId);

  if (updateError) {
    throw new Error("Failed to update purse: " + updateError.message);
  }

  // Log deduction (optional: create auction_log entry for audit)
  // Note: manual_deductions table may not exist yet. If needed, create it in a separate migration (deferred to Phase 5 logging).
  // For now, we'll skip the logging since the table doesn't exist.

  revalidatePath("/admin");
  revalidatePath("/captain");

  return { success: true, newPurse };
}

export async function updateBasePrices(basePrices: {
  A_plus: number;
  A: number;
  B: number;
  F: number;
}) {
  const { error } = await supabase
    .from("tournament_settings")
    .update({
      base_price_A_plus: basePrices.A_plus,
      base_price_A: basePrices.A,
      base_price_B: basePrices.B,
      base_price_F: basePrices.F,
      updated_at: new Date().toISOString()
    })
    .neq("id", null); // Update all rows (should be single row)

  if (error) {
    throw new Error("Failed to update base prices: " + error.message);
  }

  revalidatePath("/admin");
  revalidatePath("/captain");

  return { success: true };
}
