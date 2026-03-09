"use server";

import { z } from "zod";
import { supabaseAdmin as supabase } from "@/lib/supabase-admin";
import { revalidatePath } from "next/cache";

// Zod schemas for validation
const StartTimerSchema = z.object({
  initialSeconds: z.number().optional().default(30),
});

const TimerSettingsSchema = z.object({
  firstBidSeconds: z.number().min(1).max(300),
  subsequentBidSeconds: z.number().min(1).max(300),
});

/**
 * Start or restart the auction timer
 */
export async function startTimer(initialSeconds?: number) {
  try {
    const validated = StartTimerSchema.parse({ initialSeconds });

    const { error } = await supabase.rpc("start_auction_timer", {
      p_initial_seconds: validated.initialSeconds,
    });

    if (error) {
      throw new Error(`Failed to start timer: ${error.message}`);
    }

    // Revalidate pages that display timer
    revalidatePath("/admin");
    revalidatePath("/captain");

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.issues[0].message}`);
    }
    throw error;
  }
}

/**
 * Pause the auction timer
 */
export async function pauseTimer() {
  try {
    const { error } = await supabase.rpc("pause_auction_timer");

    if (error) {
      throw new Error(`Failed to pause timer: ${error.message}`);
    }

    revalidatePath("/admin");
    revalidatePath("/captain");

    return { success: true };
  } catch (error) {
    throw error;
  }
}

/**
 * Resume the auction timer (adjusts for pause duration)
 */
export async function resumeTimer() {
  try {
    const { error } = await supabase.rpc("resume_auction_timer");

    if (error) {
      throw new Error(`Failed to resume timer: ${error.message}`);
    }

    revalidatePath("/admin");
    revalidatePath("/captain");

    return { success: true };
  } catch (error) {
    throw error;
  }
}

/**
 * Update timer settings for first bid and subsequent bids
 */
export async function updateTimerSettings(
  firstBidSeconds: number,
  subsequentBidSeconds: number
) {
  try {
    const validated = TimerSettingsSchema.parse({
      firstBidSeconds,
      subsequentBidSeconds,
    });

    const { error } = await supabase.rpc("update_timer_settings", {
      p_first_bid_seconds: validated.firstBidSeconds,
      p_subsequent_bid_seconds: validated.subsequentBidSeconds,
    });

    if (error) {
      throw new Error(`Failed to update timer settings: ${error.message}`);
    }

    revalidatePath("/admin");
    revalidatePath("/captain");

    return { success: true };
  } catch (error) {
    if (error instanceof z.ZodError) {
      throw new Error(`Validation error: ${error.issues[0].message}`);
    }
    throw error;
  }
}
