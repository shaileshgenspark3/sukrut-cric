"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Info, Trophy, Clock3, Users, CircleDollarSign, Activity, ArrowLeft, Search, X } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useRealtimeSubscription } from "@/hooks/useRealtime";
import { useBids } from "@/hooks/useBids";
import { useTimer } from "@/hooks/useTimer";
import { formatMinutesSeconds } from "@/lib/services/timer/timerService";
import Link from "next/link";

const CATEGORIES = ["A+", "A", "B", "F"] as const;
const STAR_LIMITS: Record<string, number> = { "A+": 1, A: 3, B: 4, F: 1 };
const PURSE_SCALE = 100;
const DASHBOARD_FONT = "'Inter', -apple-system, BlinkMacSystemFont, \"Segoe UI\", Roboto, Helvetica, Arial, sans-serif";
const SPONSOR_POPOUT_ANIMATION_MS = 5000;
const HEARTBEAT_INTERVAL_MS = 15000;
const PRESENCE_STALE_MS = 2 * 60 * 1000;
const DASHBOARD_SESSION_KEY = "sukrut_dashboard_presence_session_id";

type BrowseMode = "team" | "player";

type DashboardCurrentPlayer = {
  id: string;
  name: string;
  image_url: string | null;
  category: string | null;
  playing_role: string | null;
  base_price: number | null;
};

type DashboardCurrentBidder = {
  id: string;
  team_name: string;
  team_logo_url: string | null;
};

type DashboardAuctionState = {
  id: string;
  status: string | null;
  current_player_id: string | null;
  current_base_price: number | null;
  current_bid_amount: number | null;
  current_bid: number | null;
  current_bidder_team_id: string | null;
  bid_count: number | null;
  is_paused: boolean | null;
  timer_end: string | null;
  current_player?: DashboardCurrentPlayer;
  current_bidder?: DashboardCurrentBidder;
};

const formatMoney = (amount: number | null | undefined) =>
  `₹${Math.max(0, Math.round(amount || 0)).toLocaleString("en-IN")}`;

const scaled = (value: number | null | undefined) => (value || 0) * PURSE_SCALE;

const imageFallback = (seed: string) =>
  `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(seed || "SPL")}`;
const relationOne = <T,>(value: T | T[] | null | undefined): T | undefined =>
  Array.isArray(value) ? value[0] : value || undefined;

const getOrCreateDashboardSessionId = () => {
  if (typeof window === "undefined") return null;

  const existing = window.localStorage.getItem(DASHBOARD_SESSION_KEY);
  if (existing) return existing;

  const generated =
    (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function" && crypto.randomUUID()) ||
    `dashboard-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
  window.localStorage.setItem(DASHBOARD_SESSION_KEY, generated);
  return generated;
};

export default function LiveAuctionDashboard() {
  useRealtimeSubscription("tournament_settings", ["dashboard"]);
  useRealtimeSubscription("auction_state", ["dashboard"]);
  useRealtimeSubscription("teams", ["dashboard"]);
  useRealtimeSubscription("players", ["dashboard"]);
  useRealtimeSubscription("auction_rules", ["dashboard"]);
  useRealtimeSubscription("bids", ["dashboard"]);
  useRealtimeSubscription("auction_log", ["dashboard"]);

  const [showGrid, setShowGrid] = useState(false);
  const [showBrowseOverlay, setShowBrowseOverlay] = useState(false);
  const [browseMode, setBrowseMode] = useState<BrowseMode>("team");
  const [selectedTeamId, setSelectedTeamId] = useState<string | null>(null);
  const [playerSearch, setPlayerSearch] = useState("");
  const [activeSponsorLogId, setActiveSponsorLogId] = useState<string | null>(null);
  const [isSponsorPopoutAnimating, setIsSponsorPopoutAnimating] = useState(false);
  const [dashboardOpenedAt] = useState(() => Date.now());
  const sponsorTimerRef = useRef<number | null>(null);

  const { data: auctionState } = useQuery<DashboardAuctionState | null>({
    queryKey: ["dashboard", "auction_state"],
    queryFn: async () => {
      const { data } = await supabase
        .from("auction_state")
        .select(
          "id, status, current_player_id, current_base_price, current_bid_amount, current_bid, current_bidder_team_id, bid_count, is_paused, timer_end, current_player:players(id, name, image_url, category, playing_role, base_price), current_bidder:teams(id, team_name, team_logo_url)"
        )
        .single();

      if (!data) return null;

      const source = data as {
        id: string;
        status: string | null;
        current_player_id: string | null;
        current_base_price: number | null;
        current_bid_amount: number | null;
        current_bid: number | null;
        current_bidder_team_id: string | null;
        bid_count: number | null;
        is_paused: boolean | null;
        timer_end: string | null;
        current_player: DashboardCurrentPlayer | DashboardCurrentPlayer[] | null;
        current_bidder: DashboardCurrentBidder | DashboardCurrentBidder[] | null;
      };

      return {
        ...source,
        current_player: relationOne(source.current_player),
        current_bidder: relationOne(source.current_bidder),
      };
    },
  });

  const { data: settings } = useQuery({
    queryKey: ["dashboard", "settings"],
    queryFn: async () => {
      const { data } = await supabase
        .from("tournament_settings")
        .select("id, tournament_name, is_auction_live, global_purse, sponsor_image_url")
        .single();
      return data;
    },
  });

  const { data: players = [] } = useQuery<any[]>({
    queryKey: ["dashboard", "players"],
    queryFn: async () => {
      const { data } = await supabase
        .from("players")
        .select("id, name, image_url, category, playing_role, gender, age, handy, is_sold, sold_to_team_id, sold_price, player_number, created_at")
        .order("player_number", { ascending: true, nullsFirst: false })
        .order("created_at", { ascending: true });
      return data || [];
    },
  });

  const { data: teams = [] } = useQuery<any[]>({
    queryKey: ["dashboard", "teams"],
    queryFn: async () =>
      (
        await supabase
          .from("teams")
          .select("id, team_name, captain_name, captain_image_url, team_logo_url")
      ).data || [],
  });

  const { data: rules = [] } = useQuery<any[]>({
    queryKey: ["dashboard", "rules"],
    queryFn: async () => (await supabase.from("auction_rules").select("*")).data || [],
  });

  const { data: auctionLogs = [] } = useQuery<any[]>({
    queryKey: ["dashboard", "auction_logs"],
    queryFn: async () => {
      const { data } = await supabase
        .from("auction_log")
        .select(
          "id, player_id, team_id, status, sale_price, category, logged_at, deleted, is_manual, player:players(id, name, player_number, image_url, category), team:teams(id, team_name, captain_name, captain_image_url, team_logo_url)"
        )
        .eq("deleted", false)
        .order("logged_at", { ascending: false })
        .limit(1000);
      return data || [];
    },
    refetchInterval: 5000,
  });

  const { data: topSoldPlayers = [] } = useQuery<any[]>({
    queryKey: ["dashboard", "top_sold"],
    queryFn: async () => {
      const { data } = await supabase
        .from("players")
        .select("id, name, sold_price, team:teams!players_sold_to_team_id_fkey(team_name)")
        .eq("is_sold", true)
        .order("sold_price", { ascending: false })
        .limit(10);
      return data || [];
    },
  });

  const { data: recentSales = [] } = useQuery<any[]>({
    queryKey: ["dashboard", "recent_sales"],
    queryFn: async () => {
      const { data } = await supabase
        .from("auction_log")
        .select("id, sale_price, logged_at, player:players(name), team:teams(team_name)")
        .eq("deleted", false)
        .in("status", ["sold", "manual"])
        .order("logged_at", { ascending: false })
        .limit(16);
      return data || [];
    },
    refetchInterval: 5000,
  });

  const currentPlayerId = auctionState?.current_player?.id || auctionState?.current_player_id || null;
  const currentBid =
    auctionState?.current_bid_amount ||
    auctionState?.current_bid ||
    auctionState?.current_base_price ||
    auctionState?.current_player?.base_price ||
    0;

  const { topBids } = useBids(currentPlayerId);
  const { totalSeconds, isPaused } = useTimer();

  const playerStatusMap = useMemo(() => {
    const latestByPlayer = new Map<string, string>();
    for (const log of auctionLogs) {
      if (log?.player_id && !latestByPlayer.has(log.player_id)) {
        latestByPlayer.set(log.player_id, log.status);
      }
    }
    return latestByPlayer;
  }, [auctionLogs]);

  const orderedPlayers = useMemo(
    () =>
      [...players].sort((a, b) => {
        if (a.player_number && b.player_number) return a.player_number - b.player_number;
        if (a.player_number) return -1;
        if (b.player_number) return 1;
        return new Date(a.created_at).getTime() - new Date(b.created_at).getTime();
      }),
    [players]
  );

  const soldCount = players.filter((p) => p.is_sold).length;
  const unsoldCount = players.filter((p) => !p.is_sold && playerStatusMap.get(p.id) === "unsold").length;
  const pendingCount = Math.max(0, players.length - soldCount - unsoldCount);
  const completionPercent = players.length ? ((soldCount + unsoldCount) / players.length) * 100 : 0;

  const categoryStats = useMemo(() => {
    return CATEGORIES.map((category) => {
      const categorySales = auctionLogs.filter(
        (log) =>
          log.category === category &&
          (log.status === "sold" || log.status === "manual") &&
          typeof log.sale_price === "number"
      );
      const amounts = categorySales.map((log) => log.sale_price as number);
      const total = amounts.reduce((sum, amount) => sum + amount, 0);
      const average = amounts.length ? total / amounts.length : 0;
      return {
        category,
        total,
        average,
        count: amounts.length,
        highest: amounts.length ? Math.max(...amounts) : 0,
        lowest: amounts.length ? Math.min(...amounts) : 0,
      };
    });
  }, [auctionLogs]);

  const standings = useMemo(() => {
    return teams.map((team) => {
      const teamPlayers = players.filter((player) => player.sold_to_team_id === team.id && player.is_sold);
      const usedRaw = teamPlayers.reduce((sum, player) => sum + (player.sold_price || 0), 0);
      const rule = rules.find((item) => item.team_id === team.id);
      const startingPurseRaw = rule?.starting_purse ?? settings?.global_purse ?? 30000;
      const captainDeductionRaw = rule?.captain_deduction ?? 0;
      const purseAvailableRaw = startingPurseRaw - captainDeductionRaw;
      const remainingRaw = rule?.current_purse ?? Math.max(0, purseAvailableRaw - usedRaw);

      const categoryCounts: Record<string, number> = { "A+": 0, A: 0, B: 0, F: 0 };
      for (const player of teamPlayers) {
        if (categoryCounts[player.category] !== undefined) {
          categoryCounts[player.category] += 1;
        }
      }

      return {
        team,
        totalPurse: scaled(startingPurseRaw),
        captainDeduction: scaled(captainDeductionRaw),
        purseAvailable: scaled(purseAvailableRaw),
        used: scaled(usedRaw),
        remaining: scaled(remainingRaw),
        playerCount: teamPlayers.length,
        categoryCounts,
      };
    });
  }, [teams, players, rules, settings?.global_purse]);

  const tickerCards = recentSales.length ? [...recentSales, ...recentSales] : [];
  const topTenRows = Array.from({ length: 10 }, (_, idx) => topSoldPlayers[idx] || null);
  const timerCritical = totalSeconds <= 10 && auctionState?.current_player;
  const timerWarning = totalSeconds > 10 && totalSeconds <= 20 && auctionState?.current_player;
  const sponsorImageUrl =
    typeof settings?.sponsor_image_url === "string" ? settings.sponsor_image_url.trim() : "";
  const shouldRenderPausedSponsor = (!settings?.is_auction_live || isPaused) && !!sponsorImageUrl;

  const latestLogByPlayer = useMemo(() => {
    const latestByPlayer = new Map<string, any>();
    for (const log of auctionLogs) {
      if (log?.player_id && !latestByPlayer.has(log.player_id)) {
        latestByPlayer.set(log.player_id, log);
      }
    }
    return latestByPlayer;
  }, [auctionLogs]);

  const teamsById = useMemo(() => {
    const map = new Map<string, any>();
    for (const team of teams) {
      if (team?.id) {
        map.set(team.id, team);
      }
    }
    return map;
  }, [teams]);

  const standingsByTeamId = useMemo(() => {
    const map = new Map<string, (typeof standings)[number]>();
    for (const row of standings) {
      if (row.team?.id) {
        map.set(row.team.id, row);
      }
    }
    return map;
  }, [standings]);

  const selectedTeamPlayers = useMemo(() => {
    if (!selectedTeamId) return [];
    return orderedPlayers
      .filter((player) => player.is_sold && player.sold_to_team_id === selectedTeamId)
      .sort((a, b) => (b.sold_price || 0) - (a.sold_price || 0));
  }, [orderedPlayers, selectedTeamId]);
  const selectedTeam = selectedTeamId ? teamsById.get(selectedTeamId) : null;
  const selectedTeamStanding = selectedTeamId ? standingsByTeamId.get(selectedTeamId) : null;

  const filteredSearchPlayers = useMemo(() => {
    const query = playerSearch.trim().toLowerCase();
    if (!query) return orderedPlayers;
    return orderedPlayers.filter((player) => {
      const searchable = [
        player.name,
        player.category,
        player.playing_role,
        player.handy,
        player.gender,
        String(player.player_number || ""),
      ];
      return searchable.some((value) => (value || "").toString().toLowerCase().includes(query));
    });
  }, [orderedPlayers, playerSearch]);

  const activeSponsorLog = useMemo(
    () => auctionLogs.find((log) => log.id === activeSponsorLogId) || null,
    [auctionLogs, activeSponsorLogId]
  );
  const activeSponsorPlayer = relationOne<any>(activeSponsorLog?.player);
  const activeSponsorTeam = relationOne<any>(activeSponsorLog?.team);
  const sponsorStatusLabel =
    activeSponsorLog?.status === "unsold" ? "UNSOLD" : activeSponsorLog?.status ? "SOLD" : null;
  const sponsorStatusTone =
    activeSponsorLog?.status === "unsold"
      ? "border-amber-300 bg-amber-50 text-amber-700"
      : "border-emerald-300 bg-emerald-50 text-emerald-700";

  useEffect(() => {
    if (teams.length === 0) {
      setSelectedTeamId(null);
      return;
    }

    if (!selectedTeamId || !teams.some((team) => team.id === selectedTeamId)) {
      setSelectedTeamId(teams[0].id);
    }
  }, [teams, selectedTeamId]);

  useEffect(() => {
    const latestLog = auctionLogs[0];
    if (!latestLog?.id) return;
    if (!["sold", "unsold"].includes(latestLog.status)) return;
    const latestLogTime = latestLog.logged_at ? new Date(latestLog.logged_at).getTime() : 0;
    if (latestLogTime > 0 && latestLogTime < dashboardOpenedAt - 2000) return;
    if (latestLog.id === activeSponsorLogId) return;

    setActiveSponsorLogId(latestLog.id);
    setIsSponsorPopoutAnimating(true);

    if (sponsorTimerRef.current) {
      window.clearTimeout(sponsorTimerRef.current);
    }

    sponsorTimerRef.current = window.setTimeout(() => {
      setIsSponsorPopoutAnimating(false);
      sponsorTimerRef.current = null;
    }, SPONSOR_POPOUT_ANIMATION_MS);
  }, [auctionLogs, activeSponsorLogId, dashboardOpenedAt]);

  useEffect(() => {
    const nextPlayerOnTable =
      !!currentPlayerId &&
      (auctionState?.status === "bidding" || auctionState?.status === "waiting_for_first_bid");

    if (!activeSponsorLog?.player_id || !nextPlayerOnTable) return;

    setActiveSponsorLogId(null);
    setIsSponsorPopoutAnimating(false);
    if (sponsorTimerRef.current) {
      window.clearTimeout(sponsorTimerRef.current);
      sponsorTimerRef.current = null;
    }
  }, [activeSponsorLog, currentPlayerId, auctionState?.status]);

  useEffect(() => {
    return () => {
      if (sponsorTimerRef.current) {
        window.clearTimeout(sponsorTimerRef.current);
      }
    };
  }, []);

  useEffect(() => {
    const sessionId = getOrCreateDashboardSessionId();
    if (!sessionId) return;

    let cancelled = false;
    let heartbeatCount = 0;

    const syncPresence = async () => {
      const nowIso = new Date().toISOString();

      try {
        await supabase
          .from("dashboard_presence")
          .upsert(
            {
              session_id: sessionId,
              last_seen: nowIso,
              user_agent: typeof navigator !== "undefined" ? navigator.userAgent : null,
            },
            { onConflict: "session_id" }
          );
      } catch {
        // best effort only
      }

      heartbeatCount += 1;
      if (heartbeatCount % 2 !== 0) return;

      try {
        const staleBefore = new Date(Date.now() - PRESENCE_STALE_MS).toISOString();
        await supabase.from("dashboard_presence").delete().lt("last_seen", staleBefore);
      } catch {
        // best effort only
      }
    };

    void syncPresence();
    const intervalId = window.setInterval(() => {
      if (!cancelled) {
        void syncPresence();
      }
    }, HEARTBEAT_INTERVAL_MS);

    return () => {
      cancelled = true;
      window.clearInterval(intervalId);
    };
  }, []);

  return (
    <div
      data-dashboard-root
      className="min-h-screen bg-gradient-to-b from-slate-100 via-slate-50 to-white text-slate-900"
      style={{ fontFamily: DASHBOARD_FONT, colorScheme: "light" }}
    >
      <div className="mx-auto max-w-7xl px-4 py-8 md:px-6 md:py-10 space-y-6">
        <header className="rounded-3xl border border-slate-200 bg-white p-6 shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-4">
            <div>
              <Link
                href="/"
                className="mb-3 inline-flex items-center gap-1 rounded-full border border-slate-200 bg-slate-50 px-3 py-1 text-xs font-medium text-slate-600 transition hover:bg-slate-100"
              >
                <ArrowLeft className="h-3.5 w-3.5" />
                Back to home
              </Link>
              <p className="text-xs uppercase tracking-[0.2em] text-slate-500">Public Live Auction Dashboard</p>
              <h1 className="text-2xl font-semibold">{settings?.tournament_name || "Sukrut Premier League"}</h1>
            </div>
            <div className="flex flex-wrap items-center justify-end gap-3">
              <button
                type="button"
                onClick={() => setShowBrowseOverlay(true)}
                className="inline-flex items-center gap-2 rounded-full border border-violet-300 bg-violet-50 px-4 py-2 text-sm font-semibold text-violet-700 shadow-[0_0_22px_rgba(139,92,246,0.25)] transition hover:bg-violet-100"
              >
                Browse Team/Player
              </button>
              <div
                className={`inline-flex items-center gap-2 rounded-2xl border px-4 py-2 text-sm font-medium ${
                  settings?.is_auction_live
                    ? "border-emerald-200 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-600"
                }`}
              >
                <span
                  className={`h-2 w-2 rounded-full ${
                    settings?.is_auction_live ? "bg-emerald-500 animate-pulse" : "bg-slate-400"
                  }`}
                />
                {settings?.is_auction_live ? "Live Auction Running" : "Auction Paused"}
              </div>
            </div>
          </div>

          <div className="mt-5 grid grid-cols-2 gap-2 sm:grid-cols-4">
            <div className="rounded-xl bg-emerald-50 px-3 py-2">
              <p className="text-xs text-emerald-700">Sold</p>
              <p className="text-lg font-semibold">{soldCount}</p>
            </div>
            <div className="rounded-xl bg-amber-50 px-3 py-2">
              <p className="text-xs text-amber-700">Unsold</p>
              <p className="text-lg font-semibold">{unsoldCount}</p>
            </div>
            <div className="rounded-xl bg-slate-100 px-3 py-2">
              <p className="text-xs text-slate-600">Pending</p>
              <p className="text-lg font-semibold">{pendingCount}</p>
            </div>
            <div className="rounded-xl bg-blue-50 px-3 py-2">
              <p className="text-xs text-blue-700">Completion</p>
              <p className="text-lg font-semibold">{completionPercent.toFixed(0)}%</p>
            </div>
          </div>
        </header>

        <section className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-7 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Users className="h-5 w-5 text-blue-600" />
              Live Player & Current Bidding
            </h2>

            {activeSponsorLog && (
              <div
                className={`mb-4 rounded-2xl border p-4 transition-all duration-500 ${
                  isSponsorPopoutAnimating
                    ? "scale-[1.01] shadow-[0_0_34px_rgba(59,130,246,0.25)]"
                    : "shadow-sm"
                } ${sponsorStatusTone}`}
              >
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                  <img
                    src={activeSponsorPlayer?.image_url || imageFallback(activeSponsorPlayer?.name || "Player")}
                    alt={activeSponsorPlayer?.name || "Player"}
                    className="h-16 w-16 rounded-xl border border-white/70 bg-white object-cover"
                  />
                  <div className="flex-1">
                    <div className="mb-1 flex flex-wrap items-center gap-2 text-xs font-semibold">
                      {sponsorStatusLabel && (
                        <span className="rounded-full border border-current/30 bg-white/60 px-2 py-0.5">
                          {sponsorStatusLabel}
                        </span>
                      )}
                      <span className="rounded-full bg-white/70 px-2 py-0.5">
                        {activeSponsorPlayer?.category || activeSponsorLog.category || "Category"}
                      </span>
                      {isSponsorPopoutAnimating && (
                        <span className="rounded-full bg-white/80 px-2 py-0.5 text-[10px] uppercase tracking-wide">
                          Sponsor Spotlight
                        </span>
                      )}
                    </div>
                    <p className="text-base font-semibold text-slate-800">{activeSponsorPlayer?.name || "Player"}</p>
                    <p className="text-sm font-semibold text-slate-700">
                      {activeSponsorLog.status === "unsold"
                        ? "No winning bid registered"
                        : `Final Bid: ${formatMoney(scaled(activeSponsorLog.sale_price || 0))}`}
                    </p>
                    <div className="mt-1 flex items-center gap-2 text-xs text-slate-600">
                      <span>Team: {activeSponsorTeam?.team_name || "N/A"}</span>
                      <span>•</span>
                      <span>Captain: {activeSponsorTeam?.captain_name || "N/A"}</span>
                      {activeSponsorTeam?.captain_image_url && (
                        <img
                          src={activeSponsorTeam.captain_image_url}
                          alt={activeSponsorTeam?.captain_name || "Captain"}
                          className="h-5 w-5 rounded-full border border-white/70 bg-white object-cover"
                        />
                      )}
                    </div>
                  </div>
                  <div className="w-full max-w-[140px]">
                    {sponsorImageUrl ? (
                      <img
                        src={sponsorImageUrl}
                        alt="Sponsor"
                        className="h-16 w-full rounded-xl border border-white/70 bg-white object-cover"
                      />
                    ) : (
                      <div className="flex h-16 items-center justify-center rounded-xl border border-dashed border-white/70 bg-white/60 text-xs font-semibold text-slate-500">
                        Sponsor
                      </div>
                    )}
                  </div>
                </div>
              </div>
            )}

            {auctionState?.current_player ? (
              <div className="space-y-4">
                {shouldRenderPausedSponsor && (
                  <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                    <p className="mb-3 text-center text-sm font-semibold text-slate-600">
                      Auction paused • Sponsor showcase
                    </p>
                    <img
                      src={sponsorImageUrl}
                      alt="Sponsor"
                      className="mx-auto h-56 w-full rounded-2xl border border-slate-200 bg-white object-contain"
                    />
                  </div>
                )}

                <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                  <div className="flex flex-col gap-4 sm:flex-row sm:items-center">
                    <img
                      src={auctionState.current_player.image_url || imageFallback(auctionState.current_player.name)}
                      alt={auctionState.current_player.name}
                      className="h-24 w-24 rounded-2xl border border-slate-200 bg-white object-cover"
                    />
                    <div className="flex-1">
                      <div className="mb-2 flex flex-wrap gap-2 text-xs font-semibold">
                        <span className="rounded-full bg-blue-100 px-3 py-1 text-blue-700">{auctionState.current_player.category}</span>
                        <span className="rounded-full bg-indigo-100 px-3 py-1 text-indigo-700">{auctionState.current_player.playing_role}</span>
                      </div>
                      <h3 className="text-xl font-semibold">{auctionState.current_player.name}</h3>
                      <p className="text-sm text-slate-500">Base Price: {formatMoney(scaled(auctionState.current_player.base_price || 0))}</p>
                      <p className="mt-1 text-lg font-semibold text-emerald-700">Current Bid: {formatMoney(scaled(currentBid))}</p>
                      {auctionState?.current_bidder && (
                        <p className="mt-1 text-xs text-slate-500">
                          Highest bidder: <span className="font-semibold text-slate-700">{auctionState.current_bidder.team_name}</span>
                        </p>
                      )}
                    </div>
                  </div>
                </div>

                <div
                  className={`rounded-2xl border p-4 text-center ${
                    timerCritical
                      ? "border-red-200 bg-red-50"
                      : timerWarning
                      ? "border-amber-200 bg-amber-50"
                      : "border-slate-200 bg-slate-50"
                  }`}
                >
                  <p className="mb-1 flex items-center justify-center gap-1 text-sm text-slate-500">
                    <Clock3 className="h-4 w-4" /> Live Timer
                  </p>
                  <p
                    className={`text-3xl font-semibold ${
                      timerCritical ? "text-red-700" : timerWarning ? "text-amber-700" : "text-slate-900"
                    }`}
                  >
                    {formatMinutesSeconds(totalSeconds)}
                  </p>
                </div>

                <div>
                  <p className="mb-2 text-sm font-semibold text-slate-700">Top 3 Live Bids</p>
                  <div className="space-y-2">
                    {topBids.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 p-3 text-sm text-slate-500">No bids yet for this player.</div>
                    ) : (
                      topBids.map((bid, index) => (
                        <div
                          key={bid.id}
                          className={`flex items-center justify-between rounded-xl border p-3 ${
                            index === 0 ? "border-emerald-200 bg-emerald-50/60" : "border-slate-200 bg-white"
                          }`}
                        >
                          <div className="flex items-center gap-3">
                            <span className="w-6 text-xs font-semibold text-slate-500">#{index + 1}</span>
                            <img
                              src={bid.team_logo_url || imageFallback(bid.team_name)}
                              alt={bid.team_name}
                              className="h-8 w-8 rounded-lg border border-slate-200 bg-white object-cover"
                            />
                            <div>
                              <p className="text-sm font-semibold">{bid.team_name}</p>
                              <div className="flex items-center gap-2 text-xs text-slate-500">
                                <img
                                  src={bid.captain_image_url || imageFallback(bid.captain_name || bid.team_name)}
                                  alt={bid.captain_name || "Captain"}
                                  className="h-5 w-5 rounded-full border border-slate-200 bg-white object-cover"
                                />
                                <span>{bid.captain_name || "Captain"}</span>
                              </div>
                            </div>
                          </div>
                          <p className="text-sm font-semibold text-emerald-700">{formatMoney(scaled(bid.bid_amount))}</p>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-slate-300 p-8 text-center text-slate-500">Waiting for the next player to be deployed.</div>
            )}
          </div>

          <div className="lg:col-span-5 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Activity className="h-5 w-5 text-indigo-600" />
              Category Stats & Auction Status
            </h2>

            <div className="overflow-x-auto rounded-2xl border border-slate-200">
              <table className="w-full min-w-[420px] text-sm">
                <thead className="bg-slate-50">
                  <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                    <th className="py-2">Category</th>
                    <th className="text-right pr-2">Total Bid Amt.</th>
                    <th className="text-right pr-2">Avg. Bid Amt.</th>
                    <th className="text-right pr-2">Bidded Players</th>
                    <th className="text-right pr-2">Highest Bid</th>
                    <th className="text-right pr-2">Lowest Bid</th>
                  </tr>
                </thead>
                <tbody>
                  {categoryStats.map((row) => (
                    <tr key={row.category} className="border-b border-slate-100 last:border-0 odd:bg-white even:bg-slate-50/40">
                      <td className="py-2 pl-2 font-semibold">{row.category}</td>
                      <td className="text-right pr-2">{formatMoney(scaled(row.total))}</td>
                      <td className="text-right pr-2">{formatMoney(scaled(row.average))}</td>
                      <td className="text-right pr-2">{row.count}</td>
                      <td className="text-right pr-2">{formatMoney(scaled(row.highest))}</td>
                      <td className="text-right pr-2">{formatMoney(scaled(row.lowest))}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="mt-5 rounded-2xl border border-slate-200 bg-slate-50 p-4">
              <div className="mb-3 flex items-center justify-between">
                <p className="text-sm font-semibold">Auction Status Summary</p>
                <button
                  onClick={() => setShowGrid(true)}
                  className="rounded-full border border-slate-300 bg-white p-1 text-slate-600 transition hover:bg-slate-100"
                  aria-label="Open complete player tracking grid"
                >
                  <Info className="h-4 w-4" />
                </button>
              </div>

              <div className="mb-4 grid grid-cols-3 gap-2 text-center text-sm">
                <div className="rounded-xl bg-emerald-50 p-2">
                  <p className="text-xs text-emerald-700">Sold</p>
                  <p className="font-semibold">{soldCount}</p>
                </div>
                <div className="rounded-xl bg-amber-50 p-2">
                  <p className="text-xs text-amber-700">Unsold</p>
                  <p className="font-semibold">{unsoldCount}</p>
                </div>
                <div className="rounded-xl bg-slate-200 p-2">
                  <p className="text-xs text-slate-700">Pending</p>
                  <p className="font-semibold">{pendingCount}</p>
                </div>
              </div>

              <div className="flex items-center gap-3">
                <div
                  className="relative h-20 w-20 rounded-full"
                  style={{
                    background: `conic-gradient(#2563eb ${completionPercent}%, #e2e8f0 ${completionPercent}% 100%)`,
                  }}
                >
                  <div className="absolute inset-2 rounded-full bg-slate-50" />
                  <div className="absolute inset-0 flex items-center justify-center text-xs font-semibold">
                    {completionPercent.toFixed(0)}%
                  </div>
                </div>
                <div>
                  <p className="text-sm font-semibold">Completion Percentage</p>
                  <p className="text-xs text-slate-500">(Sold + Unsold) / Total Players</p>
                </div>
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
          <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
            <CircleDollarSign className="h-5 w-5 text-violet-600" />
            Team Standings & Purse Status
          </h2>

          <div className="overflow-x-auto">
            <table className="w-full min-w-[1180px] text-sm">
              <thead className="sticky top-0 bg-slate-50">
                <tr className="border-b border-slate-200 text-left text-xs uppercase tracking-wide text-slate-500">
                  <th className="py-2">Team Name</th>
                  <th>Captain Name</th>
                  <th className="text-right pr-2">Total Purse Given</th>
                  <th className="text-right pr-2">Captain Deduction</th>
                  <th className="text-right pr-2">Purse Available</th>
                  <th className="text-right pr-2">Used</th>
                  <th className="text-right pr-2">Remaining</th>
                  <th>Player Category Tracker</th>
                  <th className="text-right pr-2">Total Count</th>
                </tr>
              </thead>
              <tbody>
                {standings.map((row) => (
                  <tr key={row.team.id} className="border-b border-slate-100 last:border-0 align-top hover:bg-slate-50/60">
                    <td className="py-3">
                      <div className="flex items-center gap-2 font-semibold">
                        <img
                          src={row.team.team_logo_url || imageFallback(row.team.team_name)}
                          alt={row.team.team_name}
                          className="h-7 w-7 rounded-lg border border-slate-200 bg-white object-cover"
                        />
                        {row.team.team_name}
                      </div>
                    </td>
                    <td>
                      <div className="flex items-center gap-2">
                        <img
                          src={row.team.captain_image_url || imageFallback(row.team.captain_name)}
                          alt={row.team.captain_name}
                          className="h-7 w-7 rounded-full border border-slate-200 bg-white object-cover"
                        />
                        <span>{row.team.captain_name}</span>
                      </div>
                    </td>
                    <td className="text-right pr-2 font-medium">{formatMoney(row.totalPurse)}</td>
                    <td className="text-right pr-2">{formatMoney(row.captainDeduction)}</td>
                    <td className="text-right pr-2">{formatMoney(row.purseAvailable)}</td>
                    <td className="text-right pr-2">{formatMoney(row.used)}</td>
                    <td className="text-right pr-2 font-semibold text-emerald-700">{formatMoney(row.remaining)}</td>
                    <td>
                      <div className="space-y-1 py-1">
                        {CATEGORIES.map((category) => {
                          const limit = STAR_LIMITS[category];
                          const count = row.categoryCounts[category] || 0;
                          return (
                            <div key={`${row.team.id}-${category}`} className="flex items-center gap-2 text-xs">
                              <span className="w-5 font-semibold">{category}</span>
                              <div className="flex gap-1">
                                {Array.from({ length: limit }).map((_, idx) => (
                                  <span key={idx} className={idx < count ? "text-amber-500" : "text-slate-300"}>
                                    {idx < count ? "★" : "☆"}
                                  </span>
                                ))}
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    </td>
                    <td className="pr-2 text-right font-semibold">{row.playerCount}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className="grid gap-6 lg:grid-cols-12">
          <div className="lg:col-span-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 flex items-center gap-2 text-lg font-semibold">
              <Trophy className="h-5 w-5 text-amber-500" />
              Top 10 Successful Bids
            </h2>
            <div className="overflow-hidden rounded-2xl border border-slate-200">
              <table className="w-full text-sm">
                <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                  <tr>
                    <th className="px-3 py-2">Rank</th>
                    <th>Player Name</th>
                    <th>Team Name</th>
                    <th className="text-right pr-3">Sold Amount</th>
                  </tr>
                </thead>
                <tbody>
                  {topTenRows.map((player, index) => {
                    if (!player) {
                      return (
                        <tr key={`placeholder-${index}`} className="border-t border-slate-100 text-slate-400">
                          <td className="px-3 py-2 font-semibold">{index + 1}</td>
                          <td>-</td>
                          <td>-</td>
                          <td className="pr-3 text-right">-</td>
                        </tr>
                      );
                    }

                    const soldTeam = relationOne<{ team_name?: string }>(player.team);
                    return (
                      <tr key={player.id} className="border-t border-slate-100">
                        <td className={`px-3 py-2 font-semibold ${index < 3 ? "text-amber-600" : ""}`}>{index + 1}</td>
                        <td>{player.name}</td>
                        <td>{soldTeam?.team_name || "-"}</td>
                        <td className="pr-3 text-right font-semibold text-emerald-700">
                          {formatMoney(scaled(player.sold_price || 0))}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </div>

          <div className="lg:col-span-6 rounded-3xl border border-slate-200 bg-white p-5 shadow-sm">
            <h2 className="mb-4 text-lg font-semibold">Recent Bids Ticker</h2>
            {recentSales.length === 0 ? (
              <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">No completed sales yet.</div>
            ) : (
              <div className="relative overflow-hidden rounded-2xl border border-slate-200 bg-slate-50 py-3">
                <div className="pointer-events-none absolute inset-y-0 left-0 z-10 w-10 bg-gradient-to-r from-slate-50 to-transparent" />
                <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-10 bg-gradient-to-l from-slate-50 to-transparent" />
                <div className="sales-ticker-track flex w-max gap-3 px-3">
                  {tickerCards.map((sale, idx) => {
                    const salePlayer = relationOne<{ name?: string }>(sale.player);
                    const saleTeam = relationOne<{ team_name?: string }>(sale.team);
                    return (
                      <div key={`${sale.id}-${idx}`} className="rounded-xl border border-slate-200 bg-white px-4 py-2 text-sm shadow-sm whitespace-nowrap">
                        <span className="font-semibold">{salePlayer?.name || "Player"}</span>
                        <span className="mx-2 text-slate-500">•</span>
                        <span className="text-emerald-700">{formatMoney(scaled(sale.sale_price || 0))}</span>
                        <span className="mx-2 text-slate-500">•</span>
                        <span className="text-slate-600">{saleTeam?.team_name || "Unknown Team"}</span>
                        <span className="mx-2 text-slate-300">•</span>
                        <span className="text-xs text-slate-500">
                          {sale.logged_at
                            ? new Date(sale.logged_at).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" })
                            : "--:--"}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            )}
          </div>
        </section>
      </div>

      {showBrowseOverlay && (
        <div
          className="fixed inset-0 z-[55] flex items-center justify-center bg-slate-900/50 p-4"
          onClick={() => setShowBrowseOverlay(false)}
        >
          <div
            role="dialog"
            aria-modal="true"
            className="h-[90vh] w-[65vw] min-w-[320px] overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-2xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <div>
                <h3 className="text-lg font-semibold">Browse Team/Player</h3>
                <p className="text-xs text-slate-500">Live roster browser for teams and auction outcomes</p>
              </div>
              <button
                type="button"
                onClick={() => setShowBrowseOverlay(false)}
                className="rounded-lg border border-slate-300 p-2 text-slate-600 hover:bg-slate-100"
                aria-label="Close team and player browser"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="border-b border-slate-200 p-3">
              <div className="inline-flex rounded-xl bg-slate-100 p-1 text-sm">
                <button
                  type="button"
                  onClick={() => setBrowseMode("team")}
                  className={`rounded-lg px-3 py-1.5 font-medium transition ${
                    browseMode === "team" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                  }`}
                >
                  Team mode
                </button>
                <button
                  type="button"
                  onClick={() => setBrowseMode("player")}
                  className={`rounded-lg px-3 py-1.5 font-medium transition ${
                    browseMode === "player" ? "bg-white text-slate-900 shadow-sm" : "text-slate-600"
                  }`}
                >
                  Player search mode
                </button>
              </div>
            </div>

            <div className="h-[calc(90vh-136px)] overflow-y-auto p-4">
              {browseMode === "team" ? (
                <div className="grid gap-4 lg:grid-cols-[260px_minmax(0,1fr)]">
                  <div className="max-h-[72vh] overflow-y-auto rounded-2xl border border-slate-200 bg-slate-50 p-2">
                    <div className="space-y-2">
                      {teams.map((team) => (
                        <button
                          key={team.id}
                          type="button"
                          onClick={() => setSelectedTeamId(team.id)}
                          className={`w-full rounded-xl border p-2 text-left transition ${
                            selectedTeamId === team.id
                              ? "border-blue-300 bg-blue-50 shadow-[0_0_14px_rgba(59,130,246,0.2)]"
                              : "border-slate-200 bg-white hover:bg-slate-100"
                          }`}
                        >
                          <div className="flex items-center gap-2">
                            <img
                              src={team.team_logo_url || imageFallback(team.team_name)}
                              alt={team.team_name}
                              className="h-9 w-9 rounded-lg border border-slate-200 bg-white object-cover"
                            />
                            <div className="min-w-0 flex-1">
                              <p className="truncate text-sm font-semibold text-slate-800">{team.team_name}</p>
                              <div className="flex items-center gap-1.5 text-xs text-slate-500">
                                <img
                                  src={team.captain_image_url || imageFallback(team.captain_name || team.team_name)}
                                  alt={team.captain_name || "Captain"}
                                  className="h-4 w-4 rounded-full border border-slate-200 bg-white object-cover"
                                />
                                <span className="truncate">{team.captain_name || "Captain"}</span>
                              </div>
                            </div>
                          </div>
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-4">
                    {selectedTeam ? (
                      <>
                        <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
                          <div className="flex flex-wrap items-center gap-3">
                            <img
                              src={selectedTeam.team_logo_url || imageFallback(selectedTeam.team_name)}
                              alt={selectedTeam.team_name}
                              className="h-12 w-12 rounded-xl border border-slate-200 bg-white object-cover"
                            />
                            <div>
                              <p className="text-lg font-semibold text-slate-900">{selectedTeam.team_name}</p>
                              <div className="flex items-center gap-2 text-sm text-slate-600">
                                <img
                                  src={selectedTeam.captain_image_url || imageFallback(selectedTeam.captain_name || selectedTeam.team_name)}
                                  alt={selectedTeam.captain_name || "Captain"}
                                  className="h-5 w-5 rounded-full border border-slate-200 bg-white object-cover"
                                />
                                <span>{selectedTeam.captain_name || "Captain"}</span>
                              </div>
                            </div>
                          </div>

                          <div className="mt-4 grid grid-cols-1 gap-2 sm:grid-cols-3">
                            <div className="rounded-xl bg-white p-3">
                              <p className="text-xs text-slate-500">Total Purse</p>
                              <p className="text-lg font-semibold">{formatMoney(selectedTeamStanding?.totalPurse || 0)}</p>
                            </div>
                            <div className="rounded-xl bg-white p-3">
                              <p className="text-xs text-slate-500">Purse Deduction</p>
                              <p className="text-lg font-semibold text-amber-700">
                                {formatMoney(selectedTeamStanding?.captainDeduction || 0)}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white p-3">
                              <p className="text-xs text-slate-500">Purse Obtained</p>
                              <p className="text-lg font-semibold text-slate-800">
                                {formatMoney(selectedTeamStanding?.purseAvailable || 0)}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white p-3">
                              <p className="text-xs text-slate-500">Purse Used</p>
                              <p className="text-lg font-semibold text-emerald-700">
                                {formatMoney(selectedTeamStanding?.used || 0)}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white p-3">
                              <p className="text-xs text-slate-500">Remaining Purse</p>
                              <p className="text-lg font-semibold text-blue-700">
                                {formatMoney(selectedTeamStanding?.remaining || 0)}
                              </p>
                            </div>
                            <div className="rounded-xl bg-white p-3">
                              <p className="text-xs text-slate-500">Purchased Players</p>
                              <p className="text-lg font-semibold">{selectedTeamPlayers.length}</p>
                            </div>
                          </div>
                        </div>

                        <div className="overflow-x-auto rounded-2xl border border-slate-200">
                          <table className="w-full min-w-[760px] text-sm">
                            <thead className="bg-slate-50 text-left text-xs uppercase tracking-wide text-slate-500">
                              <tr>
                                <th className="px-3 py-2">Category</th>
                                <th>Player Image</th>
                                <th>Player Name</th>
                                <th>Age</th>
                                <th className="text-right pr-3">Bid Amount</th>
                                <th className="pr-3">Handy</th>
                              </tr>
                            </thead>
                            <tbody>
                              {selectedTeamPlayers.length === 0 ? (
                                <tr>
                                  <td colSpan={6} className="px-3 py-6 text-center text-sm text-slate-500">
                                    No purchased players yet for this team.
                                  </td>
                                </tr>
                              ) : (
                                selectedTeamPlayers.map((player) => (
                                  <tr key={player.id} className="border-t border-slate-100">
                                    <td className="px-3 py-2 font-semibold">{player.category || "-"}</td>
                                    <td>
                                      <img
                                        src={player.image_url || imageFallback(player.name)}
                                        alt={player.name}
                                        className="h-10 w-10 rounded-lg border border-slate-200 bg-white object-cover"
                                      />
                                    </td>
                                    <td className="font-medium">{player.name}</td>
                                    <td>{player.age || "-"}</td>
                                    <td className="pr-3 text-right font-semibold text-emerald-700">
                                      {formatMoney(scaled(player.sold_price || 0))}
                                    </td>
                                    <td className="pr-3">{player.handy || "-"}</td>
                                  </tr>
                                ))
                              )}
                            </tbody>
                          </table>
                        </div>
                      </>
                    ) : (
                      <div className="rounded-2xl border border-dashed border-slate-300 p-6 text-sm text-slate-500">
                        No team selected.
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="space-y-4">
                  <div className="relative">
                    <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
                    <input
                      value={playerSearch}
                      onChange={(event) => setPlayerSearch(event.target.value)}
                      placeholder="Search player name, category, role, handy..."
                      className="w-full rounded-xl border border-slate-300 bg-white py-2 pl-9 pr-3 text-sm text-slate-800 outline-none ring-blue-200 focus:ring"
                    />
                  </div>

                  <div className="max-h-[72vh] space-y-2 overflow-y-auto pr-1">
                    {filteredSearchPlayers.length === 0 ? (
                      <div className="rounded-xl border border-dashed border-slate-300 p-4 text-sm text-slate-500">
                        No players match your search.
                      </div>
                    ) : (
                      filteredSearchPlayers.map((player) => {
                        const playerStatus = player.is_sold
                          ? "sold"
                          : playerStatusMap.get(player.id) === "unsold"
                          ? "unsold"
                          : "pending";
                        const latestPlayerLog = latestLogByPlayer.get(player.id);
                        const teamFromLog = relationOne<any>(latestPlayerLog?.team);
                        const resolvedTeam =
                          teamsById.get(player.sold_to_team_id || latestPlayerLog?.team_id || "") || teamFromLog;
                        const resolvedBid = player.sold_price ?? latestPlayerLog?.sale_price ?? 0;

                        return (
                          <div key={player.id} className="rounded-xl border border-slate-200 bg-white p-3">
                            <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                              <div className="flex items-center gap-3">
                                <img
                                  src={player.image_url || imageFallback(player.name)}
                                  alt={player.name}
                                  className="h-11 w-11 rounded-xl border border-slate-200 bg-white object-cover"
                                />
                                <div>
                                  <p className="font-semibold text-slate-900">{player.name}</p>
                                  <p className="text-xs text-slate-500">
                                    {player.category || "-"} • {player.playing_role || "-"}
                                  </p>
                                </div>
                              </div>

                              <span
                                className={`inline-flex rounded-full px-3 py-1 text-xs font-semibold ${
                                  playerStatus === "sold"
                                    ? "bg-emerald-100 text-emerald-700 shadow-[0_0_16px_rgba(16,185,129,0.35)]"
                                    : playerStatus === "unsold"
                                    ? "bg-red-100 text-red-700 shadow-[0_0_16px_rgba(239,68,68,0.35)]"
                                    : "bg-slate-100 text-slate-600"
                                }`}
                              >
                                {playerStatus === "sold" ? "SOLD" : playerStatus === "unsold" ? "UNSOLD" : "PENDING"}
                              </span>
                            </div>

                            <p className="mt-1 text-xs text-slate-600">
                              {playerStatus === "sold"
                                ? `${formatMoney(scaled(resolvedBid))} • ${resolvedTeam?.team_name || "Unknown Team"} • ${
                                    resolvedTeam?.captain_name || "Captain"
                                  }`
                                : playerStatus === "unsold"
                                ? "No winning bid (unsold)"
                                : "Awaiting auction turn"}
                            </p>
                          </div>
                        );
                      })
                    )}
                  </div>
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {showGrid && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/50 p-4" onClick={() => setShowGrid(false)}>
          <div
            role="dialog"
            aria-modal="true"
            className="max-h-[90vh] w-full max-w-5xl overflow-hidden rounded-3xl border border-slate-200 bg-white shadow-xl"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-slate-200 p-4">
              <h3 className="text-lg font-semibold">Complete Player Tracking Grid</h3>
              <button
                onClick={() => setShowGrid(false)}
                className="rounded-lg border border-slate-300 px-3 py-1 text-sm hover:bg-slate-100"
              >
                Close
              </button>
            </div>
            <div className="max-h-[70vh] overflow-y-auto p-4">
              <div className="mb-3 flex flex-wrap gap-2 text-xs">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-100 px-2 py-1 text-emerald-700">S = Sold</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-1 text-amber-700">U = Unsold</span>
                <span className="inline-flex items-center gap-1 rounded-full bg-slate-100 px-2 py-1 text-slate-700">Blank = Pending</span>
              </div>
              <div className="grid grid-cols-6 gap-2 sm:grid-cols-8 md:grid-cols-10 lg:grid-cols-12">
                {orderedPlayers.map((player, index) => {
                  const status = player.is_sold ? "S" : playerStatusMap.get(player.id) === "unsold" ? "U" : "";
                  const number = player.player_number || index + 1;

                  return (
                    <div
                      key={player.id}
                      title={`${number}. ${player.name}`}
                      className={`flex h-10 items-center justify-center rounded-lg border text-sm font-semibold ${
                        status === "S"
                          ? "border-emerald-400 bg-emerald-100 text-emerald-700"
                          : status === "U"
                          ? "border-amber-300 bg-amber-100 text-amber-700"
                          : "border-slate-200 bg-white text-slate-700"
                      }`}
                    >
                      {number}
                      {status && <span className="ml-1">{status}</span>}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
