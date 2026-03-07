"use client";

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRealtimeSubscription } from '@/hooks/useRealtime';
import { useTimer } from '@/hooks/useTimer';
import { formatMinutesSeconds } from '@/lib/services/timer/timerService';
import {
    Loader2, LogOut, Wallet, User as UserIcon,
    Users, Trophy, AlertCircle, Info, Zap,
    Shield, Target, ChevronRight, PieChart,
    ArrowUpRight, Flame, PlayCircle, PauseCircle
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import { PlayerCard } from '@/components/admin/PlayerCard';
import { useBids } from '@/hooks/useBids';
import { BidHistory } from '@/components/admin/BidHistory';
import { getTeamEligibility, checkCategoryEligibility } from '@/lib/validation/bidValidation';
import { placeBidWithValidation } from '@/lib/actions/bids';

type SponsorTriggerStatus = 'sold' | 'unsold';

interface AuctionPlayerSnapshot {
    id: string;
    name: string;
    category?: string | null;
    playing_role?: string | null;
    image_url?: string | null;
    sold_price?: number | null;
}

export default function CaptainDashboard() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [userId, setUserId] = useState<string | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(({ data: { session } }) => {
            if (!session) router.push('/login?role=captain');
            else setUserId(session.user.id);
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) router.push('/login?role=captain');
            else setUserId(session.user.id);
        });

        return () => subscription.unsubscribe();
    }, [router]);

    useRealtimeSubscription('tournament_settings', ['settings']);
    useRealtimeSubscription('auction_state', ['auction_state']);
    useRealtimeSubscription('auction_rules', ['rules', userId!]);
    useRealtimeSubscription('players', ['team_roster', userId!]);
    useRealtimeSubscription('players', ['sold_player_count']);
    useRealtimeSubscription('teams', ['team_details', userId!]);
    useRealtimeSubscription('auction_log', ['captain_latest_outcome']);


    const { data: team } = useQuery({
        queryKey: ['team_details', userId],
        queryFn: async () => {
            const { data } = await supabase.from('teams').select('*').eq('captain_user_id', userId).single();
            return data;
        },
        enabled: !!userId,
    });

    const { data: rules } = useQuery({
        queryKey: ['rules', userId],
        queryFn: async () => {
            if (!team?.id) return null;
            const { data } = await supabase.from('auction_rules').select('*').eq('team_id', team.id).single();
            return data;
        },
        enabled: !!team?.id,
    });

    const { data: settings } = useQuery({
        queryKey: ['settings'],
        queryFn: async () => {
            const { data } = await supabase.from('tournament_settings').select('*').single();
            return data;
        }
    });

    const { data: soldPlayerCountFallback = 0 } = useQuery({
        queryKey: ['sold_player_count'],
        queryFn: async () => {
            const { count, error } = await supabase
                .from('players')
                .select('*', { count: 'exact', head: true })
                .eq('is_sold', true);

            if (error) {
                console.error('Failed to fetch sold player count:', error);
                return 0;
            }

            return count || 0;
        }
    });

    const { data: auctionState } = useQuery({
        queryKey: ['auction_state'],
        queryFn: async () => {
            const { data } = await supabase.from('auction_state').select('*, current_player:players(*), current_bidder:teams(*)').single();
            return data;
        }
    });

    const { data: latestAuctionOutcome } = useQuery({
        queryKey: ['captain_latest_outcome'],
        queryFn: async () => {
            const { data } = await supabase
                .from('auction_log')
                .select(`
                    id,
                    status,
                    sale_price,
                    logged_at,
                    player:players(id, name, image_url, category, playing_role),
                    team:teams(team_name, captain_name, captain_image_url)
                `)
                .eq('deleted', false)
                .in('status', ['sold', 'unsold'])
                .order('logged_at', { ascending: false })
                .limit(1)
                .single();
            return data;
        },
    });

    const { data: roster } = useQuery({
        queryKey: ['team_roster', userId],
        queryFn: async () => {
            if (!team?.id) return [];
            const { data } = await supabase.from('players').select('*').eq('sold_to_team_id', team.id).order('sold_price', { ascending: false });
            return data;
        },
        enabled: !!team?.id,
    });

    const maleCount = roster?.filter(p => p.gender === 'Male').length || 0;
    const femaleCount = roster?.filter(p => p.gender === 'Female').length || 0;
    const maxMale = settings?.max_male_players || 7;
    const maxFemale = settings?.max_female_players || 2;
    const totalSpent = roster?.reduce((acc, p) => acc + (p.sold_price || 0), 0) || 0;

    const basePurse = rules?.starting_purse || 30000;
    const captainDeduction = rules?.captain_deduction || 0;
    const effectivePurse = basePurse - captainDeduction;
    const availableTokens = effectivePurse - totalSpent;

    const currentBid = auctionState?.current_bid || 0;
    const increment = auctionState?.bid_increment || 100;
    const nextBid = currentBid + increment;
    const soldPlayerCount = soldPlayerCountFallback;

    const isAuctionLive = settings?.is_auction_live;
    const isPlayerOnBlock = (auctionState?.status === 'bidding' || auctionState?.status === 'waiting_for_first_bid') && auctionState?.current_player;
    const isHighestBidder = auctionState?.current_bidder_team_id === team?.id;
    const playerGender = auctionState?.current_player?.gender;
    const currentPlayerId = auctionState?.current_player?.id || null;

    // Timer hook for countdown display
    const { totalSeconds, isPaused, isRunning } = useTimer();

    // Bids hook for real-time bid display
    const { bids, topBids, historyBids, isLoading: bidsLoading } = useBids(
        auctionState?.current_player?.id || null
    );

    // Max bid calculation for current player
    const [maxBid, setMaxBid] = useState(0);
    const [bidEligibility, setBidEligibility] = useState<{ canBid: boolean; reasons: string[] }>({ canBid: true, reasons: [] });
    const [categoryEligibility, setCategoryEligibility] = useState<{ eligible: boolean; reason?: string }>({ eligible: true });
    const [maxBidNoteDismissedForPlayerId, setMaxBidNoteDismissedForPlayerId] = useState<string | null>(null);
    const [pauseSponsorDismissedForPlayerId, setPauseSponsorDismissedForPlayerId] = useState<string | null>(null);
    const [dismissedSponsorTriggerKey, setDismissedSponsorTriggerKey] = useState<string | null>(null);
    const [sponsorPopoutNow, setSponsorPopoutNow] = useState(() => Date.now());
    const isMaxBidNoteDismissed = !!currentPlayerId && maxBidNoteDismissedForPlayerId === currentPlayerId;
    const isPauseSponsorDismissed = !!currentPlayerId && pauseSponsorDismissedForPlayerId === currentPlayerId;

    useEffect(() => {
        const fetchMaxBid = async () => {
            if (!team?.id || !auctionState?.current_player?.id) {
                setMaxBid(0);
                setBidEligibility({ canBid: true, reasons: [] });
                setCategoryEligibility({ eligible: true });
                return;
            }

            try {
                const eligibility = await getTeamEligibility(team.id, auctionState.current_player.id);
                setMaxBid(eligibility.maxBid);
                setBidEligibility({ canBid: eligibility.canBid, reasons: eligibility.reasons });

                const categoryCheck = await checkCategoryEligibility(
                    team.id,
                    auctionState.current_player.category,
                    auctionState.current_player.gender
                );
                setCategoryEligibility(categoryCheck);
            } catch (error) {
                console.error("Failed to calculate max bid:", error);
                setMaxBid(0);
                setBidEligibility({ canBid: false, reasons: ["Failed to calculate max bid"] });
                setCategoryEligibility({ eligible: true });
            }
        };

        fetchMaxBid();
    }, [team?.id, auctionState?.current_player?.id, auctionState?.current_bid]);

    useEffect(() => {
        const interval = setInterval(() => {
            setSponsorPopoutNow(Date.now());
        }, 500);

        return () => clearInterval(interval);
    }, []);

    const sponsorTriggerStatus: SponsorTriggerStatus | null =
        latestAuctionOutcome?.status === 'sold' || latestAuctionOutcome?.status === 'unsold'
            ? latestAuctionOutcome.status
            : null;
    const sponsorTriggerPlayer = (Array.isArray(latestAuctionOutcome?.player) ? latestAuctionOutcome?.player[0] : latestAuctionOutcome?.player) as AuctionPlayerSnapshot | undefined;
    const sponsorTriggerTeam = Array.isArray(latestAuctionOutcome?.team) ? latestAuctionOutcome?.team[0] : latestAuctionOutcome?.team;
    const sponsorTriggerBidAmount = latestAuctionOutcome?.sale_price || sponsorTriggerPlayer?.sold_price || null;
    const sponsorTriggerKey = sponsorTriggerStatus && latestAuctionOutcome?.id
        ? `${sponsorTriggerStatus}-${latestAuctionOutcome.id}`
        : null;
    const sponsorTriggerTime = latestAuctionOutcome?.logged_at ? new Date(latestAuctionOutcome.logged_at).getTime() : 0;
    const isSponsorInDisplayWindow = sponsorTriggerTime > 0 && (sponsorPopoutNow - sponsorTriggerTime) < 5000;
    const shouldShowSponsorPopout = Boolean(
        settings?.sponsor_image_url &&
        sponsorTriggerStatus &&
        sponsorTriggerPlayer?.id &&
        sponsorTriggerKey &&
        isSponsorInDisplayWindow &&
        dismissedSponsorTriggerKey !== sponsorTriggerKey
    );

    const [showVictory, setShowVictory] = useState(false);

    useEffect(() => {
        if (auctionState?.status === 'sold' && auctionState?.current_bidder_team_id === team?.id) {
            setShowVictory(true);
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#FFD700', '#ffffff', '#3b82f6']
            });

            // Auto hide after 5 seconds
            const timer = setTimeout(() => setShowVictory(false), 5000);
            return () => clearTimeout(timer);
        } else {
            setShowVictory(false);
        }
    }, [auctionState?.status, auctionState?.current_bidder_team_id, team?.id]);

    let bidDisabledReason = '';
    if (!isAuctionLive) bidDisabledReason = 'Auction is paused';
    else if (!isPlayerOnBlock) bidDisabledReason = 'Waiting for player';
    else if (isHighestBidder) bidDisabledReason = 'You are the highest bidder!';
    else if (!categoryEligibility.eligible) bidDisabledReason = categoryEligibility.reason || 'Category limit reached';
    else if (nextBid > maxBid) bidDisabledReason = `Max bid is ₹${maxBid.toLocaleString()}`;
    else if (!bidEligibility.canBid && bidEligibility.reasons.length > 0) bidDisabledReason = bidEligibility.reasons[0];
    else if (availableTokens < nextBid) bidDisabledReason = 'Insufficient tokens';
    else if (playerGender === 'Male' && maleCount >= maxMale) bidDisabledReason = 'Max male players reached';
    else if (playerGender === 'Female' && femaleCount >= maxFemale) bidDisabledReason = 'Max female players reached';

    const bidMutation = useMutation({
        mutationFn: async () => {
            if (bidDisabledReason || !team?.id || !auctionState?.current_player?.id) return;

            const result = await placeBidWithValidation(
                auctionState.current_player.id,
                team.id,
                nextBid
            );

            if (!result.success) {
                throw new Error(result.message);
            }
        }
    });

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push('/');
    };

    const [showBreakdown, setShowBreakdown] = useState(false);

    if (!userId || !team) {
        return (
            <div className="min-h-screen flex items-center justify-center bg-background">
                <Loader2 className="w-8 h-8 animate-spin text-primary" />
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-background mesh-gradient flex flex-col">
            <header className="bg-slate-950/40 border-b border-white/5 sticky top-0 z-50 backdrop-blur-2xl">
                <div className="container mx-auto px-6 h-24 flex items-center justify-between">
                    <div className="flex items-center gap-5">
                        <div className="relative group">
                            <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000 group-hover:duration-200" />
                            <img src={team.team_logo_url} alt={team.team_name} className="w-14 h-14 rounded-full border-2 border-white/10 relative z-10 bg-slate-900 object-contain p-1" />
                        </div>
                        <div>
                            <h1 className="font-display font-black text-2xl md:text-3xl text-white tracking-tighter leading-tight">{team.team_name.toUpperCase()}</h1>
                            <div className="flex items-center gap-2">
                                <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-2 py-0.5 rounded-md font-black tracking-widest uppercase">CAPTAIN</span>
                                <span className="text-slate-500 text-xs font-medium font-sans">{team.captain_name}</span>
                            </div>
                        </div>
                    </div>

                    <div className="flex items-center gap-6">
                        {isAuctionLive && (
                            <div className="flex bg-destructive/10 border border-destructive/20 text-destructive px-5 py-2 rounded-2xl items-center gap-3 shadow-[0_0_20px_rgba(239,68,68,0.15)]">
                                <div className="w-2 h-2 rounded-full bg-destructive animate-ping" />
                                <span className="font-display font-black text-[10px] tracking-[0.2em]">BROADCAST LIVE</span>
                            </div>
                        )}
                        <button
                            onClick={handleLogout}
                            className="p-3 bg-white/5 hover:bg-destructive/10 rounded-2xl transition-all border border-transparent hover:border-destructive/20 text-slate-400 hover:text-destructive group"
                        >
                            <LogOut className="w-5 h-5 group-hover:-translate-x-1 transition-transform" />
                        </button>
                    </div>
                </div>
            </header>

            <main className="container mx-auto px-6 py-10 max-w-7xl flex-1">
                <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 mb-12">
                    {/* Purse Visualization */}
                    <div className="lg:col-span-8 group">
                        <div className="glass-card bg-slate-950/40 border border-white/5 rounded-[3rem] p-10 relative overflow-hidden h-full flex flex-col justify-between">
                            <div className="absolute top-0 right-0 w-[400px] h-[400px] bg-gold/5 blur-[120px] pointer-events-none group-hover:bg-gold/10 transition-colors duration-1000" />

                            <div className="relative z-10">
                                <div className="flex justify-between items-start mb-12">
                                    <div className="space-y-1">
                                        <p className="text-gold flex items-center gap-2 text-[10px] uppercase tracking-[0.4em] font-black opacity-60">
                                            <Flame className="w-4 h-4" /> Operational Fuel
                                        </p>
                                        <h2 className="text-6xl md:text-8xl font-display font-black text-white tracking-tighter glow-gold-lg">
                                            ₹{availableTokens.toLocaleString()}
                                        </h2>
                                    </div>
                                    <button
                                        onClick={() => setShowBreakdown(!showBreakdown)}
                                        className={`p-4 rounded-2xl transition-all ${showBreakdown ? 'bg-gold text-black' : 'bg-white/5 text-gold hover:bg-gold/10 border border-white/5'}`}
                                    >
                                        <PieChart className="w-6 h-6" />
                                    </button>
                                </div>

                                <div className="flex flex-col gap-2">
                                    <div className="w-full h-3 bg-slate-900 rounded-full overflow-hidden border border-white/5">
                                        <motion.div
                                            initial={{ width: 0 }}
                                            animate={{ width: `${(availableTokens / effectivePurse) * 100}%` }}
                                            className="h-full bg-gradient-to-r from-gold to-yellow-600 shadow-[0_0_20px_rgba(255,215,0,0.3)]"
                                        />
                                    </div>
                                    <div className="flex justify-between text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">
                                        <span>Exhausted</span>
                                        <span>Full Capacity</span>
                                    </div>
                                </div>
                            </div>

                            <AnimatePresence>
                                {showBreakdown && (
                                    <motion.div
                                        initial={{ height: 0, opacity: 0 }}
                                        animate={{ height: 'auto', opacity: 1 }}
                                        exit={{ height: 0, opacity: 0 }}
                                        className="relative z-10 mt-10 pt-8 border-t border-white/5 grid grid-cols-1 md:grid-cols-3 gap-6 overflow-hidden"
                                    >
                                        <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl">
                                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Global Allocation</p>
                                            <p className="text-xl font-display font-black text-white tracking-widest">₹{basePurse.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl">
                                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Officer Tax</p>
                                            <p className="text-xl font-display font-black text-destructive tracking-widest">-₹{captainDeduction.toLocaleString()}</p>
                                        </div>
                                        <div className="bg-white/[0.02] border border-white/5 p-5 rounded-2xl">
                                            <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Deployment Cost</p>
                                            <p className="text-xl font-display font-black text-destructive tracking-widest">-₹{totalSpent.toLocaleString()}</p>
                                        </div>
                                    </motion.div>
                                )}
                            </AnimatePresence>
                        </div>
                    </div>

                    {/* Stats */}
                    <div className="lg:col-span-4 flex flex-col gap-6">
                        <div className="glass-card bg-slate-950/40 border border-blue-500/20 rounded-[2.5rem] p-8 flex-1 flex flex-col justify-between relative group overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-blue-500/5 blur-[60px]" />
                            <div className="flex items-center justify-between mb-2 relative z-10">
                                <p className="text-blue-400 text-[10px] uppercase tracking-[0.3em] font-black">Infantry Cells</p>
                                <div className="p-3 bg-blue-500/10 rounded-2xl border border-blue-500/20 text-blue-500">
                                    <Users className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="relative z-10">
                                <p className="font-display font-black text-5xl mb-1 text-white tracking-tighter">
                                    {maleCount} <span className="text-slate-600 text-2xl font-black">/ {maxMale}</span>
                                </p>
                                <div className="flex gap-1">
                                    {[...Array(maxMale)].map((_, i) => (
                                        <div key={i} className={`h-1 flex-1 rounded-full ${i < maleCount ? 'bg-blue-500 shadow-[0_0_10px_rgba(59,130,246,0.5)]' : 'bg-slate-900 group-hover:bg-slate-800 transition-colors'}`} />
                                    ))}
                                </div>
                            </div>
                        </div>

                        <div className="glass-card bg-slate-950/40 border border-pink-500/20 rounded-[2.5rem] p-8 flex-1 flex flex-col justify-between relative group overflow-hidden">
                            <div className="absolute top-0 right-0 w-32 h-32 bg-pink-500/5 blur-[60px]" />
                            <div className="flex items-center justify-between mb-2 relative z-10">
                                <p className="text-pink-400 text-[10px] uppercase tracking-[0.3em] font-black">Spec Ops Matrix</p>
                                <div className="p-3 bg-pink-500/10 rounded-2xl border border-pink-500/20 text-pink-500">
                                    <Users className="w-5 h-5" />
                                </div>
                            </div>
                            <div className="relative z-10">
                                <p className="font-display font-black text-5xl mb-1 text-white tracking-tighter">
                                    {femaleCount} <span className="text-slate-600 text-2xl font-black">/ {maxFemale}</span>
                                </p>
                                <div className="flex gap-1">
                                    {[...Array(maxFemale)].map((_, i) => (
                                        <div key={i} className={`h-1 flex-1 rounded-full ${i < femaleCount ? 'bg-pink-500 shadow-[0_0_10px_rgba(236,72,153,0.5)]' : 'bg-slate-900 group-hover:bg-slate-800 transition-colors'}`} />
                                    ))}
                                </div>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="mb-16">
                    <AnimatePresence mode="wait">
                        {(!isAuctionLive || !isPlayerOnBlock) ? (
                            <motion.div
                                initial={{ opacity: 0, scale: 0.98 }}
                                animate={{ opacity: 1, scale: 1 }}
                                exit={{ opacity: 0, scale: 0.98 }}
                                className="glass-card bg-slate-950/40 border border-white/5 border-dashed rounded-[3rem] p-20 flex flex-col items-center justify-center text-center relative overflow-hidden group"
                            >
                                <div className="absolute inset-0 bg-primary/5 blur-[100px] pointer-events-none" />
                                <div className="p-8 bg-slate-900 rounded-full border border-white/5 mb-8 group-hover:scale-110 transition-transform duration-700">
                                    <Target className="w-16 h-16 text-slate-700 animate-pulse" />
                                </div>
                                <h2 className="text-4xl font-display font-black text-white mb-4 tracking-tighter uppercase tracking-[0.1em]">Target Identification...</h2>
                                <p className="text-slate-500 max-w-lg font-sans font-medium leading-relaxed">
                                    The auction floor is currently silent. Stand by for the next high-value asset to be deployed to the block.
                                    Synchronizing with command center...
                                </p>
                            </motion.div>
                        ) : (
                            <motion.div
                                initial={{ opacity: 0, y: 40 }}
                                animate={{ opacity: 1, y: 0 }}
                                className="glass-card bg-slate-950/80 border border-primary/30 shadow-[0_0_80px_rgba(59,130,246,0.15)] rounded-[3rem] p-10 md:p-12 flex flex-col lg:flex-row gap-12 items-center relative overflow-hidden"
                            >
                                <div className="absolute top-0 left-0 w-full h-1 bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-pulse" />

                                <div className="w-full lg:w-2/5 flex flex-col items-center">
                                    <div className="relative group/p">
                                        <div className="absolute -inset-4 bg-primary/20 rounded-full blur-3xl opacity-0 group-hover/p:opacity-100 transition-opacity duration-1000" />
                                        <div className="relative w-48 h-48 md:w-64 md:h-64 rounded-full border-4 border-white/10 p-2 mb-8 relative z-10 bg-slate-900 overflow-hidden shadow-2xl">
                                            <img src={auctionState.current_player?.image_url!} alt="Player" className="w-full h-full object-cover rounded-full group-hover/p:scale-110 transition-transform duration-1000" />
                                        </div>
                                        <div className="absolute -bottom-2 -right-2 bg-primary text-white font-black px-6 py-2 rounded-2xl text-xs tracking-widest shadow-xl rotate-3 relative z-20 border-2 border-slate-950">
                                            {auctionState.current_player?.category} TIER
                                        </div>
                                    </div>

                                    <h2 className="text-4xl md:text-5xl font-display font-black text-white text-center mb-4 tracking-tighter uppercase">
                                        {auctionState.current_player?.name}
                                    </h2>

                                    <div className="flex flex-wrap justify-center gap-3 mb-8">
                                        <span className="glass bg-white/5 border-white/10 text-slate-300 text-[10px] font-black px-4 py-2 rounded-xl uppercase tracking-widest">{auctionState.current_player?.playing_role}</span>
                                        <span className="glass bg-white/5 border-white/10 text-slate-300 text-[10px] font-black px-4 py-2 rounded-xl uppercase tracking-widest">{auctionState.current_player?.gender.toUpperCase()} UNIT</span>
                                    </div>

                                    <div className="flex items-center gap-3 text-slate-500">
                                        <div className="h-px w-8 bg-white/5" />
                                        <p className="uppercase text-[10px] tracking-[0.4em] font-black">Base Value: ₹{auctionState.current_player?.base_price.toLocaleString()}</p>
                                        <div className="h-px w-8 bg-white/5" />
                                    </div>

                                    {settings?.sponsor_image_url && isPaused && isPlayerOnBlock && !isPauseSponsorDismissed && (
                                        <div className="mt-6 w-full max-w-md bg-slate-950/70 border border-gold/20 rounded-2xl p-4">
                                            <div className="flex items-center justify-between mb-3">
                                                <p className="text-[10px] uppercase tracking-[0.3em] font-black text-gold">Sponsor</p>
                                                <button
                                                    onClick={() => {
                                                        if (currentPlayerId) setPauseSponsorDismissedForPlayerId(currentPlayerId);
                                                    }}
                                                    className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400 hover:text-white transition-colors"
                                                >
                                                    Cancel
                                                </button>
                                            </div>
                                            <div className="rounded-xl overflow-hidden border border-white/10 bg-slate-950/80 p-2">
                                                <img
                                                    src={settings.sponsor_image_url}
                                                    alt="Sponsor"
                                                    className="w-full h-24 object-contain"
                                                />
                                            </div>
                                        </div>
                                    )}
                                </div>

                                <div className="w-full lg:w-3/5 flex flex-col h-full justify-center">
                                    {/* Timer Display */}
                                    {auctionState?.current_player && (
                                        <div className={`mb-6 p-4 rounded-[2rem] text-center relative overflow-hidden ${
                                            isPaused 
                                                ? 'bg-slate-900/60 border-2 border-yellow-500/30' 
                                                : totalSeconds <= 10 
                                                    ? 'bg-destructive/10 border-2 border-destructive/30 animate-pulse' 
                                                    : totalSeconds <= 20 
                                                        ? 'bg-orange-500/10 border-2 border-orange-500/30'
                                                        : 'bg-slate-900/40 border border-white/5'
                                        }`}>
                                            {isPaused && (
                                                <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 z-10">
                                                    <span className="bg-yellow-500 text-black px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest animate-pulse">
                                                        PAUSED
                                                    </span>
                                                </div>
                                            )}
                                            <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black mb-1">
                                                {isPaused ? 'Timer Frozen At' : isRunning ? 'Time Remaining' : 'Timer Stopped'}
                                            </p>
                                            <div className={`font-display font-black tracking-tighter ${
                                                totalSeconds <= 10 ? 'text-destructive text-5xl' : 
                                                totalSeconds <= 20 ? 'text-orange-500 text-5xl' : 
                                                'text-white text-5xl'
                                            }`}>
                                                {formatMinutesSeconds(totalSeconds)}
                                            </div>
                                        </div>
                                    )}

                                    <div className="bg-slate-950/60 border border-white/5 rounded-[2.5rem] p-10 mb-10 text-center relative overflow-hidden group/bid">
                                        <div className="absolute inset-0 bg-gold/5 opacity-0 group-hover/bid:opacity-100 transition-opacity duration-700" />
                                        <p className="text-slate-500 text-[10px] uppercase font-black tracking-[0.4em] mb-4">Current Valuation</p>
                                        <motion.p
                                            key={currentBid}
                                            initial={{ scale: 0.9, opacity: 0 }}
                                            animate={{ scale: 1, opacity: 1 }}
                                            className="text-7xl md:text-8xl font-display font-black text-white tracking-tighter glow-gold-lg mb-4"
                                        >
                                            ₹{currentBid.toLocaleString()}
                                        </motion.p>

                                        <div className="min-h-[40px] flex items-center justify-center">
                                            {auctionState.current_bidder?.team_name ? (
                                                <div className={`flex items-center gap-3 px-6 py-2 rounded-2xl border font-black tracking-widest text-xs uppercase animate-in slide-in-from-bottom-2 ${isHighestBidder ? 'bg-primary/20 border-primary/30 text-primary shadow-[0_0_20px_rgba(59,130,246,0.2)]' : 'bg-gold/10 border-gold/20 text-gold'}`}>
                                                    {isHighestBidder ? <Shield className="w-4 h-4" /> : <Trophy className="w-4 h-4" />}
                                                    {isHighestBidder ? 'SECTOR SECURED BY YOU' : `CLAIMED BY: ${auctionState.current_bidder.team_name.toUpperCase()}`}
                                                </div>
                                            ) : (
                                                <p className="text-slate-600 text-[10px] font-black uppercase tracking-[0.3em]">Sector Open for Entries</p>
                                            )}
                                        </div>
                                    </div>

                                    <button
                                        onClick={() => {
                                            bidMutation.mutate();
                                        }}
                                        disabled={!!bidDisabledReason || bidMutation.isPending}
                                        className={`w-full py-8 md:py-10 rounded-[2rem] font-display font-black tracking-[0.2em] text-3xl md:text-4xl transition-all duration-500 transform active:scale-95 relative overflow-hidden group/btn ${bidDisabledReason
                                            ? 'bg-slate-900 border border-white/5 text-slate-700 cursor-not-allowed'
                                            : 'bg-gold text-black hover:shadow-[0_20px_60px_rgba(255,215,0,0.3)] hover:scale-[1.02] border-t border-white/30'
                                            }`}
                                    >
                                        <div className="relative z-10 flex flex-col items-center">
                                            {bidMutation.isPending ? (
                                                <span className="flex items-center justify-center gap-4"><Loader2 className="w-10 h-10 animate-spin" /> ENGAGING...</span>
                                            ) : bidDisabledReason ? (
                                                <span className="flex items-center justify-center gap-4 text-sm md:text-base tracking-[0.3em] font-black"><AlertCircle className="w-6 h-6" /> {bidDisabledReason.toUpperCase()}</span>
                                            ) : (
                                                <>
                                                    <span className="text-[10px] tracking-[0.5em] mb-1 opacity-60">AUTHORIZE NEXT ENTRY</span>
                                                    <span className="flex items-center gap-4">BID ₹{nextBid.toLocaleString()} <Zap className="w-8 h-8 fill-black" /></span>
                                                </>
                                            )}
                                        </div>
                                        {!bidDisabledReason && <div className="absolute inset-x-0 bottom-0 h-1 bg-black/20 group-hover/btn:h-full transition-all duration-700 pointer-events-none" />}
                                    </button>

                                    {/* Max Bid Display */}
                                    {isPlayerOnBlock && maxBid > 0 && soldPlayerCount > 85 && (
                                        <div className={`mt-4 p-4 rounded-2xl text-center ${nextBid > maxBid ? 'bg-destructive/10 border border-destructive/30' : 'bg-primary/10 border border-primary/30'}`}>
                                            <p className="text-[10px] uppercase tracking-[0.3em] text-slate-400 mb-1">Your Maximum Bid</p>
                                            <p className={`font-display font-black text-2xl ${nextBid > maxBid ? 'text-destructive' : 'text-primary'}`}>
                                                ₹{maxBid.toLocaleString()}
                                            </p>
                                            {nextBid > maxBid && (
                                                <p className="text-destructive text-xs mt-2 font-medium">
                                                    Bid exceeds your maximum
                                                </p>
                                            )}

                                            {!isMaxBidNoteDismissed && (
                                                <div className="mt-3 pt-3 border-t border-white/10">
                                                    <p className="text-xs text-slate-300 italic leading-relaxed">
                                                        {"Don't worry, you can only see this max bid amount, no other captain or other can see this amount."}
                                                    </p>
                                                    <button
                                                        onClick={() => {
                                                            if (currentPlayerId) setMaxBidNoteDismissedForPlayerId(currentPlayerId);
                                                        }}
                                                        className="mt-2 text-[10px] uppercase tracking-[0.2em] font-black text-slate-400 hover:text-white transition-colors"
                                                    >
                                                        Cancel
                                                    </button>
                                                </div>
                                            )}
                                        </div>
                                    )}

                                    {/* Category Limit Warning */}
                                    {isPlayerOnBlock && !categoryEligibility.eligible && (
                                        <div className="mt-4 p-4 rounded-2xl bg-destructive/10 border border-destructive/30 text-center">
                                            <div className="flex items-center justify-center gap-2 mb-2">
                                                <AlertCircle className="w-5 h-5 text-destructive" />
                                                <p className="text-[10px] uppercase tracking-[0.3em] text-destructive font-black">
                                                    Category Limit Reached
                                                </p>
                                            </div>
                                            <p className="text-destructive text-sm font-medium">
                                                {categoryEligibility.reason}
                                            </p>
                                        </div>
                                    )}

                                    {/* Bid History Display */}
                                    {auctionState?.current_player && bids.length > 0 && (
                                        <div className="mt-6">
                                            <BidHistory
                                                bids={bids}
                                                topBids={topBids}
                                                historyBids={historyBids}
                                                currentBidAmount={currentBid}
                                            />
                                        </div>
                                    )}
                                </div>
                            </motion.div>
                        )}
                    </AnimatePresence>
                </div>

                <div>
                    <h3 className="font-display text-3xl font-black text-white mb-8 flex items-center gap-4 tracking-tighter uppercase">
                        <Users className="w-8 h-8 text-primary" />
                        Fleet Combatants
                        <span className="text-slate-600 text-xl font-black ml-auto tracking-widest">[{roster?.length || 0}]</span>
                    </h3>

                    <div className="glass-card bg-slate-950/40 border border-white/5 rounded-[3rem] overflow-hidden">
                        {roster?.length === 0 ? (
                            <div className="p-20 text-center flex flex-col items-center">
                                <div className="w-20 h-20 rounded-full bg-white/[0.02] border border-white/5 flex items-center justify-center mb-6">
                                    <Users className="w-10 h-10 text-slate-800" />
                                </div>
                                <p className="text-slate-500 font-display font-black tracking-[0.2em] uppercase">No Assets Acquired</p>
                            </div>
                        ) : (
                            <div className="divide-y divide-white/5">
                                {roster?.map(player => (
                                    <div key={player.id} className="group p-6 flex items-center justify-between hover:bg-white/[0.02] transition-all duration-500">
                                        <div className="flex items-center gap-6">
                                            <div className="relative">
                                                <div className="absolute -inset-1 bg-primary/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity" />
                                                <img src={player.image_url!} alt={player.name} className="w-16 h-16 rounded-2xl bg-slate-900 border border-white/10 relative z-10 p-0.5 object-cover" />
                                            </div>
                                            <div>
                                                <p className="font-display font-black text-white text-xl tracking-widest group-hover:text-primary transition-colors uppercase">{player.name}</p>
                                                <div className="flex items-center gap-3 mt-1">
                                                    <span className={`text-[10px] font-black tracking-widest uppercase ${player.gender === 'Male' ? 'text-blue-400' : 'text-pink-400'}`}>{player.gender} UNIT</span>
                                                    <div className="w-1 h-1 rounded-full bg-slate-700" />
                                                    <span className="text-[10px] text-slate-500 font-black tracking-widest uppercase">{player.playing_role}</span>
                                                    <div className="w-1 h-1 rounded-full bg-slate-700" />
                                                    <span className="text-[10px] text-gold font-black tracking-widest uppercase">{player.category} TIER</span>
                                                </div>
                                            </div>
                                        </div>
                                        <div className="text-right group-hover:scale-110 transition-transform duration-500">
                                            <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-1">Acquisition Cost</p>
                                            <p className="font-display font-black text-3xl text-white tracking-tighter">₹{player.sold_price?.toLocaleString()}</p>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

            </main>

            <AnimatePresence>
                {shouldShowSponsorPopout && sponsorTriggerStatus && sponsorTriggerPlayer && settings?.sponsor_image_url && (
                    <motion.div
                        initial={{ opacity: 0, y: 20, scale: 0.98 }}
                        animate={{ opacity: 1, y: 0, scale: 1 }}
                        exit={{ opacity: 0, y: 20, scale: 0.98 }}
                        className="fixed bottom-6 right-6 z-[95] w-[360px] bg-slate-950/95 border border-gold/30 rounded-3xl p-5 shadow-[0_20px_70px_rgba(0,0,0,0.65)]"
                    >
                        <div className="flex items-center justify-between mb-4">
                            <p className="text-[10px] uppercase tracking-[0.3em] font-black text-gold">
                                {sponsorTriggerStatus === 'sold' ? 'Sold Trigger' : 'Unsold Trigger'}
                            </p>
                            <button
                                onClick={() => setDismissedSponsorTriggerKey(sponsorTriggerKey)}
                                className="text-[10px] uppercase tracking-[0.2em] font-black text-slate-400 hover:text-white transition-colors"
                            >
                                Cancel
                            </button>
                        </div>

                        <div className="rounded-2xl overflow-hidden border border-white/10 bg-slate-900/70 p-2 mb-4">
                            <img
                                src={settings.sponsor_image_url}
                                alt="Sponsor"
                                className="w-full h-24 object-contain"
                            />
                        </div>

                        <div className="flex items-center gap-3">
                            <img
                                src={sponsorTriggerPlayer.image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${sponsorTriggerPlayer.name || 'player'}`}
                                alt={sponsorTriggerPlayer.name || 'Player'}
                                className="w-14 h-14 rounded-2xl object-cover border border-white/10 bg-slate-900"
                            />
                            <div className="min-w-0">
                                <p className="text-white font-display font-black tracking-wide uppercase truncate">
                                    {sponsorTriggerPlayer.name}
                                </p>
                                <p className="text-[10px] text-slate-400 font-black uppercase tracking-[0.2em]">
                                    {sponsorTriggerPlayer.category} Tier • {sponsorTriggerPlayer.playing_role}
                                </p>
                                {sponsorTriggerStatus === 'sold' && sponsorTriggerBidAmount && (
                                    <p className="text-sm text-gold font-display font-black mt-1">
                                        ₹{sponsorTriggerBidAmount.toLocaleString()}
                                    </p>
                                )}
                                {sponsorTriggerStatus === 'sold' && sponsorTriggerTeam?.team_name && (
                                    <div className="mt-1 flex items-center gap-2">
                                        <p className="text-[11px] text-slate-300">
                                            {sponsorTriggerTeam.team_name}
                                            {sponsorTriggerTeam.captain_name ? ` • ${sponsorTriggerTeam.captain_name}` : ''}
                                        </p>
                                        {sponsorTriggerTeam.captain_image_url ? (
                                            <img
                                                src={sponsorTriggerTeam.captain_image_url}
                                                alt={sponsorTriggerTeam.captain_name || 'Captain'}
                                                className="w-5 h-5 rounded-full border border-white/10 object-cover"
                                            />
                                        ) : null}
                                    </div>
                                )}
                            </div>
                        </div>
                    </motion.div>
                )}

                {showVictory && (
                    <motion.div
                        initial={{ opacity: 0 }}
                        animate={{ opacity: 1 }}
                        exit={{ opacity: 0 }}
                        className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-3xl overflow-hidden"
                    >
                        <div className="absolute inset-0 pointer-events-none">
                            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-[1000px] h-[1000px] bg-gold/20 rounded-full blur-[150px] animate-pulse" />
                        </div>

                        <motion.div
                            initial={{ scale: 0.5, rotate: -10 }}
                            animate={{ scale: 1, rotate: 0 }}
                            className="relative z-10 text-center"
                        >
                            <motion.div
                                animate={{ y: [0, -20, 0] }}
                                transition={{ repeat: Infinity, duration: 4 }}
                                className="mb-8 p-10 bg-gold rounded-[3rem] shadow-[0_0_100px_rgba(255,215,0,0.5)] border-4 border-white/20 inline-block"
                            >
                                <Trophy className="w-24 h-24 text-black" />
                            </motion.div>

                            <h2 className="text-8xl md:text-9xl font-display font-black text-white tracking-tighter uppercase mb-4 glow-gold-lg">
                                SECURED
                            </h2>
                            <p className="text-gold font-display font-black text-2xl tracking-[0.5em] uppercase mb-12">Mission Accomplished</p>

                            <div className="glass-card bg-white/5 border border-white/10 px-12 py-6 rounded-[2rem] inline-flex items-center gap-6">
                                <div className="text-left border-r border-white/10 pr-6">
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Asset Grade</p>
                                    <p className="text-2xl font-display font-black text-white">{auctionState?.current_player?.category} TIER</p>
                                </div>
                                <div className="text-left">
                                    <p className="text-[10px] text-slate-500 font-black uppercase tracking-widest mb-1">Acquisition Cost</p>
                                    <p className="text-2xl font-display font-black text-white">₹{auctionState?.current_bid?.toLocaleString()}</p>
                                </div>
                            </div>
                        </motion.div>

                        <button
                            onClick={() => setShowVictory(false)}
                            className="absolute bottom-12 text-slate-500 hover:text-white font-black text-[10px] tracking-[0.4em] uppercase transition-colors"
                        >
                            CLICK TO DISMISS
                        </button>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}
