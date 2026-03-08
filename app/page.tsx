"use client";

import { useQuery } from '@tanstack/react-query';
import { supabase } from '@/lib/supabase';
import { useRealtimeSubscription } from '@/hooks/useRealtime';
import { motion, AnimatePresence } from 'framer-motion';
import Link from 'next/link';
import { Shield, Users, Activity, Gavel, Trophy, ArrowRight, Zap, Target, Star, CheckCircle, Monitor } from 'lucide-react';
import { useEffect, useState } from 'react';

const fetchSettings = async () => {
  const { data } = await supabase.from('tournament_settings').select('*').single();
  return data;
};

const fetchAuctionState = async () => {
  const { data } = await supabase.from('auction_state').select('*, current_player:players(*), current_bidder:teams(*)').single();
  return data;
};

const fetchRecentBids = async () => {
  const { data } = await supabase.from('bids').select('*, team:teams(*), player:players(*)').order('created_at', { ascending: false }).limit(10);
  return data;
};

const fetchTopSoldPlayers = async () => {
  const { data } = await supabase.from('players').select('*, sold_to_team:teams(*)').eq('is_sold', true).order('sold_price', { ascending: false }).limit(10);
  return data;
};

export default function LandingPage() {
  useRealtimeSubscription('tournament_settings', ['settings']);
  useRealtimeSubscription('auction_state', ['auction_state']);
  useRealtimeSubscription('bids', ['recent_bids']);
  useRealtimeSubscription('players', ['top_players']);

  const { data: settings } = useQuery({ queryKey: ['settings'], queryFn: fetchSettings });
  const { data: auctionState } = useQuery({ queryKey: ['auction_state'], queryFn: fetchAuctionState });
  const { data: recentBids } = useQuery({ queryKey: ['recent_bids'], queryFn: fetchRecentBids });
  const { data: topPlayers } = useQuery({ queryKey: ['top_players'], queryFn: fetchTopSoldPlayers });

  const isLive = settings?.is_auction_live;

  const containerVariants = {
    hidden: { opacity: 0 },
    visible: {
      opacity: 1,
      transition: { staggerChildren: 0.1, delayChildren: 0.3 }
    }
  } as const;

  const itemVariants = {
    hidden: { y: 20, opacity: 0 },
    visible: { y: 0, opacity: 1, transition: { type: "spring", stiffness: 100 } }
  } as const;

  return (
    <div className="min-h-screen relative overflow-x-hidden bg-background mesh-gradient flex flex-col">
      {/* Dynamic Background Elements */}
      <div className="absolute top-0 left-0 w-full h-full overflow-hidden pointer-events-none z-0">
        <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] bg-primary/20 blur-[120px] rounded-full animate-float" />
        <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] bg-accent/10 blur-[120px] rounded-full animate-float" style={{ animationDelay: '2s' }} />
      </div>

      <main className="relative z-10 container mx-auto px-4 pt-12 md:pt-20 flex-1">
        <motion.div
          variants={containerVariants}
          initial="hidden"
          animate="visible"
          className="flex flex-col items-center text-center"
        >
          {/* Status Badge */}
          <motion.div variants={itemVariants} className="mb-6">
            {isLive ? (
              <div className="glass px-6 py-2 rounded-full flex items-center gap-3 border-destructive/30">
                <span className="relative flex h-3 w-3">
                  <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-destructive opacity-75"></span>
                  <span className="relative inline-flex rounded-full h-3 w-3 bg-destructive"></span>
                </span>
                <span className="font-display font-black tracking-[0.2em] text-xs text-destructive-foreground uppercase">Live Auction Phase</span>
              </div>
            ) : (
              <div className="glass px-6 py-2 rounded-full border-gold/20 flex items-center gap-2">
                <Star className="w-4 h-4 text-gold fill-gold animate-pulse" />
                <span className="font-display font-bold tracking-[0.2em] text-xs text-gold uppercase">Season 2026 Premier</span>
              </div>
            )}
          </motion.div>

          {/* Main Hero */}
          <motion.h1
            variants={itemVariants}
            className="font-display text-4xl md:text-7xl lg:text-9xl font-black tracking-tighter mb-6 text-gradient-gold leading-[0.9]"
          >
            {settings?.tournament_name || 'SUKRUT PREMIER LEAGUE'}
          </motion.h1>

          <motion.p
            variants={itemVariants}
            className="text-slate-400 text-lg md:text-xl font-medium max-w-3xl mx-auto mb-10 leading-relaxed font-sans"
          >
            Experience the adrenaline of high-stakes cricket auctions.
            <span className="text-white"> 24 Elite Teams. Real-time Bidding. One Ultimate Champion.</span>
          </motion.p>

          {/* Login Actions */}
          <motion.div variants={itemVariants} className="flex flex-wrap justify-center gap-6 mb-24">
            <Link href="/dashboard">
              <button className="group relative glass px-8 py-5 rounded-2xl font-display font-black tracking-widest text-lg overflow-hidden transition-all hover:scale-105 active:scale-95 border-emerald-300/40 flex items-center gap-3 min-w-[260px] justify-center bg-emerald-500/10 hover:bg-emerald-500/20">
                <Monitor className="w-6 h-6 text-emerald-300 group-hover:rotate-6 transition-transform" />
                <span className="text-white">LIVE DASHBOARD</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </button>
            </Link>
            <Link href="/login?role=captain">
              <button className="group relative glass px-8 py-5 rounded-2xl font-display font-black tracking-widest text-lg overflow-hidden transition-all hover:scale-105 active:scale-95 border-primary/30 flex items-center gap-3 min-w-[260px] justify-center bg-primary/5 hover:bg-primary/20">
                <Users className="w-6 h-6 text-primary group-hover:rotate-12 transition-transform" />
                <span className="text-white">CAPTAIN TERMINAL</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </button>
            </Link>
            <Link href="/login?role=admin">
              <button className="group relative glass px-8 py-5 rounded-2xl font-display font-black tracking-widest text-lg overflow-hidden transition-all hover:scale-105 active:scale-95 border-gold/30 flex items-center gap-3 min-w-[260px] justify-center bg-gold/5 hover:bg-gold/20">
                <Shield className="w-6 h-6 text-gold group-hover:rotate-12 transition-transform" />
                <span className="text-white">ADMIN CONSOLE</span>
                <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000" />
              </button>
            </Link>
          </motion.div>

          {/* Main Auction Block (Conditional) */}
          <AnimatePresence mode="wait">
            {isLive && auctionState && (
              <motion.div
                initial={{ opacity: 0, scale: 0.95 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 1.05 }}
                className="w-full max-w-6xl mb-24"
              >
                <div className="glass-card rounded-[2.5rem] p-4 md:p-8 flex flex-col lg:flex-row gap-8 relative overflow-hidden group">
                  <div className="absolute top-0 right-0 p-8 opacity-10 pointer-events-none">
                    <Gavel className="w-64 h-64 -rotate-12" />
                  </div>

                  {/* Player Profile Section */}
                  <div className="flex-1 glass bg-slate-950/40 rounded-[2rem] p-8 flex flex-col items-center justify-center relative border-white/5 h-full min-h-[450px]">
                    <AnimatePresence mode="wait">
                      {auctionState.current_player ? (
                        <motion.div
                          key={auctionState.current_player.id}
                          initial={{ opacity: 0, y: 20 }}
                          animate={{ opacity: 1, y: 0 }}
                          exit={{ opacity: 0, y: -20 }}
                          className="flex flex-col items-center w-full"
                        >
                          <div className="flex gap-3 mb-8">
                            <span className="glass px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase border-accent/20 text-accent">{auctionState.current_player.category}</span>
                            <span className="glass px-4 py-1.5 rounded-full text-[10px] font-black tracking-widest uppercase border-primary/20 text-primary">{auctionState.current_player.playing_role}</span>
                          </div>

                          <div className="relative mb-8">
                            <div className="absolute inset-0 bg-gold/20 blur-[40px] rounded-full animate-pulse" />
                            <img
                              src={auctionState.current_player.image_url || `https://api.dicebear.com/7.x/avataaars/svg?seed=${auctionState.current_player.name}`}
                              alt="Player"
                              className="w-48 h-48 rounded-full border-4 border-gold/50 shadow-2xl relative z-10 object-cover bg-slate-900"
                            />
                          </div>

                          <h2 className="text-4xl md:text-5xl font-display font-black mb-2 text-center text-gradient-gold">
                            {auctionState.current_player.name}
                          </h2>
                          <p className="text-slate-500 font-display text-sm tracking-[0.3em] font-bold mb-8">BASE PRICE: ₹{auctionState.current_player.base_price.toLocaleString()}</p>

                          <div className="w-full max-w-sm glass bg-slate-900/60 rounded-3xl p-6 border-gold/20 glow-gold">
                            <div className="flex justify-between items-center px-2">
                              <div className="text-left">
                                <p className="text-[10px] text-slate-400 font-black tracking-widest uppercase mb-1">Current Active Bid</p>
                                <p className="text-4xl font-display font-black text-white leading-none">₹{auctionState.current_bid.toLocaleString()}</p>
                              </div>
                              {auctionState.current_bidder && (
                                <motion.div
                                  initial={{ scale: 0.8 }}
                                  animate={{ scale: 1 }}
                                  className="text-right flex flex-col items-end"
                                >
                                  <Trophy className="w-6 h-6 text-gold mb-1" />
                                  <p className="text-xs font-black text-white uppercase max-w-[120px] truncate">{auctionState.current_bidder.team_name}</p>
                                </motion.div>
                              )}
                            </div>
                          </div>
                        </motion.div>
                      ) : (
                        <div className="flex flex-col items-center justify-center opacity-30 text-center py-20">
                          <Activity className="w-20 h-20 mb-6 text-slate-400 animate-pulse" />
                          <h3 className="text-2xl font-display font-black tracking-widest">AUCTION ENGINE IDLE</h3>
                          <p className="text-sm font-sans">Awaiting next entry from Admin console...</p>
                        </div>
                      )}
                    </AnimatePresence>
                  </div>

                  {/* Live Feed Section */}
                  <div className="flex-1 flex flex-col h-full min-h-[450px]">
                    <div className="flex items-center justify-between mb-6">
                      <h3 className="font-display text-xl font-black flex items-center gap-3 tracking-widest text-slate-200">
                        <Zap className="w-5 h-5 text-primary fill-primary/20" />
                        EVENT STREAM
                      </h3>
                      <span className="text-[10px] font-black text-slate-500 tracking-widest">REAL-TIME SYNC</span>
                    </div>

                    <div className="flex-1 glass bg-slate-950/20 rounded-[2rem] p-4 overflow-y-auto max-h-[480px] border-white/5">
                      <div className="space-y-4">
                        {recentBids?.length === 0 ? (
                          <div className="h-full flex items-center justify-center text-slate-600 font-sans italic py-20">
                            Silence on the floor... No bids reported.
                          </div>
                        ) : (
                          recentBids?.map((bid, i) => (
                            <motion.div
                              key={bid.id}
                              initial={{ opacity: 0, x: -20 }}
                              animate={{ opacity: 1, x: 0 }}
                              transition={{ delay: i * 0.05 }}
                              className="glass-card bg-slate-900/40 p-5 rounded-2xl flex justify-between items-center border-slate-800/20"
                            >
                              <div className="flex items-center gap-4">
                                <div className="w-10 h-10 rounded-full bg-slate-800 flex items-center justify-center text-xs font-black text-slate-400 border border-white/5">
                                  {bid.team?.team_name?.substring(0, 2).toUpperCase()}
                                </div>
                                <div>
                                  <p className="font-black text-white text-xs tracking-wider flex items-center gap-2">
                                    {bid.team?.team_name}
                                    {bid.is_winning_bid && <Star className="w-3 h-3 text-gold fill-gold" />}
                                  </p>
                                  <p className="text-[10px] text-slate-500 font-bold">{bid.player?.name}</p>
                                </div>
                              </div>
                              <div className="text-right">
                                <span className="font-display font-black text-lg text-primary">₹{bid.bid_amount.toLocaleString()}</span>
                              </div>
                            </motion.div>
                          ))
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Top Sold Ticker */}
                {topPlayers && topPlayers.length > 0 && (
                  <motion.div
                    initial={{ opacity: 0, y: 40 }}
                    animate={{ opacity: 1, y: 0 }}
                    className="mt-12"
                  >
                    <div className="flex items-center gap-4 mb-6">
                      <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                      <h3 className="font-display text-xs font-black uppercase tracking-[0.4em] text-gold/60">Elite Sold Directory</h3>
                      <div className="h-[1px] flex-1 bg-gradient-to-r from-transparent via-gold/20 to-transparent" />
                    </div>

                    <div className="flex gap-4 overflow-x-auto pb-6 scrollbar-hide snap-x">
                      {topPlayers.map((p) => (
                        <div key={p.id} className="min-w-[280px] glass-card bg-slate-950/40 p-4 rounded-3xl flex items-center gap-4 border-gold/10 hover:border-gold/30 snap-center shrink-0">
                          <img src={p.image_url!} alt={p.name} className="w-14 h-14 rounded-2xl object-cover border border-white/5 bg-slate-900" />
                          <div className="flex-1">
                            <p className="font-black text-white text-xs truncate uppercase tracking-tight">{p.name}</p>
                            <p className="text-gold font-display font-black text-sm">₹{p.sold_price?.toLocaleString()}</p>
                            <p className="text-[10px] text-slate-500 font-bold truncate opacity-80 uppercase">{p.sold_to_team?.team_name}</p>
                          </div>
                          <div className="bg-gold/10 p-2 rounded-xl">
                            <CheckCircle className="w-4 h-4 text-gold" />
                          </div>
                        </div>
                      ))}
                    </div>
                  </motion.div>
                )}
              </motion.div>
            )}
          </AnimatePresence>

          {/* Features Grid */}
          <motion.div
            variants={containerVariants}
            className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-8 mb-32"
          >
            <FeatureCard
              icon={<Zap className="w-10 h-10 text-primary" />}
              title="Quantum Engine"
              description="Zero-latency bidding powered by Supabase Realtime fabric. Experience millisecond responsiveness."
              accent="bg-primary/20"
            />
            <FeatureCard
              icon={<Shield className="w-10 h-10 text-gold" />}
              title="Secure Portals"
              description="Enterprise-grade role-based access for 24 elite captains. Your strategy is protected."
              accent="bg-gold/20"
            />
            <FeatureCard
              icon={<Target className="w-10 h-10 text-electric" />}
              title="Tactical Stats"
              description="AI-driven player analytics and roster management at your fingertips. Build the perfect team."
              accent="bg-electric/20"
            />
          </motion.div>
        </motion.div>
      </main>

      <footer className="relative z-10 glass bg-slate-950/60 border-t border-white/5 py-12">
        <div className="container mx-auto px-4">
          <div className="flex flex-col md:flex-row justify-between items-center gap-8">
            <div className="flex flex-col items-center md:items-start">
              <h4 className="font-display text-xl font-black text-gradient-gold mb-2 tracking-tighter">SUKRUT PREMIER LEAGUE</h4>
              <p className="text-slate-500 text-xs font-bold tracking-widest">ELEVATING CRICKET AUCTION SINCE 2024</p>
            </div>

            <div className="flex gap-8">
              <FooterLink label="Tournament Rules" />
              <FooterLink label="Privacy Logic" />
              <FooterLink label="System Status" />
            </div>

            <div className="text-slate-500 text-[10px] font-black tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-green-500 shadow-[0_0_10px_#22c55e]" />
              ALL SYSTEMS OPERATIONAL
            </div>
          </div>

          <div className="mt-12 pt-8 border-t border-white/5 text-center">
            <p className="text-slate-600 text-[9px] font-bold tracking-[0.5em] uppercase">
              © 2026 Developed for Sukrut Parivar. Absolute UI Performance Guaranteed.
            </p>
          </div>
        </div>
      </footer>
    </div>
  );
}

function FeatureCard({ icon, title, description, accent }: { icon: React.ReactNode, title: string, description: string, accent: string }) {
  return (
    <motion.div
      variants={{
        hidden: { scale: 0.95, opacity: 0 },
        visible: { scale: 1, opacity: 1 }
      }}
      className="glass-card p-10 rounded-[2.5rem] flex flex-col group relative overflow-hidden"
    >
      <div className={`absolute top-0 right-0 w-32 h-32 ${accent} blur-[60px] opacity-20 -translate-y-1/2 translate-x-1/2 group-hover:opacity-40 transition-opacity`} />

      <div className="bg-slate-950/60 w-20 h-20 rounded-3xl flex items-center justify-center mb-8 border border-white/5 group-hover:scale-110 group-hover:rotate-6 transition-all duration-500 shadow-2xl">
        {icon}
      </div>

      <h3 className="font-display text-2xl font-black mb-4 tracking-tight text-white">{title}</h3>
      <p className="text-slate-400 leading-relaxed font-sans font-medium text-sm">
        {description}
      </p>

      <div className="mt-8 flex items-center gap-2 text-[10px] font-black tracking-widest text-primary uppercase opacity-0 group-hover:opacity-100 transition-opacity">
        Learn more <ArrowRight className="w-3 h-3" />
      </div>
    </motion.div>
  );
}

function FooterLink({ label }: { label: string }) {
  return (
    <a href="#" className="text-slate-500 hover:text-white transition-colors text-[10px] font-black tracking-widest uppercase">
      {label}
    </a>
  );
}
