"use server";

import { z } from "zod";
import { supabase } from "@/lib/supabase";
import { revalidatePath } from "next/cache";

const BanTeamSchema = z.object({
  teamId: z.string().uuid(),
  playerId: z.string().uuid(),
  reason: z.string().optional(),
});

const UnbanTeamSchema = z.object({
  teamId: z.string().uuid(),
  playerId: z.string().uuid(),
});

export async function banTeamFromBidding(
  teamId: string,
  playerId: string,
  reason?: string
): Promise<{ success: boolean; message: string }> {
  try {
    const validated = BanTeamSchema.parse({
      teamId,
      playerId,
      reason,
    });

    const { data: auctionState, error: stateError } = await supabase
      .from("auction_state")
      .select("id, banned_teams")
      .single();

    if (stateError) {
      throw new Error(`Failed to fetch auction state: ${stateError.message}`);
    }

    const currentBans: Array<{ teamId: string; playerId: string; reason?: string; bannedAt: string }> =
      (auctionState.banned_teams as any) || [];

    const isAlreadyBanned = currentBans.some(
      (ban) => ban.teamId === validated.teamId && ban.playerId === validated.playerId
    );

    if (isAlreadyBanned) {
      return { success: false, message: "Team is already banned from bidding on this player" };
    }

    const updatedBans = [
      ...currentBans,
      {
        teamId: validated.teamId,
        playerId: validated.playerId,
        reason: validated.reason,
        bannedAt: new Date().toISOString(),
      },
    ];

    const { error: updateError } = await supabase
      .from("auction_state")
      .update({
        banned_teams: updatedBans,
      })
      .eq("id", auctionState.id);

    if (updateError) {
      throw new Error(`Failed to ban team: ${updateError.message}`);
    }

    revalidatePath("/admin");
    revalidatePath("/captain");

    return { success: true, message: "Team banned from bidding on this player" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: `Validation error: ${error.issues[0].message}` };
    }
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Failed to ban team" };
  }
}

export async function unbanTeam(
  teamId: string,
  playerId: string
): Promise<{ success: boolean; message: string }> {
  try {
    const validated = UnbanTeamSchema.parse({
      teamId,
      playerId,
    });

    const { data: auctionState, error: stateError } = await supabase
      .from("auction_state")
      .select("id, banned_teams")
      .single();

    if (stateError) {
      throw new Error(`Failed to fetch auction state: ${stateError.message}`);
    }

    const currentBans: Array<{ teamId: string; playerId: string; reason?: string; bannedAt: string }> =
      (auctionState.banned_teams as any) || [];

    const updatedBans = currentBans.filter(
      (ban) => !(ban.teamId === validated.teamId && ban.playerId === validated.playerId)
    );

    const { error: updateError } = await supabase
      .from("auction_state")
      .update({
        banned_teams: updatedBans,
      })
      .eq("id", auctionState.id);

    if (updateError) {
      throw new Error(`Failed to unban team: ${updateError.message}`);
    }

    revalidatePath("/admin");
    revalidatePath("/captain");

    return { success: true, message: "Team unbanned from bidding" };
  } catch (error) {
    if (error instanceof z.ZodError) {
      return { success: false, message: `Validation error: ${error.issues[0].message}` };
    }
    if (error instanceof Error) {
      return { success: false, message: error.message };
    }
    return { success: false, message: "Failed to unban team" };
  }
}

export async function getBannedTeams(
  playerId?: string
): Promise<Array<{ teamId: string; teamName?: string; reason?: string; bannedAt: string }>> {
  try {
    const { data: auctionState } = await supabase
      .from("auction_state")
      .select("banned_teams")
      .single();

    const currentBans: Array<{ teamId: string; playerId: string; reason?: string; bannedAt: string }> =
      (auctionState?.banned_teams as any) || [];

    let filteredBans = currentBans;
    if (playerId) {
      filteredBans = currentBans.filter((ban) => ban.playerId === playerId);
    }

    if (filteredBans.length === 0) {
      return [];
    }

    const teamIds = filteredBans.map((ban) => ban.teamId);
    const { data: teams } = await supabase
      .from("teams")
      .select("id, team_name")
      .in("id", teamIds);

    const teamMap = new Map(teams?.map((t) => [t.id, t.team_name]));

    return filteredBans.map((ban) => ({
      teamId: ban.teamId,
      teamName: teamMap.get(ban.teamId),
      reason: ban.reason,
      bannedAt: ban.bannedAt,
    }));
  } catch (error) {
    console.error("Failed to get banned teams:", error);
    return [];
  }
}

export async function clearBansForPlayer(playerId: string): Promise<void> {
  try {
    const { data: auctionState, error: stateError } = await supabase
      .from("auction_state")
      .select("id, banned_teams")
      .single();

    if (stateError) {
      throw new Error(`Failed to fetch auction state: ${stateError.message}`);
    }

    const currentBans: Array<{ teamId: string; playerId: string; reason?: string; bannedAt: string }> =
      (auctionState.banned_teams as any) || [];

    const updatedBans = currentBans.filter((ban) => ban.playerId !== playerId);

    await supabase
      .from("auction_state")
      .update({
        banned_teams: updatedBans,
      })
      .eq("id", auctionState.id);
  } catch (error) {
    console.error("Failed to clear bans for player:", error);
  }
}

export async function isTeamBanned(teamId: string, playerId: string): Promise<boolean> {
  try {
    const { data: auctionState } = await supabase
      .from("auction_state")
      .select("banned_teams")
      .single();

    const currentBans: Array<{ teamId: string; playerId: string; reason?: string; bannedAt: string }> =
      (auctionState?.banned_teams as any) || [];

    return currentBans.some(
      (ban) => ban.teamId === teamId && ban.playerId === playerId
    );
  } catch (error) {
    console.error("Failed to check if team is banned:", error);
    return false;
  }
}
