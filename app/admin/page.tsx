"use client";

import { useEffect, useState, useRef } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { useRealtimeSubscription } from '@/hooks/useRealtime';
import { useTimer } from '@/hooks/useTimer';
import { formatMinutesSeconds, formatHoursMinutesSeconds } from '@/lib/services/timer/timerService';
import { startTimer, pauseTimer, resumeTimer, updateTimerSettings } from '@/lib/actions/timer';
import { assignCaptain, removeCaptain } from '@/lib/actions/captains';
import { deployPlayer, markPlayerUnsold, finalizeSale, reAuctionPlayer } from '@/lib/actions/auction';
import { isPlayerEligibleForAuction } from "@/lib/validation/teamComposition";
import { manualPurseDeduction, updateBasePrices } from '@/lib/actions/rules';
import { banTeamFromBidding, unbanTeam, getBannedTeams } from '@/lib/actions/admin';
import { createLogEntry } from '@/lib/actions/logging';
import { AuctionLogs } from '@/components/admin/AuctionLogs';
import { ManualSaleModal } from '@/components/admin/ManualSaleModal';
import {
    Loader2, LogOut, LayoutDashboard, Users, Gavel,
    Settings, ListPlus, PlayCircle, PauseCircle,
    CheckCircle, XCircle, Activity, Shield,
    Trophy, Search, Filter, ChevronRight,
    Download, Upload, Plus, Trash2, Edit, X, Info,
    ArrowUpRight, FileText, FilePlus, Zap
} from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import confetti from 'canvas-confetti';
import Papa from 'papaparse';
import { PlayerCard } from '@/components/admin/PlayerCard';
import { BidHistory } from '@/components/admin/BidHistory';
import { useBids } from '@/hooks/useBids';

export default function AdminDashboard() {
    const router = useRouter();
    const queryClient = useQueryClient();
    const [activeTab, setActiveTab] = useState("dashboard");
    const [userId, setUserId] = useState<string | null>(null);
    const [isCoreAdmin, setIsCoreAdmin] = useState(false);

    // Modal states
    const [showAddCaptain, setShowAddCaptain] = useState(false);
    const [showEditCaptain, setShowEditCaptain] = useState(false);
    const [showAddPlayer, setShowAddPlayer] = useState(false);
    const [showManualSale, setShowManualSale] = useState(false);
    const [showEditPlayer, setShowEditPlayer] = useState(false);
    const [selectedCaptain, setSelectedCaptain] = useState<any>(null);
    const [selectedPlayer, setSelectedPlayer] = useState<any>(null);
    const [deleteConfirm, setDeleteConfirm] = useState<{type: 'captain' | 'player', id: string, name: string} | null>(null);

    useEffect(() => {
        supabase.auth.getSession().then(async ({ data: { session } }) => {
            if (!session) router.push("/login?role=admin");
            else {
                setUserId(session.user.id);
                const { data } = await supabase.from("user_roles").select("role").eq("user_id", session.user.id);
                setIsCoreAdmin(data?.some(r => r.role === "core_admin") || false);
            }
        });

        const { data: { subscription } } = supabase.auth.onAuthStateChange((_event, session) => {
            if (!session) router.push("/login?role=admin");
            else setUserId(session.user.id);
        });

        return () => subscription.unsubscribe();
    }, [router]);

    useRealtimeSubscription('tournament_settings', ['settings']);
    useRealtimeSubscription('auction_state', ['auction_state']);
    useRealtimeSubscription('teams', ['teams']);
    useRealtimeSubscription('players', ['players']);
    useRealtimeSubscription('auction_rules', ['rules']);
    useRealtimeSubscription('bids', ['recent_bids']);

    const { data: settings } = useQuery({
        queryKey: ["settings"],
        queryFn: async () => (await supabase.from("tournament_settings").select("*").single()).data
    });
    const { data: teams } = useQuery({
        queryKey: ["teams"],
        queryFn: async () => (await supabase.from("teams").select("*")).data
    });
    const { data: players } = useQuery({
        queryKey: ["players"],
        queryFn: async () => (await supabase.from("players").select("*, team:teams(*)").order('name')).data
    });
    const { data: rules } = useQuery({
        queryKey: ["rules"],
        queryFn: async () => (await supabase.from("auction_rules").select("*, team:teams(*)")).data
    });
    const { data: auctionState } = useQuery({
        queryKey: ["auction_state"],
        queryFn: async () => (await supabase.from("auction_state").select("*, current_player:players(*), current_bidder:teams(*)").single()).data
    });

    const handleLogout = async () => {
        await supabase.auth.signOut();
        router.push("/");
    };

    const handleDeleteConfirm = async () => {
        if (!deleteConfirm) return;

        try {
            if (deleteConfirm.type === 'captain') {
                // Delete auction rules first (foreign key)
                await supabase.from('auction_rules').delete().eq('team_id', deleteConfirm.id);
                // Delete team
                await supabase.from('teams').delete().eq('id', deleteConfirm.id);
                // Note: Auth user is not deleted (security consideration)
            } else if (deleteConfirm.type === 'player') {
                await supabase.from('players').delete().eq('id', deleteConfirm.id);
            }
            queryClient.invalidateQueries({ queryKey: ['teams'] });
            queryClient.invalidateQueries({ queryKey: ['players'] });
            setDeleteConfirm(null);
        } catch (err: any) {
            alert('Delete failed: ' + err.message);
        }
    };

    const tabs = [
        { id: "dashboard", label: "Overview", icon: LayoutDashboard },
        { id: "players", label: "Players", icon: Users },
        { id: "captain", label: "Captain Selection", icon: Trophy },
        { id: "rules", label: "Auction Rules", icon: Settings },
        { id: "auction-inputs", label: "Auction Inputs", icon: Upload },
        { id: "live", label: "Live Controller", icon: Gavel, requiresCore: true },
        { id: "logs", label: "Log Entries", icon: FileText }
    ];

    // Modal props for child components
    const modalProps = {
        setShowAddCaptain,
        setShowEditCaptain,
        setShowAddPlayer,
        setShowEditPlayer,
        setSelectedCaptain,
        setSelectedPlayer,
        setDeleteConfirm,
        setShowManualSale
    };

    if (!userId) return <div className="min-h-screen flex items-center justify-center"><Loader2 className="w-8 h-8 animate-spin text-primary" /></div>;

    return (
        <div className="min-h-screen bg-background mesh-gradient flex flex-col md:flex-row">
            {/* Sidebar */}
            <aside className="w-full md:w-80 bg-slate-950/40 border-r border-white/5 flex flex-col backdrop-blur-2xl relative z-20">
                <div className="p-8 border-b border-white/5">
                    <div className="flex items-center gap-3 mb-2">
                        <div className="w-10 h-10 bg-gold/10 rounded-xl flex items-center justify-center border border-gold/20 glow-gold">
                            <Shield className="w-6 h-6 text-gold" />
                        </div>
                        <h2 className="font-display font-black text-2xl tracking-tighter text-gradient-gold">SPL CONSOLE</h2>
                    </div>
                    {isCoreAdmin ? (
                        <div className="flex items-center gap-2 mt-4 bg-destructive/10 border border-destructive/20 rounded-lg px-3 py-1.5 w-fit">
                            <Activity className="w-3 h-3 text-destructive animate-pulse" />
                            <span className="text-destructive text-[10px] uppercase tracking-[0.2em] font-black">CORE ADMIN</span>
                        </div>
                    ) : (
                        <div className="flex items-center gap-2 mt-4 bg-primary/10 border border-primary/20 rounded-lg px-3 py-1.5 w-fit">
                            <Shield className="w-3 h-3 text-primary" />
                            <span className="text-primary text-[10px] uppercase tracking-[0.2em] font-black">REGULAR ADMIN</span>
                        </div>
                    )}
                </div>

                <nav className="flex-1 p-6 space-y-2 overflow-y-auto scrollbar-hide">
                    <p className="text-[10px] font-black text-slate-500 tracking-[0.3em] uppercase mb-4 px-2">Navigation</p>
                    {tabs.map(tab => {
                        const Icon = tab.icon;
                        const isActive = activeTab === tab.id;
                        return (!tab.requiresCore || isCoreAdmin) && (
                            <button
                                key={tab.id}
                                onClick={() => setActiveTab(tab.id)}
                                className={`group w-full flex items-center justify-between gap-3 px-5 py-4 rounded-2xl transition-all duration-300 relative overflow-hidden ${isActive
                                    ? "glass bg-primary/10 border-primary/30 text-white shadow-[0_0_20px_rgba(59,130,246,0.15)]"
                                    : "text-slate-400 hover:text-white hover:bg-white/5"
                                    }`}
                            >
                                <div className="flex items-center gap-4 relative z-10 transition-transform group-active:scale-95">
                                    <Icon className={`w-5 h-5 transition-colors ${isActive ? "text-primary group-hover:rotate-12" : "text-slate-500 group-hover:text-primary"}`} />
                                    <span className="font-display font-bold tracking-wider text-sm">{tab.label.toUpperCase()}</span>
                                </div>
                                {isActive && <motion.div layoutId="activeTab" className="absolute inset-0 bg-primary/10 z-0" />}
                                <ChevronRight className={`w-4 h-4 transition-all duration-300 ${isActive ? "opacity-100 translate-x-0" : "opacity-0 -translate-x-2"}`} />
                            </button>
                        );
                    })}
                </nav>

                <div className="p-6 border-t border-white/5 bg-slate-950/20">
                    <button
                        onClick={handleLogout}
                        className="group w-full flex items-center gap-4 px-5 py-4 rounded-2xl text-slate-400 hover:text-white hover:bg-destructive/10 transition-all border border-transparent hover:border-destructive/20"
                    >
                        <LogOut className="w-5 h-5 text-slate-500 group-hover:text-destructive group-hover:-translate-x-1 transition-all" />
                        <span className="font-display font-bold tracking-wider text-sm">EXIT CONSOLE</span>
                    </button>
                </div>
            </aside>

            {/* Main Content */}
            <main className="flex-1 p-6 md:p-8 overflow-y-auto">
                {activeTab === "dashboard" && <OverviewTab teams={teams} players={players} settings={settings} {...modalProps} />}
                {activeTab === "players" && <PlayersTab players={players} {...modalProps} />}
                {activeTab === "captain" && <CaptainSelectionTab teams={teams} players={players} />}
                {activeTab === "rules" && <RulesTab rules={rules} settings={settings} />}
                {activeTab === "auction-inputs" && <AuctionInputsTab settings={settings} />}
                {activeTab === "live" && <LiveControllerTab auctionState={auctionState} settings={settings} players={players} teams={teams} />}
                {activeTab === "logs" && <AuctionLogs />}
            </main>

            {/* Modals */}
            <AddCaptainModal
                show={showAddCaptain}
                onClose={() => setShowAddCaptain(false)}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['teams'] });
                }}
            />

            <AddPlayerModal
                show={showAddPlayer}
                onClose={() => setShowAddPlayer(false)}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['players'] });
                }}
            />

            <EditCaptainModal
                show={showEditCaptain}
                onClose={() => setShowEditCaptain(false)}
                captain={selectedCaptain}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['teams'] });
                    setSelectedCaptain(null);
                }}
            />

            <EditPlayerModal
                show={showEditPlayer}
                onClose={() => setShowEditPlayer(false)}
                player={selectedPlayer}
                onSuccess={() => {
                    queryClient.invalidateQueries({ queryKey: ['players'] });
                    setSelectedPlayer(null);
                }}
            />

            <ManualSaleModal
                show={showManualSale}
                onClose={() => setShowManualSale(false)}
            />

            <ConfirmDeleteModal
                show={!!deleteConfirm}
                onClose={() => setDeleteConfirm(null)}
                onConfirm={handleDeleteConfirm}
                type={deleteConfirm?.type}
                name={deleteConfirm?.name}
            />
        </div>
    );
}

// --- MODALS ---

function AddCaptainModal({ show, onClose, onSuccess }: any) {
    const [formData, setFormData] = useState({
        team_name: '',
        captain_name: '',
        email: '',
        password: '',
        phone_number: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            // Create auth user
            const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                email: formData.email,
                password: formData.password,
                email_confirm: true
            });

            if (authError) throw authError;

            // Assign captain role
            await supabase.from('user_roles').insert({
                user_id: authData.user!.id,
                role: 'captain'
            });

            // Create team
            const { data: teamData, error: teamError } = await supabase.from('teams').insert({
                team_name: formData.team_name,
                captain_name: formData.captain_name,
                captain_user_id: authData.user!.id,
                captain_email: formData.email,
                captain_password: formData.password,
                phone_number: formData.phone_number,
                team_logo_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(formData.team_name)}`,
                captain_image_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(formData.captain_name)}`
            }).select().single();

            if (teamError) throw teamError;

            // Create auction rules
            await supabase.from('auction_rules').insert({
                team_id: teamData.id,
                captain_deduction: 0,
                starting_purse: 30000
            });

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to create captain');
        } finally {
            setLoading(false);
        }
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-3xl">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card bg-slate-900 border border-white/10 rounded-[2.5rem] p-10 max-w-md w-full mx-4 shadow-2xl"
            >
                <div className="flex justify-between items-center mb-8">
                    <h3 className="font-display text-2xl font-black text-white tracking-tight">ADD NEW CAPTAIN</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">Team Name</label>
                        <input
                            type="text"
                            value={formData.team_name}
                            onChange={e => setFormData({ ...formData, team_name: e.target.value })}
                            required
                            className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-gold/50 transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">Captain Name</label>
                        <input
                            type="text"
                            value={formData.captain_name}
                            onChange={e => setFormData({ ...formData, captain_name: e.target.value })}
                            required
                            className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-gold/50 transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">Email</label>
                            <input
                                type="email"
                                value={formData.email}
                                onChange={e => setFormData({ ...formData, email: e.target.value })}
                                required
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-gold/50 transition-all"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">Password</label>
                            <input
                                type="text"
                                value={formData.password}
                                onChange={e => setFormData({ ...formData, password: e.target.value })}
                                required
                                minLength={6}
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-gold/50 transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">Phone Number</label>
                        <input
                            type="tel"
                            value={formData.phone_number}
                            onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                            className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-gold/50 transition-all"
                        />
                    </div>

                    {error && (
                        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-xl">{error}</div>
                    )}

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 py-4 rounded-2xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all font-black tracking-widest"
                        >
                            CANCEL
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-4 rounded-2xl bg-gold text-black hover:bg-gold/90 transition-all font-black tracking-widest shadow-[0_10px_30px_rgba(255,215,0,0.2)] disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin inline" /> : 'CREATE CAPTAIN'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}

function EditCaptainModal({ show, onClose, captain, onSuccess }: any) {
    const [formData, setFormData] = useState({
        team_name: captain?.team_name || '',
        captain_name: captain?.captain_name || '',
        phone_number: captain?.phone_number || '',
        captain_email: captain?.captain_email || '',
        captain_password: captain?.captain_password || ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const { error: teamError } = await supabase.from('teams').update({
                team_name: formData.team_name,
                captain_name: formData.captain_name,
                phone_number: formData.phone_number
            }).eq('id', captain.id);

            if (teamError) throw teamError;

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to update captain');
        } finally {
            setLoading(false);
        }
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-3xl">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card bg-slate-900 border border-white/10 rounded-[2.5rem] p-10 max-w-md w-full mx-4 shadow-2xl"
            >
                <div className="flex justify-between items-center mb-8">
                    <h3 className="font-display text-2xl font-black text-white tracking-tight">EDIT CAPTAIN</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">Team Name</label>
                        <input
                            type="text"
                            value={formData.team_name}
                            onChange={e => setFormData({ ...formData, team_name: e.target.value })}
                            required
                            className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-gold/50 transition-all"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">Captain Name</label>
                        <input
                            type="text"
                            value={formData.captain_name}
                            onChange={e => setFormData({ ...formData, captain_name: e.target.value })}
                            required
                            className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-gold/50 transition-all"
                        />
                    </div>

                    <div className="grid grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">Email</label>
                            <input
                                type="email"
                                value={formData.captain_email}
                                disabled
                                className="w-full bg-slate-800/50 border border-white/5 rounded-2xl px-6 py-4 text-slate-500 outline-none cursor-not-allowed"
                            />
                        </div>
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">Password</label>
                            <input
                                type="text"
                                value={formData.captain_password}
                                onChange={e => setFormData({ ...formData, captain_password: e.target.value })}
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-gold/50 transition-all"
                            />
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">Phone Number</label>
                        <input
                            type="tel"
                            value={formData.phone_number}
                            onChange={e => setFormData({ ...formData, phone_number: e.target.value })}
                            className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-gold/50 transition-all"
                        />
                    </div>

                    {error && (
                        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-xl">{error}</div>
                    )}

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 py-4 rounded-2xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all font-black tracking-widest"
                        >
                            CANCEL
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-4 rounded-2xl bg-gold text-black hover:bg-gold/90 transition-all font-black tracking-widest shadow-[0_10px_30px_rgba(255,215,0,0.2)] disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin inline" /> : 'UPDATE CAPTAIN'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}

function AddPlayerModal({ show, onClose, onSuccess }: any) {
    const [formData, setFormData] = useState({
        name: '',
        category: 'B',
        age: 25,
        height: '',
        handy: 'Right-hand',
        type: 'Top-order',
        earlier_seasons: '',
        achievements: '',
        special_remarks: '',
        playing_role: 'Batsman',
        gender: 'Male',
        base_price: 1000,
        phone_number: '',
        image_url: ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');
    const fileInputRef = useRef<HTMLInputElement>(null);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const { data, error } = await supabase.from('players').insert({
                name: formData.name,
                category: formData.category,
                age: formData.age,
                height: formData.height,
                handy: formData.handy,
                type: formData.type,
                earlier_seasons: formData.earlier_seasons,
                achievements: formData.achievements,
                special_remarks: formData.special_remarks,
                playing_role: formData.playing_role,
                gender: formData.gender,
                base_price: formData.base_price,
                phone_number: formData.phone_number || null,
                image_url: formData.image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(formData.name)}`
            });

            if (error) throw error;

            onSuccess();
            onClose();
            setFormData({
                name: '', category: 'B', age: 25, height: '', handy: 'Right-hand', type: 'Top-order',
                earlier_seasons: '', achievements: '', special_remarks: '',
                playing_role: 'Batsman', gender: 'Male', base_price: 1000, phone_number: '', image_url: ''
            });
        } catch (err: any) {
            setError(err.message || 'Failed to create player');
        } finally {
            setLoading(false);
        }
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-3xl overflow-y-auto py-8">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card bg-slate-900 border border-white/10 rounded-[2rem] p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto shadow-2xl"
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-display text-2xl font-black text-white tracking-tight">ADD NEW PLAYER</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Name *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                required
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Category *</label>
                            <select
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                            >
                                <option value="A+">A+ (Platinum)</option>
                                <option value="A">A (Gold)</option>
                                <option value="B">B (Silver)</option>
                                <option value="C">C (Standard)</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Age</label>
                            <input
                                type="number"
                                value={formData.age}
                                onChange={e => setFormData({ ...formData, age: parseInt(e.target.value) || 0 })}
                                min={15}
                                max={50}
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Height</label>
                            <input
                                type="text"
                                value={formData.height}
                                onChange={e => setFormData({ ...formData, height: e.target.value })}
                                placeholder="e.g., 5&apos;8&quot; or 175cm"
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Handy</label>
                            <select
                                value={formData.handy}
                                onChange={e => setFormData({ ...formData, handy: e.target.value })}
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                            >
                                <option value="Right-hand">Right-hand Bat</option>
                                <option value="Left-hand">Left-hand Bat</option>
                                <option value="Right-arm">Right-arm Bowl</option>
                                <option value="Left-arm">Left-arm Bowl</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Type</label>
                            <select
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                            >
                                <option value="Top-order">Top-order</option>
                                <option value="Middle-order">Middle-order</option>
                                <option value="Opener">Opener</option>
                                <option value="Finisher">Finisher</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Earlier Seasons</label>
                            <input
                                type="text"
                                value={formData.earlier_seasons}
                                onChange={e => setFormData({ ...formData, earlier_seasons: e.target.value })}
                                placeholder="e.g., 2022, 2023"
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Achievements</label>
                            <input
                                type="text"
                                value={formData.achievements}
                                onChange={e => setFormData({ ...formData, achievements: e.target.value })}
                                placeholder="Notable achievements or awards"
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Combat Role *</label>
                            <select
                                value={formData.playing_role}
                                onChange={e => setFormData({ ...formData, playing_role: e.target.value })}
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                            >
                                <option value="Batsman">Batsman</option>
                                <option value="Bowler">Bowler</option>
                                <option value="All-rounder">All-rounder</option>
                                <option value="Wicket-keeper">Wicket-keeper</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Variant *</label>
                            <select
                                value={formData.gender}
                                onChange={e => setFormData({ ...formData, gender: e.target.value })}
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                            >
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Phone Number (Private)</label>
                        <input
                            type="text"
                            value={formData.phone_number}
                            onChange={e => setFormData({ ...formData, phone_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                            placeholder="10 digit number"
                            inputMode="numeric"
                            maxLength={10}
                            pattern="[0-9]{10}"
                            className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                        />
                        <p className="text-[10px] text-slate-500">Stored for exports/backend use; never shown on live dashboards.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Special Remarks</label>
                        <textarea
                            value={formData.special_remarks}
                            onChange={e => setFormData({ ...formData, special_remarks: e.target.value })}
                            placeholder="Additional notes or special remarks"
                            rows={2}
                            className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all resize-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Market Base (₹) *</label>
                        <input
                            type="number"
                            value={formData.base_price}
                            onChange={e => setFormData({ ...formData, base_price: parseInt(e.target.value) || 0 })}
                            required
                            min={100}
                            step={100}
                            className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                        />
                    </div>

                    {error && (
                        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-xl">{error}</div>
                    )}

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 py-4 rounded-2xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all font-black tracking-widest"
                        >
                            CANCEL
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-4 rounded-2xl bg-gold text-black hover:bg-gold/90 transition-all font-black tracking-widest shadow-[0_10px_30px_rgba(255,215,0,0.2)] disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin inline" /> : 'CREATE PLAYER'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}

function EditPlayerModal({ show, onClose, player, onSuccess }: any) {
    const [formData, setFormData] = useState({
        name: player?.name || '',
        category: player?.category || 'B',
        age: player?.age || 25,
        height: player?.height || '',
        handy: player?.handy || 'Right-hand',
        type: player?.type || 'Top-order',
        earlier_seasons: player?.earlier_seasons || '',
        achievements: player?.achievements || '',
        special_remarks: player?.special_remarks || '',
        playing_role: player?.playing_role || 'Batsman',
        gender: player?.gender || 'Male',
        base_price: player?.base_price || 1000,
        phone_number: player?.phone_number || '',
        image_url: player?.image_url || ''
    });
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        setError('');

        try {
            const { error } = await supabase.from('players').update({
                name: formData.name,
                category: formData.category,
                age: formData.age,
                height: formData.height,
                handy: formData.handy,
                type: formData.type,
                earlier_seasons: formData.earlier_seasons,
                achievements: formData.achievements,
                special_remarks: formData.special_remarks,
                playing_role: formData.playing_role,
                gender: formData.gender,
                base_price: formData.base_price,
                phone_number: formData.phone_number || null,
                image_url: formData.image_url
            }).eq('id', player.id);

            if (error) throw error;

            onSuccess();
            onClose();
        } catch (err: any) {
            setError(err.message || 'Failed to update player');
        } finally {
            setLoading(false);
        }
    };

    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-3xl overflow-y-auto py-8">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card bg-slate-900 border border-white/10 rounded-[2rem] p-8 max-w-2xl w-full mx-4 max-h-[90vh] overflow-y-auto shadow-2xl"
            >
                <div className="flex justify-between items-center mb-6">
                    <h3 className="font-display text-2xl font-black text-white tracking-tight">EDIT PLAYER</h3>
                    <button onClick={onClose} className="text-slate-400 hover:text-white"><X className="w-6 h-6" /></button>
                </div>

                <form onSubmit={handleSubmit} className="space-y-5">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Name *</label>
                            <input
                                type="text"
                                value={formData.name}
                                onChange={e => setFormData({ ...formData, name: e.target.value })}
                                required
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Category *</label>
                            <select
                                value={formData.category}
                                onChange={e => setFormData({ ...formData, category: e.target.value })}
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                            >
                                <option value="A+">A+ (Platinum)</option>
                                <option value="A">A (Gold)</option>
                                <option value="B">B (Silver)</option>
                                <option value="C">C (Standard)</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Age</label>
                            <input
                                type="number"
                                value={formData.age}
                                onChange={e => setFormData({ ...formData, age: parseInt(e.target.value) || 0 })}
                                min={15}
                                max={50}
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Height</label>
                            <input
                                type="text"
                                value={formData.height}
                                onChange={e => setFormData({ ...formData, height: e.target.value })}
                                placeholder="e.g., 5&apos;8&quot; or 175cm"
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Handy</label>
                            <select
                                value={formData.handy}
                                onChange={e => setFormData({ ...formData, handy: e.target.value })}
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                            >
                                <option value="Right-hand">Right-hand Bat</option>
                                <option value="Left-hand">Left-hand Bat</option>
                                <option value="Right-arm">Right-arm Bowl</option>
                                <option value="Left-arm">Left-arm Bowl</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Type</label>
                            <select
                                value={formData.type}
                                onChange={e => setFormData({ ...formData, type: e.target.value })}
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                            >
                                <option value="Top-order">Top-order</option>
                                <option value="Middle-order">Middle-order</option>
                                <option value="Opener">Opener</option>
                                <option value="Finisher">Finisher</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Earlier Seasons</label>
                            <input
                                type="text"
                                value={formData.earlier_seasons}
                                onChange={e => setFormData({ ...formData, earlier_seasons: e.target.value })}
                                placeholder="e.g., 2022, 2023"
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                            />
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Achievements</label>
                            <input
                                type="text"
                                value={formData.achievements}
                                onChange={e => setFormData({ ...formData, achievements: e.target.value })}
                                placeholder="Notable achievements or awards"
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Combat Role *</label>
                            <select
                                value={formData.playing_role}
                                onChange={e => setFormData({ ...formData, playing_role: e.target.value })}
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                            >
                                <option value="Batsman">Batsman</option>
                                <option value="Bowler">Bowler</option>
                                <option value="All-rounder">All-rounder</option>
                                <option value="Wicket-keeper">Wicket-keeper</option>
                            </select>
                        </div>

                        <div className="space-y-2">
                            <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Variant *</label>
                            <select
                                value={formData.gender}
                                onChange={e => setFormData({ ...formData, gender: e.target.value })}
                                className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                            >
                                <option value="Male">Male</option>
                                <option value="Female">Female</option>
                            </select>
                        </div>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Phone Number (Private)</label>
                        <input
                            type="text"
                            value={formData.phone_number}
                            onChange={e => setFormData({ ...formData, phone_number: e.target.value.replace(/\D/g, '').slice(0, 10) })}
                            placeholder="10 digit number"
                            inputMode="numeric"
                            maxLength={10}
                            pattern="[0-9]{10}"
                            className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                        />
                        <p className="text-[10px] text-slate-500">Stored for exports/backend use; never shown on live dashboards.</p>
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Special Remarks</label>
                        <textarea
                            value={formData.special_remarks}
                            onChange={e => setFormData({ ...formData, special_remarks: e.target.value })}
                            placeholder="Additional notes or special remarks"
                            rows={2}
                            className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all resize-none"
                        />
                    </div>

                    <div className="space-y-2">
                        <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Market Base (₹) *</label>
                        <input
                            type="number"
                            value={formData.base_price}
                            onChange={e => setFormData({ ...formData, base_price: parseInt(e.target.value) || 0 })}
                            required
                            min={100}
                            step={100}
                            className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-gold/50 transition-all"
                        />
                    </div>

                    {error && (
                        <div className="bg-destructive/10 border border-destructive/20 text-destructive text-sm p-4 rounded-xl">{error}</div>
                    )}

                    <div className="flex gap-4 pt-4">
                        <button
                            type="button"
                            onClick={onClose}
                            disabled={loading}
                            className="flex-1 py-4 rounded-2xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all font-black tracking-widest"
                        >
                            CANCEL
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-4 rounded-2xl bg-gold text-black hover:bg-gold/90 transition-all font-black tracking-widest shadow-[0_10px_30px_rgba(255,215,0,0.2)] disabled:opacity-50"
                        >
                            {loading ? <Loader2 className="w-5 h-5 animate-spin inline" /> : 'UPDATE PLAYER'}
                        </button>
                    </div>
                </form>
            </motion.div>
        </div>
    );
}

function ConfirmDeleteModal({ show, onClose, onConfirm, type, name }: any) {
    if (!show) return null;

    return (
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-3xl">
            <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                className="glass-card bg-slate-900 border border-destructive/20 rounded-[2rem] p-8 max-w-md w-full mx-4 shadow-2xl"
            >
                <div className="text-center">
                    <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-destructive/20">
                        <Trash2 className="w-8 h-8 text-destructive" />
                    </div>
                    <h3 className="font-display text-2xl font-black text-white tracking-tight mb-2">CONFIRM DELETION</h3>
                    <p className="text-slate-400 font-sans mb-6">
                        Are you sure you want to delete this {type}?<br/>
                        <span className="text-white font-bold">{name}</span>
                    </p>
                    <div className="flex gap-4">
                        <button
                            onClick={onClose}
                            className="flex-1 py-4 rounded-2xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all font-black tracking-widest"
                        >
                            CANCEL
                        </button>
                        <button
                            onClick={onConfirm}
                            className="flex-1 py-4 rounded-2xl bg-destructive text-white hover:bg-destructive/90 transition-all font-black tracking-widest shadow-[0_10px_30px_rgba(239,68,68,0.2)]"
                        >
                            DELETE
                        </button>
                    </div>
                </div>
            </motion.div>
        </div>
    );
}

// --- SUB TABS -- //

function OverviewTab({ teams, players, settings, ...modalProps }: any) {
    const queryClient = useQueryClient();
    const soldPlayers = players?.filter((p: any) => p.is_sold).length || 0;
    const totalPlayers = players?.length || 0;
    const progress = totalPlayers > 0 ? (soldPlayers / totalPlayers) * 100 : 0;

    // CSV Import/Export handlers for captains
    const captainsFileInputRef = useRef<HTMLInputElement>(null);

    const exportCaptainsCSV = () => {
        if (!teams || teams.length === 0) return;

        const headers = ['Team Name', 'Captain Name', 'Email', 'Password', 'Phone Number', 'Created Date'];
        const data = teams.map((t: any) => [
            t.team_name,
            t.captain_name,
            t.captain_email,
            t.captain_password,
            t.phone_number || '',
            t.created_at || ''
        ]);
        const csv = Papa.unparse([headers, ...data]);
        downloadCSV(csv, 'captains.csv');
    };

    const importCaptainsCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const rows = results.data as any[];
                let successCount = 0;
                let skipCount = 0;

                for (const row of rows) {
                    if (!row['Team Name'] || !row['Captain Name'] || !row['Email'] || !row['Password']) continue;

                    try {
                        const email = row['Email'].trim();
                        const password = row['Password'].trim();

                        // Create auth user
                        const { data: authData, error: authError } = await supabase.auth.admin.createUser({
                            email,
                            password,
                            email_confirm: true
                        });

                        if (authError) {
                            if (authError.message.includes('already exists')) {
                                skipCount++;
                                continue;
                            }
                            throw authError;
                        }

                        // Assign captain role
                        await supabase.from('user_roles').insert({
                            user_id: authData.user!.id,
                            role: 'captain'
                        });

                        // Create team
                        const { data: teamData } = await supabase.from('teams').insert({
                            team_name: row['Team Name'].trim(),
                            captain_name: row['Captain Name'].trim(),
                            captain_user_id: authData.user!.id,
                            captain_email: email,
                            captain_password: password,
                            phone_number: row['Phone Number']?.trim() || '',
                            team_logo_url: `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(row['Team Name'].trim())}`,
                            captain_image_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(row['Captain Name'].trim())}`
                        }).select().single();

                        // Create auction rules
                        if (teamData?.id) {
                            await supabase.from('auction_rules').insert({
                                team_id: teamData.id,
                                captain_deduction: 0,
                                starting_purse: 30000
                            });
                        }

                        successCount++;
                    } catch (err) {
                        console.error('Error importing captain:', err);
                    }
                }

                alert(`Import completed!\nCreated: ${successCount}\nSkipped (already exists): ${skipCount}`);
                queryClient.invalidateQueries({ queryKey: ['teams'] });
                if (captainsFileInputRef.current) {
                    captainsFileInputRef.current.value = '';
                }
            },
            error: (error) => {
                alert('Error parsing CSV: ' + error.message);
            }
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            className="space-y-10 pb-12"
        >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h2 className="text-4xl md:text-5xl font-display font-black text-white tracking-tighter mb-2">SYSTEM OVERVIEW</h2>
                    <p className="text-slate-400 font-sans font-medium tracking-wide flex items-center gap-2 uppercase text-xs">
                        <Activity className="w-3 h-3 text-primary" />
                        Live Auction Operations Hub
                    </p>
                </div>
                <div className="glass px-6 py-3 rounded-2xl border-white/5 flex items-center gap-4">
                    <div className="text-right">
                        <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase">Global Progress</p>
                        <p className="text-xl font-display font-black text-white">{soldPlayers} / {totalPlayers}</p>
                    </div>
                    <div className="w-12 h-12 rounded-full border-2 border-primary/20 flex items-center justify-center p-1">
                        <div
                            className="w-full h-full rounded-full border-2 border-primary border-t-transparent animate-spin"
                            style={{ animationDuration: '3s' }}
                        />
                    </div>
                </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
                <StatCard title="Total Teams" value={teams?.length || 0} icon={Users} color="text-blue-500" accent="bg-blue-500" />
                <StatCard title="Available Pool" value={totalPlayers} icon={Users} color="text-purple-500" accent="bg-purple-500" />
                <StatCard title="Successfully Sold" value={soldPlayers} icon={CheckCircle} color="text-green-500" accent="bg-green-500" />
                <StatCard title="Auction Phase" value={settings?.is_auction_live ? "LIVE" : "IDLE"} icon={Activity} color={settings?.is_auction_live ? "text-destructive" : "text-slate-500"} accent={settings?.is_auction_live ? "bg-destructive" : "bg-slate-500"} isLive={settings?.is_auction_live} />
            </div>

            <div className="glass-card rounded-[2.5rem] p-8 border-white/5 relative overflow-hidden group">
                <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] pointer-events-none" />
                <div className="relative z-10">
                     <div className="flex justify-between items-center mb-8">
                         <div>
                             <h3 className="font-display text-2xl font-black text-white mb-1 uppercase tracking-tight">Captain Access Matrix</h3>
                             <p className="text-slate-500 text-sm font-sans">Active authentication tokens and credentials</p>
                         </div>
                         <div className="flex gap-2">
                             <button
                                 onClick={() => modalProps.setShowManualSale?.(true)}
                                 className="glass px-4 py-2 rounded-xl text-[10px] font-black tracking-widest text-slate-400 hover:text-white hover:bg-white/5 transition-colors flex items-center gap-2"
                             >
                                 <FilePlus className="w-4 h-4" />
                                 MANUAL SALE
                             </button>
                         </div>
                     </div>

                    <div className="overflow-x-auto scrollbar-hide max-h-[60vh]">
                        <table className="w-full text-left text-sm whitespace-nowrap">
                            <thead className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
                                <tr className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">
                                    <th className="px-4 py-4">Actions</th>
                                    <th className="px-4 py-5">Corporate Entity</th>
                                    <th className="px-4 py-5">Commanding Officer</th>
                                    <th className="px-4 py-5">Access Identification</th>
                                    <th className="px-4 py-5">Security Passcode</th>
                                    <th className="px-4 py-5 text-right">Comms</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-white/5">
                                {teams?.map((t: any) => (
                                    <tr key={t.id} className="group/row hover:bg-white/[0.02] transition-colors">
                                        <td className="px-4 py-4">
                                            <div className="flex gap-2">
                                                <button
                                                    onClick={() => {
                                                        modalProps.setSelectedCaptain(t);
                                                        modalProps.setShowEditCaptain?.(true);
                                                    }}
                                                    className="p-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
                                                    title="Edit Captain"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => modalProps.setDeleteConfirm({ type: 'captain', id: t.id, name: t.team_name })}
                                                    className="p-2 bg-destructive/10 hover:bg-destructive/20 text-destructive rounded-lg transition-colors"
                                                    title="Delete Captain"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                        <td className="px-4 py-6">
                                            <div className="flex items-center gap-3">
                                                <div className="w-10 h-10 rounded-xl bg-slate-900 border border-white/5 flex items-center justify-center p-1.5 grayscale group-hover/row:grayscale-0 transition-all">
                                                    <img src={t.team_logo_url} className="w-full h-full object-contain" />
                                                </div>
                                                <span className="font-display font-bold text-white tracking-wide">{t.team_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-6">
                                            <div className="flex items-center gap-3">
                                                <img src={t.captain_image_url} className="w-8 h-8 rounded-full bg-slate-800 border border-white/10" />
                                                <span className="font-sans font-medium text-slate-300">{t.captain_name}</span>
                                            </div>
                                        </td>
                                        <td className="px-4 py-6 font-mono text-xs text-slate-500 group-hover/row:text-primary transition-colors">{t.captain_email}</td>
                                        <td className="px-4 py-6">
                                            <span className="bg-slate-900 border border-white/5 px-3 py-1.5 rounded-lg text-gold font-mono font-bold tracking-widest text-xs group-hover/row:border-gold/30 transition-all">{t.captain_password}</span>
                                        </td>
                                         <td className="px-4 py-6 text-right font-sans font-medium text-slate-500 text-xs tracking-tight">{t.phone_number}</td>
                                     </tr>
                                 ))}
                             </tbody>
                           </table>
                      </div>
                </div>
            </div>
        </motion.div>
    );
}

function AuctionInputsTab({ settings }: any) {
    const queryClient = useQueryClient();
    const [sponsorImageUrl, setSponsorImageUrl] = useState(settings?.sponsor_image_url || '');
    const [saving, setSaving] = useState(false);
    const fileRef = useRef<HTMLInputElement>(null);

    useEffect(() => {
        setSponsorImageUrl(settings?.sponsor_image_url || '');
    }, [settings?.sponsor_image_url]);

    const handleUpload = (file?: File) => {
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => {
            if (typeof reader.result === 'string') {
                setSponsorImageUrl(reader.result);
            }
        };
        reader.readAsDataURL(file);
    };

    const saveSponsorImage = async () => {
        if (!settings?.id) return;
        setSaving(true);
        try {
            const { error } = await supabase
                .from('tournament_settings')
                .update({
                    sponsor_image_url: sponsorImageUrl.trim() || null,
                    updated_at: new Date().toISOString(),
                })
                .eq('id', settings.id);
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['settings'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard', 'settings'] });
            queryClient.invalidateQueries({ queryKey: ['dashboard'] });
            alert('Sponsor image updated successfully');
        } catch (error: any) {
            alert(error.message || 'Failed to update sponsor image');
        } finally {
            setSaving(false);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
        >
            <div>
                <h2 className="text-3xl font-display font-black text-white tracking-tight uppercase">Auction Inputs</h2>
                <p className="text-slate-500 text-xs font-sans uppercase tracking-[0.2em] font-bold mt-1">
                    Sponsor visibility controls for sold/unsold and pause states
                </p>
            </div>

            <div className="glass-card rounded-[2.5rem] p-8 border-white/5 space-y-6">
                <div className="flex items-center justify-between">
                    <div>
                        <h3 className="font-display text-2xl font-black text-white tracking-tight uppercase">Sponsors Image</h3>
                        <p className="text-slate-500 text-sm mt-1">Upload or paste a URL for the primary sponsor image.</p>
                    </div>
                    <button
                        onClick={() => fileRef.current?.click()}
                        className="glass px-4 py-3 rounded-xl text-[10px] font-black tracking-widest text-slate-400 hover:text-white transition-colors flex items-center gap-2"
                    >
                        <Upload className="w-4 h-4" />
                        UPLOAD IMAGE
                    </button>
                    <input
                        ref={fileRef}
                        type="file"
                        accept="image/*"
                        className="hidden"
                        onChange={(event) => handleUpload(event.target.files?.[0])}
                    />
                </div>

                <div className="space-y-2">
                    <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em]">Image URL</label>
                    <input
                        type="text"
                        value={sponsorImageUrl}
                        onChange={(e) => setSponsorImageUrl(e.target.value)}
                        placeholder="https://... or upload from device"
                        className="w-full bg-slate-950 border border-white/10 rounded-2xl px-5 py-3 text-white outline-none focus:border-primary/50 transition-all"
                    />
                </div>

                <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4 min-h-[260px] flex items-center justify-center">
                    {sponsorImageUrl ? (
                        <img src={sponsorImageUrl} alt="Sponsor Preview" className="max-h-[380px] w-auto object-contain rounded-xl" />
                    ) : (
                        <p className="text-slate-600 text-sm">No sponsor image selected</p>
                    )}
                </div>

                <div className="flex gap-4 pt-2">
                    <button
                        onClick={() => setSponsorImageUrl('')}
                        disabled={saving}
                        className="px-6 py-3 rounded-2xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all font-black tracking-widest text-xs disabled:opacity-50"
                    >
                        CLEAR
                    </button>
                    <button
                        onClick={saveSponsorImage}
                        disabled={saving}
                        className="px-6 py-3 rounded-2xl bg-gold text-black hover:bg-gold/90 transition-all font-black tracking-widest text-xs disabled:opacity-50 flex items-center gap-2"
                    >
                        {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : null}
                        SAVE SPONSOR IMAGE
                    </button>
                </div>
            </div>
        </motion.div>
    );
}

function StatCard({ title, value, icon: Icon, color, accent, isLive }: any) {
    return (
        <div className="group glass-card p-8 rounded-[2rem] border-white/5 flex flex-col justify-between h-48 relative overflow-hidden transition-all duration-500 hover:border-white/10">
            <div className={`absolute top-0 right-0 w-24 h-24 ${accent} opacity-[0.03] blur-[40px] rounded-full -translate-y-1/2 translate-x-1/2 group-hover:opacity-[0.08] transition-opacity`} />

            <div className="flex justify-between items-start">
                <div className={`p-4 rounded-2xl bg-slate-900 border border-white/5 ${color} group-hover:scale-110 transition-transform`}>
                    <Icon className="w-6 h-6" />
                </div>
                {isLive && (
                    <div className="flex items-center gap-2 bg-destructive/10 px-3 py-1 rounded-full">
                        <span className="w-1.5 h-1.5 rounded-full bg-destructive animate-ping" />
                        <span className="text-[10px] font-black text-destructive uppercase tracking-widest">Active</span>
                    </div>
                )}
            </div>

            <div>
                <p className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase mb-1">{title}</p>
                <motion.p
                    initial={{ scale: 0.9, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    className="text-4xl font-display font-black text-white tracking-tighter"
                >
                    {value}
                </motion.p>
            </div>
        </div>
    );
}

function PlayersTab({ players, ...modalProps }: any) {
    const [search, setSearch] = useState("");
    const [filterCat, setFilterCat] = useState("All");
    const playersFileInputRef = useRef<HTMLInputElement>(null);
    const [showEraseConfirm, setShowEraseConfirm] = useState(false);
    const [erasing, setErasing] = useState(false);
    const queryClient = useQueryClient();

    const filtered = players?.filter((p: any) => {
        if (search && !p.name.toLowerCase().includes(search.toLowerCase())) return false;
        if (filterCat !== "All" && p.category !== filterCat) return false;
        return true;
    });

    // Generate serial number for display
    const getFilteredWithSerial = () => {
        return filtered?.map((p: any, index: number) => ({ ...p, serialNo: index + 1 }));
    };

    const filteredWithSerial = getFilteredWithSerial();

    const eraseAllPlayers = async () => {
        setErasing(true);
        try {
            const { error } = await supabase.from('players').delete().neq('id', '00000000-0000-0000-0000-000000000000');
            if (error) throw error;
            queryClient.invalidateQueries({ queryKey: ['players'] });
            setShowEraseConfirm(false);
            alert('All players erased successfully!');
        } catch (err: any) {
            alert('Error erasing players: ' + err.message);
        } finally {
            setErasing(false);
        }
    };

    function EraseAllConfirmationModal({ show, onClose, onConfirm, loading }: any) {
        if (!show) return null;
        return (
            <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-3xl">
                <motion.div
                    initial={{ opacity: 0, scale: 0.95 }}
                    animate={{ opacity: 1, scale: 1 }}
                    className="glass-card bg-slate-900 border border-destructive/20 rounded-[2rem] p-8 max-w-md w-full mx-4 shadow-2xl"
                >
                    <div className="text-center">
                        <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-destructive/20">
                            <Trash2 className="w-8 h-8 text-destructive" />
                        </div>
                        <h3 className="font-display text-2xl font-black text-white tracking-tight mb-2">CONFIRM ERASE ALL</h3>
                        <p className="text-slate-400 font-sans mb-6">
                            This will <strong>permanently delete all players</strong> from the database.<br/>
                            This action cannot be undone!
                        </p>
                        <div className="flex gap-4">
                            <button
                                onClick={onClose}
                                disabled={loading}
                                className="flex-1 py-4 rounded-2xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all font-black tracking-widest disabled:opacity-50"
                            >
                                CANCEL
                            </button>
                            <button
                                onClick={onConfirm}
                                disabled={loading}
                                className="flex-1 py-4 rounded-2xl bg-destructive text-white hover:bg-destructive/90 transition-all font-black tracking-widest disabled:opacity-50"
                            >
                                {loading ? <Loader2 className="w-5 h-5 animate-spin inline" /> : 'ERASE ALL'}
                            </button>
                        </div>
                    </div>
                </motion.div>
            </div>
        );
    }

    const exportPlayersCSV = () => {
        if (!players || players.length === 0) return;

        const headers = ['Serial No.', 'Name', 'Classifications', 'Age', 'Height', 'Handy', 'Type', 'Earlier Seasons', 'Achievements', 'Special Remarks', 'Combat Role', 'Variant', 'Market Base', 'Phone Number', 'Status'];
        const data = players.map((p: any) => [
            '',
            p.name,
            p.category,
            p.age || '',
            p.height || '',
            p.handy || '',
            p.type || '',
            p.earlier_seasons || '',
            p.achievements || '',
            p.special_remarks || '',
            p.playing_role,
            p.gender,
            p.base_price,
            p.phone_number || '',
            p.is_sold ? 'Sold' : 'Available'
        ]);
        const csv = Papa.unparse([headers, ...data]);
        downloadCSV(csv, 'players.csv');
    };

    const importPlayersCSV = (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        Papa.parse(file, {
            header: true,
            skipEmptyLines: true,
            complete: async (results) => {
                const rows = results.data as any[];
                let successCount = 0;
                let skipCount = 0;
                let errorCount = 0;
                const errors: string[] = [];

                for (const row of rows) {
                    try {
                        // Import PlayerCSVSchema
                        const { PlayerCSVSchema } = await import('@/lib/csv/playerSchema');

                        // Validate row with Zod schema
                        const validated = PlayerCSVSchema.parse(row);

                        const name = validated.Name.trim();
                        const existingPlayer = players?.find((p: any) => p.name.toLowerCase() === name.toLowerCase());

                        if (existingPlayer) {
                            skipCount++;
                            continue;
                        }

                        await supabase.from('players').insert({
                            name,
                            category: validated.Classifications,
                            age: validated.Age,
                            height: validated.Height,
                            handy: validated.Handy,
                            type: validated.Type,
                            earlier_seasons: validated['Earlier Seasons'],
                            achievements: validated.Achievements,
                            special_remarks: validated['Special Remarks'],
                            playing_role: validated['Combat Role'],
                            gender: validated.Variant,
                            base_price: validated['Market Base'],
                            phone_number: validated['Phone Number'] || null,
                            image_url: `https://api.dicebear.com/7.x/avataaars/svg?seed=${encodeURIComponent(name)}`
                        });
                        successCount++;
                    } catch (err: any) {
                        errorCount++;
                        errors.push(`${row.Name || 'Unknown'}: ${err.message}`);
                    }
                }

                // Show detailed import results
                const resultMsg = [
                    `Import completed!`,
                    `Created: ${successCount}`,
                    `Skipped (already exists): ${skipCount}`,
                    `Errors: ${errorCount}`
                ].join('\n');

                if (errors.length > 0 && errors.length <= 5) {
                    alert(resultMsg + '\n\nError details:\n' + errors.join('\n'));
                } else if (errors.length > 5) {
                    alert(resultMsg + `\n\nFirst 5 errors:\n${errors.slice(0, 5).join('\n')}`);
                } else {
                    alert(resultMsg);
                }

                queryClient.invalidateQueries({ queryKey: ['players'] });
                if (playersFileInputRef.current) {
                    playersFileInputRef.current.value = '';
                }
            },
            error: (error) => {
                alert('Error parsing CSV: ' + error.message);
            }
        });
    };

    return (
        <motion.div
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            className="space-y-8"
        >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-center gap-6">
                <div>
                    <h2 className="text-3xl font-display font-black text-white tracking-tight uppercase">Elite Pool Directory</h2>
                    <p className="text-slate-500 text-xs font-sans uppercase tracking-[0.2em] font-bold mt-1">Found {filtered?.length || 0} matching entities</p>
                </div>

                <div className="flex flex-wrap gap-4 w-full md:w-auto">
                    <div className="relative flex-1 md:flex-none md:w-80 group">
                        <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-hover:text-primary transition-colors" />
                        <input
                            type="text"
                            placeholder="Identify specific player..."
                            value={search}
                            onChange={e => setSearch(e.target.value)}
                            className="w-full bg-slate-900/60 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm focus:border-primary/50 focus:bg-slate-900 outline-none transition-all placeholder:text-slate-600 font-sans"
                        />
                    </div>
                    <div className="relative group min-w-[160px]">
                        <Filter className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-hover:text-accent transition-colors" />
                        <select
                            value={filterCat}
                            onChange={e => setFilterCat(e.target.value)}
                            className="appearance-none w-full bg-slate-900/60 border border-white/5 rounded-2xl pl-12 pr-10 py-4 text-sm focus:border-accent/50 focus:bg-slate-900 outline-none transition-all font-display font-bold text-slate-300"
                        >
                            <option value="All">All Classifications</option>
                            <option value="A+">Platinum Tier (A+)</option>
                            <option value="A">Gold Tier (A)</option>
                            <option value="B">Silver Tier (B)</option>
                            <option value="C">Standard (C)</option>
                        </select>
                    </div>
                    <input
                        type="file"
                        ref={playersFileInputRef}
                        onChange={importPlayersCSV}
                        accept=".csv"
                        className="hidden"
                    />
                    <button
                        onClick={() => playersFileInputRef.current?.click()}
                        className="glass px-4 py-2 rounded-xl text-[10px] font-black tracking-widest text-slate-400 hover:text-white transition-colors flex items-center gap-2"
                    >
                        <Upload className="w-4 h-4" />
                        IMPORT CSV
                    </button>
                    <button
                        onClick={exportPlayersCSV}
                        className="glass px-4 py-2 rounded-xl text-[10px] font-black tracking-widest text-slate-400 hover:text-white transition-colors flex items-center gap-2"
                    >
                        <Download className="w-4 h-4" />
                        EXPORT CSV
                    </button>
                    <button
                        onClick={() => setShowEraseConfirm(true)}
                        className="glass px-4 py-2 rounded-xl text-[10px] font-black tracking-widest text-destructive hover:bg-destructive/10 transition-colors flex items-center gap-2"
                    >
                        <Trash2 className="w-4 h-4" />
                        ERASE ALL
                    </button>
                    <button
                        onClick={() => modalProps.setShowAddPlayer(true)}
                        className="glass px-4 py-2 rounded-xl text-[10px] font-black tracking-widest bg-gold text-black hover:bg-gold/90 transition-colors flex items-center gap-2"
                    >
                        <Plus className="w-4 h-4" />
                        ADD PLAYER
                    </button>
                </div>
            </div>

            <div className="glass-card rounded-[2.5rem] border-white/5 overflow-hidden">
                <div className="overflow-x-auto scrollbar-hide max-h-[60vh]">
                    <table className="w-full text-left text-sm whitespace-nowrap">
                        <thead className="sticky top-0 z-20 bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
                            <tr className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">
                                <th className="px-2 py-3">Actions</th>
                                <th className="px-4 py-5">Serial No.</th>
                                <th className="px-4 py-5">Name</th>
                                <th className="px-4 py-5">Classifications</th>
                                <th className="px-4 py-5">Age</th>
                                <th className="px-4 py-5">Height</th>
                                <th className="px-4 py-5">Handy</th>
                                <th className="px-4 py-5">Type</th>
                                <th className="px-4 py-5">Earlier Seasons</th>
                                <th className="px-4 py-5">Achievements</th>
                                <th className="px-4 py-5">Special Remarks</th>
                                <th className="px-4 py-5">Combat Role</th>
                                <th className="px-4 py-5">Variant</th>
                                <th className="px-4 py-5 font-right">Market Base</th>
                                <th className="px-4 py-5 text-right">Status</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-white/5">
                            {filteredWithSerial?.map((p: any) => (
                                <tr key={p.id} className="group/row hover:bg-white/[0.02] transition-colors">
                                    <td className="px-2 py-4">
                                        <div className="flex gap-2">
                                            <button
                                                onClick={() => {
                                                    modalProps.setSelectedPlayer(p);
                                                    modalProps.setShowEditPlayer?.(true);
                                                }}
                                                className="p-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
                                                title="Edit Player"
                                            >
                                                <Edit className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => !p.is_sold && modalProps.setDeleteConfirm({ type: 'player', id: p.id, name: p.name })}
                                                disabled={p.is_sold}
                                                className={`p-2 rounded-lg transition-colors ${p.is_sold ? 'bg-slate-800/30 text-slate-600 cursor-not-allowed' : 'bg-destructive/10 hover:bg-destructive/20 text-destructive'}`}
                                                title="Delete Player"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                    <td className="px-4 py-6 font-mono text-xs text-slate-500">{p.serialNo}</td>
                                    <td className="px-4 py-6">
                                        <div className="flex items-center gap-4">
                                            <div className="relative">
                                                <div className={`absolute -inset-1 rounded-full blur-md opacity-0 group-hover/row:opacity-20 transition-opacity ${p.category === 'A+' ? 'bg-gold' : 'bg-primary'}`} />
                                                <img src={p.image_url} className="w-12 h-12 rounded-full bg-slate-900 border border-white/10 relative z-10" />
                                            </div>
                                            <div>
                                                <p className="font-display font-black text-white tracking-widest text-base group-hover/row:text-primary transition-colors uppercase">{p.name}</p>
                                            </div>
                                        </div>
                                    </td>
                                    <td className="px-4 py-6">
                                        <span className={`px-3 py-1.5 rounded-lg text-[10px] font-black tracking-tighter uppercase border ${p.category === 'A+' ? 'bg-gold/10 text-gold border-gold/20' :
                                            p.category === 'A' ? 'bg-primary/10 text-primary border-primary/20' :
                                                'bg-slate-800 text-slate-400 border-white/5'
                                            }`}>
                                            {p.category} TIER
                                        </span>
                                    </td>
                                    <td className="px-4 py-6 text-slate-400 font-sans font-medium">{p.age || '-'}</td>
                                    <td className="px-4 py-6 text-slate-400 font-sans font-medium">{p.height || '-'}</td>
                                    <td className="px-4 py-6 text-slate-400 font-sans font-medium text-xs uppercase">{p.handy || '-'}</td>
                                    <td className="px-4 py-6 text-slate-400 font-sans font-medium text-xs">{p.type || '-'}</td>
                                    <td className="px-4 py-6 text-slate-400 font-sans font-medium text-xs">{p.earlier_seasons || '-'}</td>
                                    <td className="px-4 py-6 text-slate-400 font-sans font-medium text-xs">{p.achievements || '-'}</td>
                                    <td className="px-4 py-6 text-slate-400 font-sans font-medium text-xs">{p.special_remarks || '-'}</td>
                                    <td className="px-4 py-6 text-slate-400 font-sans font-medium">{p.playing_role}</td>
                                    <td className="px-4 py-6">
                                        <span className={`px-2 py-1 rounded-lg text-[10px] uppercase font-black border ${p.gender === 'Male' ? 'text-blue-400 border-blue-400/20 bg-blue-400/5' : 'text-pink-400 border-pink-400/20 bg-pink-400/5'}`}>
                                            {p.gender}
                                        </span>
                                    </td>
                                    <td className="px-4 py-6 font-display font-black text-white text-base">₹{p.base_price?.toLocaleString() || '0'}</td>
                                    <td className="px-4 py-6 text-right">
                                        {p.is_sold ? (
                                            <div className="flex flex-col items-end">
                                                <div className="flex items-center gap-2 text-green-400 font-display font-black uppercase text-sm -mb-0.5">
                                                    <span className="w-1.5 h-1.5 rounded-full bg-green-400" />
                                                    SOLD ₹{p.sold_price?.toLocaleString() || '0'}
                                                </div>
                                                <span className="text-[10px] text-slate-500 font-black tracking-widest uppercase">{p.team?.team_name}</span>
                                            </div>
                                        ) : (
                                            <span className="text-slate-600 text-[10px] font-black tracking-[0.2em] uppercase border border-white/5 px-3 py-1 rounded-full">Available</span>
                                        )}
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>
        </motion.div>
    );
}

// Helper function to download CSV
function downloadCSV(csvContent: string, filename: string) {
    const blob = new Blob([csvContent], { type: 'text/csv;charset=utf-8;' });
    const link = document.createElement('a');
    const url = URL.createObjectURL(blob);
    link.setAttribute('href', url);
    link.setAttribute('download', filename);
    link.style.visibility = 'hidden';
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
}

function RulesTab({ rules, settings }: any) {
    const queryClient = useQueryClient();
    const [globalPurse, setGlobalPurse] = useState(settings?.global_purse?.toString() || "30000");

    // Manual deduction state
    const [deductionTeamId, setDeductionTeamId] = useState("");
    const [deductionAmount, setDeductionAmount] = useState("");
    const [deductionReason, setDeductionReason] = useState("");

    // Base prices state
    const [basePrices, setBasePrices] = useState({
        A_plus: settings?.base_price_A_plus?.toString() || "500000",
        A: settings?.base_price_A?.toString() || "200000",
        B: settings?.base_price_B?.toString() || "100000",
        F: settings?.base_price_F?.toString() || "50000"
    });

    const updateGlobalPurse = async () => {
        try {
            // Update tournament_settings
            const { error: settingsError } = await supabase
                .from("tournament_settings")
                .update({ global_purse: parseInt(globalPurse) })
                .eq("id", settings.id);

            if (settingsError) throw settingsError;

            // Update all teams' starting_purse in auction_rules
            const { error: rulesError } = await supabase
                .from("auction_rules")
                .update({ starting_purse: parseInt(globalPurse) })
                .not('team_id', 'is', null);

            if (rulesError) throw rulesError;

            queryClient.invalidateQueries({ queryKey: ["settings"] });
            queryClient.invalidateQueries({ queryKey: ["rules"] });
            alert(`Global purse updated to ₹${parseInt(globalPurse).toLocaleString()} for all teams`);
        } catch (err: any) {
            alert('Error updating global purse: ' + err.message);
        }
    };

    const updateDeduction = async (ruleId: string, val: string) => {
        await supabase.from("auction_rules").update({ captain_deduction: parseInt(val) || 0 }).eq("id", ruleId);
        queryClient.invalidateQueries({ queryKey: ["rules"] });
    };

    const handleManualDeduction = async () => {
        if (!deductionTeamId || !deductionAmount || !deductionReason) {
            alert("Please fill all fields");
            return;
        }

        try {
            const result = await manualPurseDeduction(
                deductionTeamId,
                parseInt(deductionAmount),
                deductionReason
            );
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["rules"] });
                alert(`Deduction successful. New purse: ₹${result.newPurse?.toLocaleString()}`);
                // Reset form
                setDeductionTeamId("");
                setDeductionAmount("");
                setDeductionReason("");
            }
        } catch (err: any) {
            alert("Error processing deduction: " + err.message);
        }
    };

    const handleUpdateBasePrices = async () => {
        try {
            const result = await updateBasePrices({
                A_plus: parseInt(basePrices.A_plus),
                A: parseInt(basePrices.A),
                B: parseInt(basePrices.B),
                F: parseInt(basePrices.F)
            });
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["settings"] });
                alert("Base prices updated successfully!");
            }
        } catch (err: any) {
            alert("Error updating base prices: " + err.message);
        }
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-10"
        >
            <div className="flex flex-col md:flex-row justify-between items-start md:items-end gap-6">
                <div>
                    <h2 className="text-3xl font-display font-black text-white tracking-tight uppercase">Economic Protocols</h2>
                    <p className="text-slate-500 text-xs font-sans uppercase tracking-[0.2em] font-bold mt-1">Global Purse & Captain Deductions</p>
                </div>

                <div className="glass-card bg-slate-900/60 p-6 rounded-[2rem] border-white/5 flex items-end gap-6 group">
                    <div className="w-48">
                        <label className="text-[10px] text-slate-500 font-black tracking-[0.3em] mb-3 block uppercase">Global Base Currency</label>
                        <div className="relative">
                            <span className="absolute left-4 top-1/2 -translate-y-1/2 text-gold font-display font-black text-xl">₹</span>
                            <input
                                type="number"
                                value={globalPurse}
                                onChange={e => setGlobalPurse(e.target.value)}
                                className="w-full bg-slate-950/80 border border-white/5 rounded-2xl pl-10 pr-4 py-4 text-2xl font-display font-black text-white outline-none focus:border-gold/30 transition-all"
                            />
                        </div>
                    </div>
                    <button
                        onClick={updateGlobalPurse}
                        className="bg-gold hover:bg-gold/90 text-black font-display font-black text-xs tracking-widest px-8 rounded-2xl h-[62px] shadow-[0_10px_30px_rgba(255,215,0,0.2)] transition-all hover:scale-105 active:scale-95 uppercase"
                    >
                        Apply Global
                    </button>
                </div>
            </div>


            {/* Manual Purse Deduction */}
            <div className="glass-card bg-slate-900/60 p-6 rounded-[2rem] border-white/5">
                <h3 className="text-sm font-display font-black text-destructive tracking-[0.2em] mb-4 uppercase">Manual Purse Deduction</h3>
                <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                    <div>
                        <label className="text-[10px] text-slate-500 font-black tracking-[0.3em] mb-2 block uppercase">Team</label>
                        <select
                            value={deductionTeamId}
                            onChange={e => setDeductionTeamId(e.target.value)}
                            className="w-full bg-slate-950/80 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-destructive transition-all"
                        >
                            <option value="">Select team</option>
                            {rules?.map((r: any) => (
                                <option key={r.team_id} value={r.team_id}>
                                    {r.team?.team_name}
                                </option>
                            ))}
                        </select>
                    </div>
                    <div>
                        <label className="text-[10px] text-slate-500 font-black tracking-[0.3em] mb-2 block uppercase">Amount</label>
                        <div className="relative">
                            <span className="absolute left-3 top-1/2 -translate-y-1/2 text-destructive font-bold text-sm">-₹</span>
                            <input
                                type="number"
                                value={deductionAmount}
                                onChange={e => setDeductionAmount(e.target.value)}
                                placeholder="0"
                                className="w-full bg-slate-950/80 border border-white/5 rounded-xl pl-10 pr-4 py-3 text-white outline-none focus:border-destructive transition-all"
                            />
                        </div>
                    </div>
                    <div className="md:col-span-2">
                        <label className="text-[10px] text-slate-500 font-black tracking-[0.3em] mb-2 block uppercase">Reason</label>
                        <input
                            type="text"
                            value={deductionReason}
                            onChange={e => setDeductionReason(e.target.value)}
                            placeholder="Reason for deduction"
                            className="w-full bg-slate-950/80 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-white/20 transition-all"
                        />
                    </div>
                </div>
                <button
                    onClick={handleManualDeduction}
                    className="mt-4 bg-destructive hover:bg-destructive/90 text-white font-display font-black text-xs tracking-widest px-6 rounded-xl h-[42px] shadow-[0_4px_15px_rgba(239,68,68,0.2)] transition-all hover:scale-105 active:scale-95 uppercase"
                >
                    Apply Deduction
                </button>
            </div>

            {/* Base Price Configuration */}
            <div className="glass-card bg-slate-900/60 p-6 rounded-[2rem] border-white/5">
                <h3 className="text-sm font-display font-black text-gold tracking-[0.2em] mb-4 uppercase">Category Base Prices</h3>
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    {[
                        { key: "A_plus", label: "A+ Category", default: "500000" },
                        { key: "A", label: "A Category", default: "200000" },
                        { key: "B", label: "B Category", default: "100000" },
                        { key: "F", label: "F Category", default: "50000" }
                    ].map((category) => (
                        <div key={category.key}>
                            <label className="text-[10px] text-slate-500 font-black tracking-[0.3em] mb-2 block uppercase">{category.label}</label>
                            <div className="relative">
                                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-gold font-display font-black text-sm">₹</span>
                                <input
                                    type="number"
                                    value={basePrices[category.key as keyof typeof basePrices]}
                                    onChange={e => setBasePrices({ ...basePrices, [category.key]: e.target.value })}
                                    className="w-full bg-slate-950/80 border border-white/5 rounded-xl pl-10 pr-4 py-3 font-display font-black text-white outline-none focus:border-gold/30 transition-all"
                                />
                            </div>
                        </div>
                    ))}
                </div>
                <button
                    onClick={handleUpdateBasePrices}
                    className="mt-4 bg-gold hover:bg-gold/90 text-black font-display font-black text-xs tracking-widest px-6 rounded-xl h-[42px] shadow-[0_4px_15px_rgba(255,215,0,0.2)] transition-all hover:scale-105 active:scale-95 uppercase"
                >
                    Update Base Prices
                </button>
            </div>
            <div className="glass-card rounded-[2.5rem] border-white/5 overflow-hidden">
                <table className="w-full text-left text-sm whitespace-nowrap">
                    <thead className="bg-slate-950/80 backdrop-blur-xl border-b border-white/5">
                        <tr className="text-[10px] font-black text-slate-500 tracking-[0.2em] uppercase">
                            <th className="px-8 py-5">Corporate Unit</th>
                            <th className="px-4 py-5">Commanding Officer</th>
                            <th className="px-4 py-5">Base Resource</th>
                            <th className="px-4 py-5">Officer Deduction</th>
                            <th className="px-8 py-5 text-right">Current Purse</th>
                        </tr>
                    </thead>
                    <tbody className="divide-y divide-white/5">
                        {rules?.map((r: any) => (
                            <tr key={r.id} className="group/row hover:bg-white/[0.02] transition-colors">
                                <td className="px-8 py-6">
                                    <p className="font-display font-black text-white tracking-widest text-base uppercase">{r.team?.team_name}</p>
                                </td>
                                <td className="px-4 py-6 text-slate-400 font-sans font-medium">{r.team?.captain_name}</td>
                                <td className="px-4 py-6 font-display font-black text-slate-300">₹{r.starting_purse?.toLocaleString() || '0'}</td>
                                <td className="px-4 py-6">
                                    <div className="relative w-40">
                                        <span className="absolute left-3 top-1/2 -translate-y-1/2 text-destructive/50 font-bold text-xs">-₹</span>
                                        <input
                                            type="number"
                                            defaultValue={r.captain_deduction}
                                            onBlur={e => updateDeduction(r.id, e.target.value)}
                                            className="w-full bg-slate-900 border border-white/5 rounded-xl pl-9 pr-3 py-2 font-display font-black text-destructive focus:border-destructive outline-none transition-all text-base"
                                        />
                                    </div>
                                </td>
                                <td className="px-8 py-6 text-right">
                                    <div className="text-xl font-display font-black text-accent tracking-tighter glow-gold">
                                        ₹{r.current_purse?.toLocaleString() || '0'}
                                    </div>
                                </td>
                            </tr>
                        ))}
                    </tbody>
                </table>
            </div>
        </motion.div>
    );
}

function CaptainSelectionTab({ teams, players }: any) {
    const queryClient = useQueryClient();
    const [selectedCaptainId, setSelectedCaptainId] = useState<Record<string, string>>({});

    // Filter available players (not captain, not sold)
    const availablePlayers = players?.filter((p: any) => !p.is_captain && !p.is_sold) || [];

    const handleAssignCaptain = async (teamId: string, playerId: string) => {
        try {
            const result = await assignCaptain(teamId, playerId);
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["teams"] });
                queryClient.invalidateQueries({ queryKey: ["players"] });
                queryClient.invalidateQueries({ queryKey: ["rules"] });
                alert("Captain assigned successfully! New purse: ₹" + result.newPurse?.toLocaleString());
                setSelectedCaptainId({ ...selectedCaptainId, [teamId]: "" });
            }
        } catch (err: any) {
            alert("Error assigning captain: " + err.message);
        }
    };

    const handleRemoveCaptain = async (teamId: string) => {
        if (!confirm("Are you sure you want to remove this captain?")) return;
        try {
            const result = await removeCaptain(teamId);
            if (result.success) {
                queryClient.invalidateQueries({ queryKey: ["teams"] });
                queryClient.invalidateQueries({ queryKey: ["players"] });
                queryClient.invalidateQueries({ queryKey: ["rules"] });
                alert("Captain removed successfully! New purse: ₹" + result.newPurse?.toLocaleString());
            }
        } catch (err: any) {
            alert("Error removing captain: " + err.message);
        }
    };

    const getAvailablePlayersForTeam = (team: any) => {
        return availablePlayers.filter((p: any) => p.gender === team.gender);
    };

    return (
        <motion.div
            initial={{ opacity: 0, scale: 0.98 }}
            animate={{ opacity: 1, scale: 1 }}
            className="space-y-10"
        >
            <div>
                <h2 className="text-3xl font-display font-black text-white tracking-tight uppercase">Captain Assignment</h2>
                <p className="text-slate-500 text-xs font-sans uppercase tracking-[0.2em] font-bold mt-1">Team Leadership Selection</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {teams?.map((team: any) => {
                    const teamPlayers = getAvailablePlayersForTeam(team);
                    const currentCaptain = players?.find((p: any) => p.id === team.captain_player_id);

                    return (
                        <div key={team.id} className="glass-card bg-slate-900/60 p-6 rounded-[2rem] border-white/5">
                            <div className="flex items-center gap-4 mb-6">
                                <div className="w-12 h-12 bg-gold/10 rounded-xl flex items-center justify-center border border-gold/20 glow-gold">
                                    <Trophy className="w-6 h-6 text-gold" />
                                </div>
                                <div>
                                    <h3 className="font-display font-black text-white tracking-widest text-lg uppercase">{team.team_name}</h3>
                                    <p className="text-[10px] text-slate-500 font-black tracking-[0.2em] uppercase">{team.gender}</p>
                                </div>
                            </div>

                            {currentCaptain ? (
                                <div className="space-y-4">
                                    <div className="bg-slate-950/80 rounded-xl p-4 border border-gold/20">
                                        <p className="text-[10px] text-slate-500 font-black tracking-[0.2em] uppercase mb-2">Current Captain</p>
                                        <p className="font-display font-black text-white tracking-tight text-lg">{currentCaptain.name}</p>
                                        <p className="text-sm text-gold font-bold mt-1">{currentCaptain.category} Category</p>
                                    </div>
                                    <button
                                        onClick={() => handleRemoveCaptain(team.id)}
                                        className="w-full bg-destructive/10 hover:bg-destructive/20 text-destructive font-display font-black text-xs tracking-widest px-6 rounded-xl h-[42px] border border-destructive/30 transition-all hover:scale-105 active:scale-95 uppercase"
                                    >
                                        Remove Captain
                                    </button>
                                </div>
                            ) : (
                                <div className="space-y-4">
                                    <div>
                                        <label className="text-[10px] text-slate-500 font-black tracking-[0.2em] mb-2 block uppercase">Select Captain</label>
                                        <select
                                            value={selectedCaptainId[team.id] || ""}
                                            onChange={e => setSelectedCaptainId({ ...selectedCaptainId, [team.id]: e.target.value })}
                                            className="w-full bg-slate-950/80 border border-white/5 rounded-xl px-4 py-3 text-white outline-none focus:border-gold/30 transition-all"
                                        >
                                            <option value="">Select player</option>
                                            {teamPlayers.map((player: any) => (
                                                <option key={player.id} value={player.id}>
                                                    {player.name} - {player.category} - {player.playing_role}
                                                </option>
                                            ))}
                                        </select>
                                    </div>
                                    <button
                                        onClick={() => selectedCaptainId[team.id] && handleAssignCaptain(team.id, selectedCaptainId[team.id])}
                                        disabled={!selectedCaptainId[team.id]}
                                        className="w-full bg-gold hover:bg-gold/90 text-black font-display font-black text-xs tracking-widest px-6 rounded-xl h-[42px] shadow-[0_4px_15px_rgba(255,215,0,0.2)] transition-all hover:scale-105 active:scale-95 uppercase disabled:opacity-50 disabled:cursor-not-allowed disabled:hover:scale-100"
                                    >
                                        Assign Captain
                                    </button>
                                </div>
                            )}
                        </div>
                    );
                })}
            </div>

            <div className="glass-card bg-slate-900/60 p-6 rounded-[2rem] border-white/5">
                <div className="flex items-center gap-3 mb-4">
                    <Info className="w-5 h-5 text-gold" />
                    <p className="text-sm text-slate-400 font-medium">
                        <span className="text-gold font-bold">Note:</span> A+ category captains cost ₹5,00,000, A category captains cost ₹2,00,000. B and F category captains are free.
                        Captains are automatically added to team roster and cannot be auctioned.
                    </p>
                </div>
            </div>
        </motion.div>
    );
}

function LiveControllerTab({ auctionState, settings, players, teams }: any) {
    const isLive = settings?.is_auction_live;
    const soldPlayersCount = players?.filter((p: any) => p.is_sold).length || 0;
    const showMaxBidVisibility = soldPlayersCount > 85;
    const nextBidAmount = (auctionState?.current_bid_amount || auctionState?.current_base_price || 0) + 25000;
    const { data: recentBids } = useQuery({ queryKey: ["recent_bids"], queryFn: async () => (await supabase.from("bids").select("*, team:teams(*), player:players(*)").order("created_at", { ascending: false }).limit(20)).data });

    useRealtimeSubscription('dashboard_presence', ['dashboard_live_count']);
    const { data: liveDashboardCount = 0 } = useQuery({
        queryKey: ['dashboard_live_count'],
        queryFn: async () => {
            const cutoff = new Date(Date.now() - 30000).toISOString();
            const { count } = await supabase
                .from('dashboard_presence')
                .select('session_id', { count: 'exact', head: true })
                .gte('last_seen', cutoff);
            return count || 0;
        },
        refetchInterval: 10000,
    });

    // Timer management
    const { totalSeconds, minutes, seconds, isRunning, isPaused, pause, resume, start, isExpired } = useTimer();

    // Bids for current player
    const { bids, topBids, historyBids } = useBids(auctionState?.current_player?.id || null);

    // Import eligibility functions
    const [teamEligibility, setTeamEligibility] = useState<any[]>([]);
    const [bannedTeams, setBannedTeams] = useState<any[]>([]);

    useEffect(() => {
        const fetchEligibility = async () => {
            if (!auctionState?.current_player?.id || !teams) {
                setTeamEligibility([]);
                setBannedTeams([]);
                return;
            }

            try {
                const { getEligibleTeams } = await import('@/lib/validation/bidValidation');
                const eligibility = await getEligibleTeams(auctionState.current_player.id);
                setTeamEligibility(eligibility);

                const bans = await getBannedTeams(auctionState.current_player.id);
                setBannedTeams(bans);
            } catch (error) {
                console.error("Failed to fetch team eligibility:", error);
                setTeamEligibility([]);
                setBannedTeams([]);
            }
        };

        fetchEligibility();
    }, [auctionState?.current_player?.id, teams, auctionState?.current_bid]);

    const isTeamBanned = (teamId: string) => {
        return bannedTeams.some((ban: any) => ban.teamId === teamId);
    };

    const handleBanTeam = async (teamId: string, teamName: string) => {
        if (!auctionState?.current_player?.id) return;
        
        const confirmed = window.confirm(`Ban ${teamName} from bidding on ${auctionState.current_player.name}?`);
        if (!confirmed) return;

        try {
            await banTeamFromBidding(teamId, auctionState.current_player.id);
            const updatedBans = await getBannedTeams(auctionState.current_player.id);
            setBannedTeams(updatedBans);
        } catch (error: any) {
            alert(error.message || 'Failed to ban team');
        }
    };

    const handleUnbanTeam = async (teamId: string) => {
        if (!auctionState?.current_player?.id) return;

        try {
            await unbanTeam(teamId, auctionState.current_player.id);
            const updatedBans = await getBannedTeams(auctionState.current_player.id);
            setBannedTeams(updatedBans);
        } catch (error: any) {
            alert(error.message || 'Failed to unban team');
        }
    };

    // Timer settings state
    const [showTimerSettings, setShowTimerSettings] = useState(false);
    const [firstBidTimer, setFirstBidTimer] = useState(30);
    const [subsequentBidTimer, setSubsequentBidTimer] = useState(15);

    // Expiry modal state - shows when timer expires
    const [showExpiryModal, setShowExpiryModal] = useState(false);
    const [expiryModalType, setExpiryModalType] = useState<'no_bids' | 'has_bids'>('no_bids');
    
    // Deploy confirmation modal
    const [showDeployConfirm, setShowDeployConfirm] = useState(false);
    const [playerToDeploy, setPlayerToDeploy] = useState<any>(null);
    
    // Modify bid modal
    const [showModifyBid, setShowModifyBid] = useState(false);
    const [modifyBidAmount, setModifyBidAmount] = useState<number>(0);
    const [modifyTeamId, setModifyTeamId] = useState<string>('');

    // Track previous status for detecting transitions
    const [previousStatus, setPreviousStatus] = useState<string>('');

    // Listen for timer expiry event
    useEffect(() => {
        const handleExpiry = (e: Event) => {
            const customEvent = e as CustomEvent;
            console.log("Timer expired:", customEvent.detail);
            // Handle expiry logic - show modal
            const hasBids = (auctionState?.bid_count || 0) > 0;
            setExpiryModalType(hasBids ? 'has_bids' : 'no_bids');
            setShowExpiryModal(true);
        };

        window.addEventListener("timer-expiry", handleExpiry);
        return () => window.removeEventListener("timer-expiry", handleExpiry);
    }, [auctionState?.bid_count]);

    // Timer expiry detection - monitor totalSeconds (without queryClient)
    useEffect(() => {
        // Check if timer just expired (went from running to 0)
        if (totalSeconds === 0 && auctionState?.current_player_id && 
            (auctionState?.status === 'bidding' || auctionState?.status === 'waiting_for_first_bid')) {
            
            // Determine modal type based on bid count
            const hasBids = (auctionState?.bid_count || 0) > 0;
            setExpiryModalType(hasBids ? 'has_bids' : 'no_bids');
            setShowExpiryModal(true);
        }
    }, [totalSeconds, auctionState?.current_player_id, auctionState?.status, auctionState?.bid_count]);

    const [playerSearch, setPlayerSearch] = useState("");
    const [playerCategoryFilter, setPlayerCategoryFilter] = useState("All");
    const [playerRoleFilter, setPlayerRoleFilter] = useState("All");

    const [eligiblePlayers, setEligiblePlayers] = useState<any[]>([]);
    const [playerGenderFilter, setPlayerGenderFilter] = useState("All");

    // Filter eligible players for auction deployment
    useEffect(() => {
        const filterEligiblePlayers = async () => {
            if (!players) return;

            const eligible = await Promise.all(
                players.map(async (player: any) => {
                    const isEligible = await isPlayerEligibleForAuction(player.id);
                    return { ...player, isEligible };
                })
            );

            setEligiblePlayers(eligible.filter((p: any) => p.isEligible));
        };

        filterEligiblePlayers();
    }, [players]);

    // Create filtered eligible players list
    const filteredEligiblePlayers = eligiblePlayers.filter((p: any) => {
        // Search by name
        if (playerSearch && !p.name.toLowerCase().includes(playerSearch.toLowerCase())) {
            return false;
        }

        // Filter by category
        if (playerCategoryFilter !== "All" && p.category !== playerCategoryFilter) {
            return false;
        }

        // Filter by role
        if (playerRoleFilter !== "All" && p.playing_role !== playerRoleFilter) {
            return false;
        }

        // Filter by gender
        if (playerGenderFilter !== "All" && p.gender !== playerGenderFilter) {
            return false;
        }
        return true;
    });

    const queryClient = useQueryClient();
    
    // Track status changes for sold/unsold feedback
    useEffect(() => {
        if (previousStatus && previousStatus !== auctionState?.status) {
            // Status changed - might be a sale completion
            if (previousStatus === 'bidding' && auctionState?.status === 'idle') {
                // Auction completed - sold or unsold
                queryClient.invalidateQueries({ queryKey: ['auction_state'] });
            }
        }
        setPreviousStatus(auctionState?.status || '');
    }, [auctionState?.status, previousStatus, queryClient]);

    const toggleAuctionState = async () => {
        await supabase.from("tournament_settings").update({ is_auction_live: !isLive }).eq("id", settings.id);
        queryClient.invalidateQueries({ queryKey: ["settings"] });
    };

    // Deploy player with confirmation
    const handleDeployPlayer = async (player: any) => {
        setPlayerToDeploy(player);
        setShowDeployConfirm(true);
    };

    const confirmDeploy = async () => {
        if (!playerToDeploy) return;
        
        try {
            await deployPlayer(playerToDeploy.id);
            // Start the timer after successful deployment
            await start(firstBidTimer);
            setShowDeployConfirm(false);
            setPlayerToDeploy(null);
        } catch (error: any) {
            alert(error.message || 'Failed to deploy player');
        }
    };

    // Handle timer expiry
    const handleExpiryNoBids = async () => {
        // User chose to keep unsold
        if (auctionState?.current_player_id) {
            try {
                await markPlayerUnsold(auctionState.current_player_id);
            } catch (error: any) {
                alert(error.message || 'Failed to mark player as unsold');
            }
        }
        setShowExpiryModal(false);
    };

    const handleExpiryReauction = async () => {
        // User chose to re-auction - restart timer
        try {
            await start(firstBidTimer);
            setShowExpiryModal(false);
        } catch (error: any) {
            alert(error.message || 'Failed to re-auction player');
        }
    };

    const handleExpiryConfirmSale = async () => {
        // User confirmed sale at current bid
        if (!auctionState?.current_player_id || !auctionState?.current_bidder_team_id) {
            alert('No winning bidder');
            return;
        }

        try {
            await finalizeSale(
                auctionState.current_player_id,
                auctionState.current_bidder_team_id,
                auctionState.current_bid_amount || auctionState.current_base_price
            );
            // Trigger confetti
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#FFD700', '#FFFFFF', '#3b82f6']
            });
            setShowExpiryModal(false);
        } catch (error: any) {
            alert(error.message || 'Failed to finalize sale');
        }
    };

    const handleExpiryModifyBid = () => {
        // Open modify bid modal
        setModifyBidAmount(auctionState?.current_bid_amount || auctionState?.current_base_price || 0);
        setModifyTeamId(auctionState?.current_bidder_team_id || '');
        setShowExpiryModal(false);
        setShowModifyBid(true);
    };

    const confirmModifyBid = async () => {
        if (!auctionState?.current_player_id) return;

        try {
            const teamId = modifyTeamId || auctionState.current_bidder_team_id;
            const amount = modifyBidAmount;
            
            await finalizeSale(auctionState.current_player_id, teamId, amount);
            
            // Trigger confetti
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#FFD700', '#FFFFFF', '#3b82f6']
            });
            
            setShowModifyBid(false);
        } catch (error: any) {
            alert(error.message || 'Failed to finalize sale');
        }
    };

    const markSold = async () => {
        if (!auctionState?.current_player_id || !auctionState?.current_bidder_team_id) return;

        try {
            // Enforce roster limit before marking player as sold
            const { enforceMaxPlayersPerTeam } = await import('@/lib/validation/rosterRules');
            await enforceMaxPlayersPerTeam(auctionState.current_bidder_team_id);

            await finalizeSale(
                auctionState.current_player_id,
                auctionState.current_bidder_team_id,
                auctionState.current_bid_amount || auctionState.current_base_price
            );
            
            // Trigger confetti
            confetti({
                particleCount: 150,
                spread: 70,
                origin: { y: 0.6 },
                colors: ['#FFD700', '#FFFFFF', '#3b82f6']
            });
        } catch (err: any) {
            alert(err.message || 'Failed to mark player as sold');
        }
    };

    const markUnsold = async () => {
        if (!auctionState?.current_player_id) return;
        
        try {
            await markPlayerUnsold(auctionState.current_player_id);
        } catch (err: any) {
            alert(err.message || 'Failed to mark player as unsold');
        }
    };

    return (
        <div className="space-y-8 flex flex-col h-[calc(100vh-6rem)]">
            <div className="flex justify-between items-center glass-card bg-slate-950/40 p-6 border-white/5 rounded-[2rem] shrink-0">
                <div className="flex items-center gap-4">
                    <div className={`w-12 h-12 rounded-2xl flex items-center justify-center border transition-all duration-500 ${isLive ? 'bg-destructive/10 border-destructive/30 shadow-[0_0_20px_rgba(239,68,68,0.2)]' : 'bg-slate-900 border-white/5'}`}>
                        <Activity className={`w-6 h-6 ${isLive ? 'text-destructive animate-pulse' : 'text-slate-500'}`} />
                    </div>
                    <div>
                        <h2 className="text-3xl font-display font-black text-white tracking-tight">LIVE COMMAND CENTER</h2>
                        <p className="text-slate-500 text-[10px] font-black uppercase tracking-[0.3em]">${isLive ? 'Operational - Broadcast Live' : 'System Standby - Local Only'}</p>
                    </div>
                </div>

                <div className="flex gap-4">
                    <div className="glass px-5 py-3 rounded-2xl border-white/5">
                        <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase">Dashboard Live Count</p>
                        <p className="font-display font-black text-xl text-white tracking-widest">{liveDashboardCount}</p>
                    </div>
                    <button
                        onClick={toggleAuctionState}
                        className={`group flex items-center gap-3 px-8 py-4 rounded-2xl font-display font-black tracking-widest text-sm transition-all duration-500 ${isLive
                            ? 'bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive/20'
                            : 'bg-primary border text-white hover:scale-105 active:scale-95 glow-electric'
                            }`}
                    >
                        {isLive ? <><PauseCircle className="w-5 h-5 group-hover:rotate-180 transition-transform duration-500" /> KILL ENGINE</> : <><PlayCircle className="w-5 h-5 group-hover:rotate-12 transition-transform" /> ACTIVATE ENGINE</>}
                    </button>
                </div>
            </div>

            <div className="flex gap-8 min-h-0 flex-1">

                {/* Left Col: Current Block & Bids */}
                <div className="w-1/2 flex flex-col gap-8">
                    <div className="glass-card bg-slate-950/40 border border-white/5 rounded-[2.5rem] p-8 flex flex-col relative overflow-hidden group">
                        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 blur-[100px] pointer-events-none" />
                        
                        {/* Timer Display Section */}
                        <div className="flex justify-between items-start mb-6">
                            <h3 className="text-slate-500 uppercase text-[10px] font-black tracking-[0.4em]">Current Active Block</h3>
                            
                            {/* Timer Controls */}
                            <div className="flex items-center gap-3">
                                {/* Timer Settings Button */}
                                <button
                                    onClick={() => setShowTimerSettings(true)}
                                    className="p-2 rounded-xl bg-slate-900/60 border border-white/10 text-slate-400 hover:text-primary hover:border-primary/30 transition-all"
                                    title="Timer Settings"
                                >
                                    <Settings className="w-4 h-4" />
                                </button>
                                
                                {/* Pause/Resume Button */}
                                {auctionState?.current_player && (
                                    <button
                                        onClick={() => isPaused ? resume() : pause()}
                                        className={`flex items-center gap-2 px-4 py-2 rounded-xl font-display font-black text-xs uppercase tracking-widest transition-all ${
                                            isPaused 
                                                ? 'bg-green-500/10 border border-green-500/30 text-green-500 hover:bg-green-500/20' 
                                                : 'bg-yellow-500/10 border border-yellow-500/30 text-yellow-500 hover:bg-yellow-500/20'
                                        }`}
                                    >
                                        {isPaused ? (
                                            <><PlayCircle className="w-4 h-4" /> Resume</>
                                        ) : (
                                            <><PauseCircle className="w-4 h-4" /> Pause</>
                                        )}
                                    </button>
                                )}
                            </div>
                        </div>

                        {/* Timer Countdown Display */}
                        {auctionState?.current_player && (
                            <div className={`mb-8 p-6 rounded-[2rem] text-center relative overflow-hidden ${
                                isPaused 
                                    ? 'bg-slate-900/60 border-2 border-yellow-500/30' 
                                    : totalSeconds <= 10 
                                        ? 'bg-destructive/10 border-2 border-destructive/30 animate-pulse' 
                                        : 'bg-slate-900/40 border border-white/5'
                            }`}>
                                {isPaused && (
                                    <div className="absolute inset-0 flex items-center justify-center bg-slate-950/50 z-10">
                                        <span className="bg-yellow-500 text-black px-4 py-1 rounded-full text-xs font-black uppercase tracking-widest animate-pulse">
                                            PAUSED
                                        </span>
                                    </div>
                                )}
                                <p className="text-[10px] text-slate-500 uppercase tracking-[0.3em] font-black mb-2">
                                    {isPaused ? 'Timer Frozen At' : 'Time Remaining'}
                                </p>
                                <div className={`font-display font-black tracking-tighter ${
                                    totalSeconds <= 10 ? 'text-destructive text-7xl' : 'text-white text-7xl'
                                }`}>
                                    {formatMinutesSeconds(totalSeconds)}
                                </div>
                                {totalSeconds === 0 && (
                                    <p className="text-destructive font-black text-sm uppercase tracking-widest mt-2">
                                        Timer Expired!
                                    </p>
                                )}
                            </div>
                        )}

                        <AnimatePresence mode="wait">
                            {auctionState?.current_player ? (
                                <motion.div
                                    key={auctionState.current_player.id}
                                    initial={{ opacity: 0, scale: 0.95 }}
                                    animate={{ opacity: 1, scale: 1 }}
                                    exit={{ opacity: 0, y: -20 }}
                                    className="flex flex-col w-full"
                                >
                                    {/* Auction Status Banner */}
                                    <div className="mb-6 flex items-center justify-between">
                                        <div className="flex items-center gap-3">
                                            <span className={`w-3 h-3 rounded-full ${auctionState.status === 'bidding' ? 'bg-green-500 animate-pulse' : 'bg-yellow-500'}`} />
                                            <span className="text-white font-bold text-sm uppercase tracking-wider">
                                                {auctionState.status === 'waiting_for_first_bid' ? 'Waiting for First Bid' : 
                                                 auctionState.status === 'bidding' ? 'Bidding in Progress' : 
                                                 auctionState.status === 'idle' ? 'Idle' : auctionState.status}
                                            </span>
                                        </div>
                                        <div className="text-right">
                                            <p className="text-slate-500 text-[10px] uppercase tracking-wider">Base Price</p>
                                            <p className="text-white font-bold">₹{auctionState.current_base_price?.toLocaleString()}</p>
                                        </div>
                                    </div>

                                    {/* Player Card - Full Details */}
                                    <div className="mb-6">
                                        <PlayerCard 
                                            player={auctionState.current_player}
                                            basePrice={auctionState.current_base_price || 0}
                                            showBidInfo={true}
                                            currentBid={auctionState.current_bid}
                                            bidCount={auctionState.bid_count || 0}
                                            topBidder={auctionState.current_bidder}
                                        />
                                    </div>

                                    {/* Bid Increment Info */}
                                    <div className="bg-slate-900/60 border border-primary/20 rounded-xl p-4 mb-6">
                                        <div className="flex items-center justify-between">
                                            <div>
                                                <p className="text-slate-500 text-[10px] uppercase tracking-wider">Next Valid Bid</p>
                                                <p className="text-primary font-bold text-lg">
                                                    ₹{((auctionState.current_bid || auctionState.current_base_price || 0) + 25000).toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="text-right">
                                                <p className="text-slate-500 text-[10px] uppercase tracking-wider">Bid Increment</p>
                                                <p className="text-white font-bold">₹25,000</p>
                                            </div>
                                        </div>
                                    </div>

                                    {/* Sale Buttons */}
                                    <div className="grid grid-cols-2 gap-6 mt-auto">
                                        <button
                                            onClick={markSold}
                                            disabled={!auctionState.current_bidder_team_id}
                                            className="group bg-green-500 hover:bg-green-400 text-black font-display font-black py-6 rounded-2xl disabled:opacity-20 transition-all flex items-center justify-center gap-3 text-xl tracking-widest shadow-[0_10px_30px_rgba(34,197,94,0.2)] hover:scale-[1.02] active:scale-95 uppercase"
                                        >
                                            <CheckCircle className="w-6 h-6 group-hover:scale-125 transition-transform" /> SOLD
                                        </button>
                                        <button
                                            onClick={markUnsold}
                                            className="bg-slate-900 hover:bg-destructive/10 text-slate-500 hover:text-destructive border border-white/5 hover:border-destructive/30 font-display font-black py-6 rounded-2xl transition-all flex items-center justify-center gap-3 text-xl tracking-widest active:scale-95 uppercase"
                                        >
                                            <XCircle className="w-6 h-6" /> UNSOLD
                                        </button>
                                    </div>
                                </motion.div>
                            ) : (
                                <div className="flex-1 flex flex-col items-center justify-center text-slate-700 py-20">
                                    <div className="w-24 h-24 rounded-full border-2 border-slate-900 border-dashed animate-spin flex items-center justify-center mb-6" style={{ animationDuration: '8s' }}>
                                        <Gavel className="w-10 h-10 text-slate-900 -rotate-12" />
                                    </div>
                                    <p className="font-display text-2xl font-black uppercase tracking-[0.2em] opacity-40">System Idle</p>
                                    <p className="text-xs font-sans mt-2 opacity-30">Deploy player from queue to begin</p>
                                </div>
                            )}
                        </AnimatePresence>
                    </div>

                    <div className="flex-1 glass-card bg-slate-950/20 border border-white/5 rounded-[2.5rem] p-8 flex flex-col min-h-0">
                        <div className="flex items-center justify-between mb-8 shrink-0">
                            <h3 className="text-slate-500 uppercase text-[10px] font-black tracking-[0.4em]">
                                {auctionState?.current_player ? 'Live Bids' : 'Transaction Feed'}
                            </h3>
                            <div className="flex items-center gap-2">
                                <span className="w-1.5 h-1.5 rounded-full bg-primary animate-pulse" />
                                <span className="text-[10px] font-black text-slate-500 uppercase tracking-widest">Live Sync</span>
                            </div>
                        </div>
                        <div className="flex-1 overflow-y-auto pr-2 scrollbar-hide">
                            {auctionState?.current_player ? (
                                <BidHistory
                                    bids={bids}
                                    topBids={topBids}
                                    historyBids={historyBids}
                                    currentBidAmount={auctionState?.current_bid_amount}
                                />
                            ) : (
                                <AnimatePresence initial={false}>
                                    {recentBids?.length === 0 ? (
                                        <p className="text-center py-10 text-slate-700 font-sans italic">Silence on the floor...</p>
                                    ) : (
                                        recentBids?.map((b: any, i: number) => (
                                            <motion.div
                                                key={b.id}
                                                initial={{ opacity: 0, x: -20 }}
                                                animate={{ opacity: 1, x: 0 }}
                                                className="bg-slate-900/40 border border-white/5 p-4 rounded-2xl flex justify-between items-center transition-all hover:bg-slate-900 shadow-sm mb-3"
                                            >
                                                <div className="flex items-center gap-4">
                                                    <div className="w-10 h-10 rounded-xl bg-slate-950 flex items-center justify-center border border-white/5 text-[10px] font-black text-primary">
                                                        {b.team?.team_name?.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div>
                                                        <span className="font-display font-black text-white text-xs tracking-wider block uppercase">{b.team?.team_name}</span>
                                                        <span className="text-[10px] text-slate-500 font-medium">Bidding on {b.player?.name}</span>
                                                    </div>
                                                </div>
                                                <span className="font-display font-black text-primary text-xl tracking-tighter">₹{b.bid_amount?.toLocaleString() || '0'}</span>
                                            </motion.div>
                                        ))
                                    )}
                                </AnimatePresence>
                            )}
                        </div>
                    </div>
                </div>

                {/* Right Col: Team Eligibility & Player Queue */}
                <div className="w-1/2 flex flex-col gap-8 min-h-0">
                    {/* Team Eligibility Card */}
                    {auctionState?.current_player && (
                        <div className="glass-card bg-slate-950/40 border border-white/5 rounded-[2.5rem] p-8 flex flex-col shrink-0">
                            <div className="flex items-center justify-between mb-6">
                                <h3 className="font-display text-xl font-black text-white tracking-tight uppercase">Team Eligibility</h3>
                                <div className="flex items-center gap-2">
                                    <span className="text-[10px] bg-primary/10 text-primary border border-primary/20 px-3 py-1 rounded-full font-black tracking-widest uppercase">
                                        {teamEligibility.filter((t: any) => t.canBid).length} / {teamEligibility.length} Eligible
                                    </span>
                                    <span className={`text-[10px] px-3 py-1 rounded-full font-black tracking-widest uppercase border ${showMaxBidVisibility ? 'bg-red-500/10 text-red-300 border-red-500/20' : 'bg-slate-900/70 text-slate-500 border-white/10'}`}>
                                        Max Bid {showMaxBidVisibility ? 'ON' : 'OFF'}
                                    </span>
                                </div>
                            </div>

                            <div className="space-y-3 max-h-[300px] overflow-y-auto scrollbar-hide">
                                {teamEligibility.length === 0 ? (
                                    <div className="text-center py-6 text-slate-700">
                                        <p className="font-display text-sm uppercase tracking-[0.2em] opacity-40">Loading...</p>
                                    </div>
                                ) : (
                                    teamEligibility.map((team: any) => {
                                        const banned = isTeamBanned(team.teamId);
                                        const maxBidReached = showMaxBidVisibility && (Number(team.maxBid || 0) < nextBidAmount);
                                        return (
                                            <div
                                                key={team.teamId}
                                                className={`p-4 rounded-2xl flex items-center justify-between transition-all ${
                                                    maxBidReached
                                                        ? 'bg-red-500/10 border border-red-500/40'
                                                        : team.canBid && !banned
                                                        ? 'bg-slate-900/40 border border-white/5'
                                                        : 'bg-destructive/5 border border-destructive/20'
                                                }`}
                                            >
                                                <div className="flex items-center gap-3 flex-1">
                                                    <div className={`w-8 h-8 rounded-lg flex items-center justify-center text-xs font-black ${
                                                        maxBidReached ? 'bg-red-500/20 text-red-300' : team.canBid && !banned ? 'bg-primary/10 text-primary' : 'bg-destructive/10 text-destructive'
                                                    }`}>
                                                        {team.teamName?.substring(0, 2).toUpperCase()}
                                                    </div>
                                                    <div className="flex-1 min-w-0">
                                                        <p className="font-display text-sm font-black text-white tracking-wider truncate uppercase">
                                                            {team.teamName}
                                                        </p>
                                                        {maxBidReached && (
                                                            <p className="text-red-300 text-[10px] font-black uppercase tracking-wider mt-1">
                                                                MAX BID LIMIT REACHED
                                                            </p>
                                                        )}
                                                        {banned && (
                                                            <p className="text-destructive text-xs font-black uppercase tracking-wider mt-1">
                                                                BANNED
                                                            </p>
                                                        )}
                                                        {!team.canBid && !banned && team.reasons.length > 0 && (
                                                            <p className="text-[10px] text-destructive font-medium truncate mt-1">
                                                                {team.reasons[0]}
                                                            </p>
                                                        )}
                                                    </div>
                                                </div>
                                                <div className="flex items-center gap-4 ml-4">
                                                    {showMaxBidVisibility ? (
                                                        <div className="text-right">
                                                            <p className="text-[10px] text-slate-500 uppercase tracking-wider mb-1">Max Bid</p>
                                                            <p className={`font-display text-sm font-black tracking-tighter ${maxBidReached ? 'text-red-300' : 'text-white'}`}>
                                                                ₹{team.maxBid?.toLocaleString() || '0'}
                                                            </p>
                                                        </div>
                                                    ) : null}
                                                    {banned ? (
                                                        <button
                                                            onClick={() => handleUnbanTeam(team.teamId)}
                                                            className="p-2 rounded-xl bg-green-500/10 border border-green-500/20 text-green-500 hover:bg-green-500/20 transition-all"
                                                            title="Unban team"
                                                        >
                                                            <Shield className="w-4 h-4" />
                                                        </button>
                                                    ) : (
                                                        <button
                                                            onClick={() => handleBanTeam(team.teamId, team.teamName)}
                                                            className="p-2 rounded-xl bg-destructive/10 border border-destructive/20 text-destructive hover:bg-destructive/20 transition-all"
                                                            title="Ban team from bidding"
                                                        >
                                                            <Shield className="w-4 h-4" />
                                                        </button>
                                                    )}
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    )}

                    {/* Player Queue Card */}
                    <div className="glass-card bg-slate-950/40 border border-white/5 rounded-[2.5rem] flex flex-col min-h-0 flex-1">
                    <div className="p-8 border-b border-white/5 shrink-0 flex justify-between items-center">
                        <h3 className="font-display text-2xl font-black text-white tracking-tight uppercase">Operational Queue</h3>
                        <span className="glass px-4 py-2 rounded-xl text-[10px] font-black text-slate-400 tracking-widest uppercase">{filteredEligiblePlayers.length} Units</span>
                    </div>

                    {/* Search and Filters */}
                    <div className="p-6 border-b border-white/5 shrink-0 space-y-4">
                        <div className="flex gap-4">
                            <div className="relative flex-1 group">
                                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 group-hover:text-primary transition-colors" />
                                <input
                                    type="text"
                                    placeholder="Search players by name..."
                                    value={playerSearch}
                                    onChange={e => setPlayerSearch(e.target.value)}
                                    className="w-full bg-slate-900/60 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-sm focus:border-primary/50 focus:bg-slate-900 outline-none transition-all placeholder:text-slate-600 font-sans"
                                />
                            </div>
                        </div>

                        <div className="flex flex-wrap gap-3">
                            <div className="relative group min-w-[140px]">
                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 group-hover:text-gold transition-colors" />
                                <select
                                    value={playerCategoryFilter}
                                    onChange={e => setPlayerCategoryFilter(e.target.value)}
                                    className="appearance-none w-full bg-slate-900/60 border border-white/5 rounded-xl pl-10 pr-8 py-3 text-xs focus:border-gold/30 focus:bg-slate-900 outline-none transition-all font-display font-bold text-slate-300"
                                >
                                    <option value="All">All Categories</option>
                                    <option value="A+">Platinum (A+)</option>
                                    <option value="A">Gold (A)</option>
                                    <option value="B">Silver (B)</option>
                                    <option value="C">Standard (C)</option>
                                    <option value="F">Female (F)</option>
                                </select>
                            </div>

                            <div className="relative group min-w-[140px]">
                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 group-hover:text-primary transition-colors" />
                                <select
                                    value={playerRoleFilter}
                                    onChange={e => setPlayerRoleFilter(e.target.value)}
                                    className="appearance-none w-full bg-slate-900/60 border border-white/5 rounded-xl pl-10 pr-8 py-3 text-xs focus:border-primary/30 focus:bg-slate-900 outline-none transition-all font-display font-bold text-slate-300"
                                >
                                    <option value="All">All Roles</option>
                                    <option value="Batsman">Batsman</option>
                                    <option value="Bowler">Bowler</option>
                                    <option value="All-rounder">All-rounder</option>
                                    <option value="Wicket-keeper">Wicket-keeper</option>
                                </select>
                            </div>

                            <div className="relative group min-w-[140px]">
                                <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-3 h-3 text-slate-500 group-hover:text-accent transition-colors" />
                                <select
                                    value={playerGenderFilter}
                                    onChange={e => setPlayerGenderFilter(e.target.value)}
                                    className="appearance-none w-full bg-slate-900/60 border border-white/5 rounded-xl pl-10 pr-8 py-3 text-xs focus:border-accent/30 focus:bg-slate-900 outline-none transition-all font-display font-bold text-slate-300"
                                >
                                    <option value="All">All Genders</option>
                                    <option value="Male">Male</option>
                                    <option value="Female">Female</option>
                                </select>
                            </div>

                            <button
                                onClick={() => {
                                    setPlayerSearch("");
                                    setPlayerCategoryFilter("All");
                                    setPlayerRoleFilter("All");
                                    setPlayerGenderFilter("All");
                                }}
                                className="px-4 py-3 rounded-xl text-[10px] font-black tracking-widest text-slate-400 hover:text-white border border-white/5 hover:border-white/10 transition-colors"
                            >
                                CLEAR FILTERS
                            </button>
                        </div>
                    </div>

                    <div className="flex-1 overflow-y-auto p-4 scrollbar-hide">
                        <div className="space-y-3">
                            {filteredEligiblePlayers.length === 0 && (
                                <div className="text-center py-10 text-slate-700">
                                    <p className="font-display text-sm uppercase tracking-[0.2em] opacity-40">No players match filters</p>
                                </div>
                            )}
                            {filteredEligiblePlayers.map((p: any) => (
                                <div key={p.id} className="group bg-slate-950/40 border border-white/5 p-4 rounded-3xl flex items-center justify-between hover:border-primary/40 hover:bg-slate-900 transition-all duration-300">
                                    <div className="flex items-center gap-4">
                                        <div className="relative">
                                            <img src={p.image_url} className="w-14 h-14 rounded-2xl bg-slate-900 border border-white/10 group-hover:scale-105 transition-transform object-cover" />
                                            <div className={`absolute -bottom-1 -right-1 w-5 h-5 rounded-lg flex items-center justify-center text-[8px] font-black tracking-tighter border border-slate-900 ${p.category === 'A+' ? 'bg-gold text-black' : p.category === 'A' ? 'bg-primary text-white' : 'bg-slate-700 text-white'}`}>
                                                {p.category}
                                            </div>
                                        </div>
                                        <div>
                                            <p className="font-display font-black text-white text-base tracking-widest uppercase">{p.name}</p>
                                            <p className="text-[10px] text-slate-500 font-black tracking-widest uppercase">{p.playing_role}</p>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-6">
                                        <div className="text-right">
                                            <p className="text-[10px] text-slate-600 font-black uppercase tracking-widest mb-0.5">Base</p>
                                            <p className="font-display text-white font-black">₹{p.base_price?.toLocaleString() || '0'}</p>
                                        </div>
                                        <button
                                            onClick={() => handleDeployPlayer(p)}
                                            disabled={!!auctionState?.current_player_id || !isLive}
                                            className="bg-primary/10 hover:bg-primary text-primary hover:text-white border border-primary/20 hover:border-primary px-5 py-3 rounded-2xl text-[10px] font-black uppercase tracking-widest transition-all hover:scale-105 active:scale-95 disabled:opacity-0 disabled:pointer-events-none flex items-center gap-2"
                                        >
                                            <ListPlus className="w-4 h-4" /> Deploy
                                        </button>
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
                </div>

            </div>

            {/* Timer Settings Modal */}
            {showTimerSettings && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-3xl">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-card bg-slate-900 border border-white/10 rounded-[2rem] p-8 max-w-md w-full mx-4 shadow-2xl"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-display text-2xl font-black text-white tracking-tight">Timer Settings</h3>
                            <button onClick={() => setShowTimerSettings(false)} className="text-slate-400 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">
                                    First Bid Timer (seconds)
                                </label>
                                <input
                                    type="number"
                                    value={firstBidTimer}
                                    onChange={(e) => setFirstBidTimer(parseInt(e.target.value) || 30)}
                                    min={5}
                                    max={300}
                                    className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-gold/50 transition-all"
                                />
                                <p className="text-[10px] text-slate-500 ml-4">Time allowed for first bid (5-300 seconds)</p>
                            </div>

                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">
                                    Subsequent Bid Timer (seconds)
                                </label>
                                <input
                                    type="number"
                                    value={subsequentBidTimer}
                                    onChange={(e) => setSubsequentBidTimer(parseInt(e.target.value) || 15)}
                                    min={5}
                                    max={300}
                                    className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-gold/50 transition-all"
                                />
                                <p className="text-[10px] text-slate-500 ml-4">Time allowed after each new bid (5-300 seconds)</p>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    type="button"
                                    onClick={() => setShowTimerSettings(false)}
                                    className="flex-1 py-4 rounded-2xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all font-black tracking-widest"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={async () => {
                                        try {
                                            await updateTimerSettings(firstBidTimer, subsequentBidTimer);
                                            setShowTimerSettings(false);
                                        } catch (error: any) {
                                            alert(error.message || 'Failed to update timer settings');
                                        }
                                    }}
                                    className="flex-1 py-4 rounded-2xl bg-gold text-black hover:bg-gold/90 transition-all font-black tracking-widest shadow-[0_10px_30px_rgba(255,215,0,0.2)]"
                                >
                                    Save Settings
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Deploy Player Confirmation Modal */}
            {showDeployConfirm && playerToDeploy && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-3xl">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-card bg-slate-900 border border-white/10 rounded-[2rem] p-8 max-w-md w-full mx-4 shadow-2xl"
                    >
                        <div className="text-center">
                            <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-primary/20">
                                <Gavel className="w-8 h-8 text-primary" />
                            </div>
                            <h3 className="font-display text-2xl font-black text-white tracking-tight mb-2">CONFIRM DEPLOYMENT</h3>
                            <p className="text-slate-400 font-sans mb-6">
                                Deploy <span className="text-white font-bold">{playerToDeploy.name}</span> to auction?<br/>
                                <span className="text-gold">Base Price: ₹{playerToDeploy.base_price?.toLocaleString()}</span>
                            </p>
                            <div className="flex gap-4">
                                <button
                                    onClick={() => {
                                        setShowDeployConfirm(false);
                                        setPlayerToDeploy(null);
                                    }}
                                    className="flex-1 py-4 rounded-2xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all font-black tracking-widest"
                                >
                                    CANCEL
                                </button>
                                <button
                                    onClick={confirmDeploy}
                                    className="flex-1 py-4 rounded-2xl bg-primary text-white hover:bg-primary/90 transition-all font-black tracking-widest shadow-[0_10px_30px_rgba(59,130,246,0.2)]"
                                >
                                    DEPLOY
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Timer Expiry Modal */}
            {showExpiryModal && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-3xl">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-card bg-slate-900 border border-destructive/20 rounded-[2rem] p-8 max-w-lg w-full mx-4 shadow-2xl"
                    >
                        <div className="text-center">
                            <div className="w-16 h-16 bg-destructive/10 rounded-full flex items-center justify-center mx-auto mb-6 border border-destructive/20">
                                <XCircle className="w-8 h-8 text-destructive" />
                            </div>
                            <h3 className="font-display text-2xl font-black text-white tracking-tight mb-2">TIME'S UP!</h3>
                            
                            {expiryModalType === 'no_bids' ? (
                                <>
                                    <p className="text-slate-400 font-sans mb-6">
                                        No bids received for this player.<br/>
                                        What would you like to do?
                                    </p>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={handleExpiryNoBids}
                                            className="flex-1 py-4 rounded-2xl bg-destructive text-white hover:bg-destructive/90 transition-all font-black tracking-widest"
                                        >
                                            KEEP UNSOLD
                                        </button>
                                        <button
                                            onClick={handleExpiryReauction}
                                            className="flex-1 py-4 rounded-2xl bg-gold text-black hover:bg-gold/90 transition-all font-black tracking-widest shadow-[0_10px_30px_rgba(255,215,0,0.2)]"
                                        >
                                            RE-AUCTION
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <>
                                    <p className="text-slate-400 font-sans mb-2">
                                        Auction completed! Current highest bid:
                                    </p>
                                    <p className="text-3xl font-display font-black text-gold mb-4">
                                        ₹{auctionState?.current_bid_amount?.toLocaleString()}
                                    </p>
                                    <p className="text-white font-bold mb-6">
                                        by {auctionState?.current_bidder?.team_name || 'Unknown Team'}
                                    </p>
                                    <div className="flex gap-4">
                                        <button
                                            onClick={handleExpiryModifyBid}
                                            className="flex-1 py-4 rounded-2xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all font-black tracking-widest"
                                        >
                                            MODIFY BID
                                        </button>
                                        <button
                                            onClick={handleExpiryConfirmSale}
                                            className="flex-1 py-4 rounded-2xl bg-green-500 text-white hover:bg-green-400 transition-all font-black tracking-widest shadow-[0_10px_30px_rgba(34,197,94,0.2)]"
                                        >
                                            CONFIRM SALE
                                        </button>
                                    </div>
                                </>
                            )}
                        </div>
                    </motion.div>
                </div>
            )}

            {/* Modify Bid Modal */}
            {showModifyBid && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center bg-slate-950/90 backdrop-blur-3xl">
                    <motion.div
                        initial={{ opacity: 0, scale: 0.95 }}
                        animate={{ opacity: 1, scale: 1 }}
                        className="glass-card bg-slate-900 border border-white/10 rounded-[2rem] p-8 max-w-md w-full mx-4 shadow-2xl"
                    >
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="font-display text-2xl font-black text-white tracking-tight">MODIFY SALE</h3>
                            <button onClick={() => setShowModifyBid(false)} className="text-slate-400 hover:text-white">
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="space-y-6">
                            <div className="space-y-2">
                                <label className="text-[10px] font-black text-slate-500 uppercase tracking-[0.3em] ml-4">
                                    Final Bid Amount (₹)
                                </label>
                                <input
                                    type="number"
                                    value={modifyBidAmount}
                                    onChange={(e) => setModifyBidAmount(parseInt(e.target.value) || 0)}
                                    className="w-full bg-slate-950 border border-white/10 rounded-2xl px-6 py-4 text-white outline-none focus:border-gold/50 transition-all"
                                />
                            </div>

                            <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-xl">
                                <p className="text-yellow-500 text-sm font-medium">
                                    Warning: Modifying the bid from the actual highest bid will be recorded as-is.
                                </p>
                            </div>

                            <div className="flex gap-4 pt-4">
                                <button
                                    onClick={() => setShowModifyBid(false)}
                                    className="flex-1 py-4 rounded-2xl bg-white/5 text-white border border-white/10 hover:bg-white/10 transition-all font-black tracking-widest"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={confirmModifyBid}
                                    className="flex-1 py-4 rounded-2xl bg-green-500 text-white hover:bg-green-400 transition-all font-black tracking-widest shadow-[0_10px_30px_rgba(34,197,94,0.2)]"
                                >
                                    Confirm Sale
                                </button>
                            </div>
                        </div>
                    </motion.div>
                </div>
            )}
        </div>
    );
}
