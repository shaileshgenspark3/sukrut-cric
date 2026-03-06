"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface Bid {
  id: string;
  player_id: string;
  team_id: string;
  team_name: string;
  team_logo_url?: string;
  captain_name?: string;
  captain_image_url?: string;
  bid_amount: number;
  created_at: string;
}

interface UseBidsReturn {
  bids: Bid[];
  topBids: Bid[];
  historyBids: Bid[];
  isLoading: boolean;
  error: Error | null;
}

/**
 * Hook for fetching and subscribing to bid history for a player
 */
export function useBids(playerId: string | null): UseBidsReturn {
  const queryClient = useQueryClient();
  const [bids, setBids] = useState<Bid[]>([]);

  // Fetch initial bids
  const { data, isLoading, error } = useQuery({
    queryKey: ["bids", playerId],
    queryFn: async () => {
      if (!playerId) return [];

      const { data: bidsData, error: bidsError } = await supabase
        .from("bids")
        .select(`
          id,
          player_id,
          team_id,
          bid_amount,
          created_at,
          team:teams(
            team_name,
            team_logo_url,
            captain_name,
            captain_image_url
          )
        `)
        .eq("player_id", playerId)
        .order("bid_amount", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);

      if (bidsError) throw bidsError;

      return (bidsData || []).map((bid: any) => ({
        id: bid.id,
        player_id: bid.player_id,
        team_id: bid.team_id,
        team_name: bid.team?.team_name || "Unknown Team",
        team_logo_url: bid.team?.team_logo_url,
        captain_name: bid.team?.captain_name,
        captain_image_url: bid.team?.captain_image_url,
        bid_amount: bid.bid_amount,
        created_at: bid.created_at,
      }));
    },
    enabled: !!playerId,
  });

  // Update local state when data changes
  useEffect(() => {
    if (data) {
      setBids(data);
    }
  }, [data]);

  // Subscribe to real-time bid changes
  useEffect(() => {
    if (!playerId) return;

    const channel = supabase
      .channel(`bids:${playerId}`)
      .on(
        "postgres_changes",
        {
          event: "INSERT",
          schema: "public",
          table: "bids",
          filter: `player_id=eq.${playerId}`,
        },
        async (payload) => {
          // Fetch the full bid with team info
          const { data: newBid, error } = await supabase
            .from("bids")
            .select(`
              id,
              player_id,
              team_id,
              bid_amount,
              created_at,
              team:teams(
                team_name,
                team_logo_url,
                captain_name,
                captain_image_url
              )
            `)
            .eq("id", payload.new.id)
            .single();

          if (!error && newBid) {
          const formattedBid: Bid = {
            id: newBid.id,
            player_id: newBid.player_id,
            team_id: newBid.team_id,
            team_name: (newBid.team as any)?.team_name || "Unknown Team",
            team_logo_url: (newBid.team as any)?.team_logo_url,
            captain_name: (newBid.team as any)?.captain_name,
            captain_image_url: (newBid.team as any)?.captain_image_url,
            bid_amount: newBid.bid_amount,
            created_at: newBid.created_at,
          };

            setBids((prev) => {
              // Add new bid and re-sort by amount
              const updated = [formattedBid, ...prev];
              return updated.sort((a, b) => b.bid_amount - a.bid_amount);
            });

            // Invalidate queries to refresh data
            queryClient.invalidateQueries({ queryKey: ["bids", playerId] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId, queryClient]);

  // Memoize top 3 and history bids
  const topBids = useMemo(() => bids.slice(0, 3), [bids]);
  const historyBids = useMemo(() => bids.slice(3), [bids]);

  return {
    bids,
    topBids,
    historyBids,
    isLoading,
    error: error as Error | null,
  };
}

export default useBids;
