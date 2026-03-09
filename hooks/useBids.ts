"use client";

import { useEffect, useState, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/lib/supabase";

export interface Bid {
  id: string;
  player_id: string;
  team_id: string;
  auction_round: number;
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

const sortBids = (items: Bid[]) =>
  [...items].sort((a, b) => {
    if (b.bid_amount !== a.bid_amount) {
      return b.bid_amount - a.bid_amount;
    }

    return new Date(b.created_at).getTime() - new Date(a.created_at).getTime();
  });

/**
 * Hook for fetching and subscribing to bid history for a player
 */
export function useBids(playerId: string | null, auctionRound: number | null = null): UseBidsReturn {
  const queryClient = useQueryClient();
  const [bids, setBids] = useState<Bid[]>([]);

  useEffect(() => {
    setBids([]);
  }, [playerId, auctionRound]);

  // Fetch initial bids
  const { data, isLoading, error } = useQuery({
    queryKey: ["bids", playerId, auctionRound],
    queryFn: async () => {
      if (!playerId || auctionRound == null) return [];

      const { data: bidsData, error: bidsError } = await supabase
        .from("bids")
        .select(`
          id,
          player_id,
          team_id,
          auction_round,
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
        .eq("auction_round", auctionRound)
        .order("bid_amount", { ascending: false })
        .order("created_at", { ascending: false })
        .limit(50);

      if (bidsError) throw bidsError;

      return (bidsData || []).map((bid: any) => ({
        id: bid.id,
        player_id: bid.player_id,
        team_id: bid.team_id,
        auction_round: bid.auction_round,
        team_name: bid.team?.team_name || "Unknown Team",
        team_logo_url: bid.team?.team_logo_url,
        captain_name: bid.team?.captain_name,
        captain_image_url: bid.team?.captain_image_url,
        bid_amount: bid.bid_amount,
        created_at: bid.created_at,
      }));
    },
    enabled: !!playerId && auctionRound != null,
  });

  // Update local state when data changes
  useEffect(() => {
    if (data) {
      setBids(sortBids(data));
    }
  }, [data]);

  // Subscribe to real-time bid changes
  useEffect(() => {
    if (!playerId || auctionRound == null) return;

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
          const incomingBid = payload.new as {
            id: string;
            player_id: string;
            team_id: string;
            auction_round: number;
            bid_amount: number;
            created_at: string;
          };

          if (incomingBid.auction_round !== auctionRound) {
            return;
          }

          setBids((prev) => {
            if (prev.some((bid) => bid.id === incomingBid.id)) {
              return prev;
            }

            const previousTeamBid = prev.find((bid) => bid.team_id === incomingBid.team_id);
            const optimisticBid: Bid = {
              id: incomingBid.id,
              player_id: incomingBid.player_id,
              team_id: incomingBid.team_id,
              auction_round: incomingBid.auction_round,
              team_name: previousTeamBid?.team_name || "Updating team...",
              team_logo_url: previousTeamBid?.team_logo_url,
              captain_name: previousTeamBid?.captain_name,
              captain_image_url: previousTeamBid?.captain_image_url,
              bid_amount: incomingBid.bid_amount,
              created_at: incomingBid.created_at,
            };

            return sortBids([optimisticBid, ...prev]);
          });

          // Fetch the full bid with team info
          const { data: newBid, error } = await supabase
            .from("bids")
            .select(`
              id,
              player_id,
              team_id,
              auction_round,
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

          if (!error && newBid && newBid.auction_round === auctionRound) {
            const formattedBid: Bid = {
              id: newBid.id,
              player_id: newBid.player_id,
              team_id: newBid.team_id,
              auction_round: newBid.auction_round,
              team_name: (newBid.team as any)?.team_name || "Unknown Team",
              team_logo_url: (newBid.team as any)?.team_logo_url,
              captain_name: (newBid.team as any)?.captain_name,
              captain_image_url: (newBid.team as any)?.captain_image_url,
              bid_amount: newBid.bid_amount,
              created_at: newBid.created_at,
            };

            setBids((prev) => {
              const updated = prev.filter((bid) => bid.id !== formattedBid.id);
              return sortBids([formattedBid, ...updated]);
            });

            // Invalidate queries to refresh data
            queryClient.invalidateQueries({ queryKey: ["bids", playerId, auctionRound] });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [playerId, auctionRound, queryClient]);

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
